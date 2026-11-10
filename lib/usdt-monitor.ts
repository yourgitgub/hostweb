import { creditDepositFromPayment } from "./credits";
import { nowIso } from "./crypto";
import { getDb } from "./env";
import { getPublicSettings } from "./settings";

type Trc20Tx = {
  transaction_id: string;
  token_info?: { symbol?: string; address?: string };
  to?: string;
  value?: string;
  block_timestamp?: number;
};

/**
 * Auto-credit pending USDT TRC20 payments by scanning TronGrid for exact amount matches.
 * No human approval path.
 */
export async function scanPendingPayments() {
  const settings = await getPublicSettings();
  const db = getDb();
  const now = nowIso();

  // Expire stale pendings
  await db
    .prepare(
      `UPDATE usdt_payments SET status = 'rejected', updated_at = ? WHERE status = 'pending' AND expires_at < ?`,
    )
    .bind(now, now)
    .run();

  const { results } = await db
    .prepare(
      `SELECT id, amount_usdt, receive_address FROM usdt_payments WHERE status = 'pending' AND expires_at >= ?`,
    )
    .bind(now)
    .all<{ id: string; amount_usdt: string; receive_address: string }>();

  if (!results?.length) return { scanned: 0, credited: 0 };

  const address = settings.receiveWallet;
  let txs: Trc20Tx[] = [];
  try {
    const url = `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20?only_to=true&limit=50`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (res.ok) {
      const json = (await res.json()) as { data?: Trc20Tx[] };
      txs = json.data ?? [];
    }
  } catch {
    // Network failure — leave pending; job will retry
    return { scanned: results.length, credited: 0, error: "trongrid_unreachable" };
  }

  // USDT TRC20 contract on mainnet
  const USDT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
  let credited = 0;

  for (const payment of results) {
    const match = txs.find((tx) => {
      if ((tx.to || "").toLowerCase() !== address.toLowerCase()) return false;
      const sym = tx.token_info?.symbol?.toUpperCase();
      const contract = tx.token_info?.address;
      if (sym && sym !== "USDT") return false;
      if (contract && contract !== USDT) return false;
      // value often in sun-like integer with 6 decimals for USDT
      const raw = tx.value || "0";
      let human: string;
      if (raw.includes(".")) {
        human = Number(raw).toFixed(10).replace(/0+$/, "").replace(/\.$/, "");
      } else {
        const n = Number(raw) / 1_000_000;
        human = n.toFixed(10).replace(/0+$/, "").replace(/\.$/, "");
      }
      // Compare with payment amount (normalize trailing zeros)
      const want = Number(payment.amount_usdt);
      const got = Number(human);
      return Number.isFinite(want) && Number.isFinite(got) && Math.abs(want - got) < 1e-12;
    });

    if (!match?.transaction_id) continue;
    const result = await creditDepositFromPayment(payment.id, match.transaction_id);
    if (result.ok) credited += 1;
  }

  return { scanned: results.length, credited };
}
