import { CREDIT_POLL_MS, USDT_PENDING_TIMEOUT_MIN } from "./constants";
import { addMinutesIso, nowIso, randomId } from "./crypto";
import { getDb } from "./env";
import { getPublicSettings } from "./settings";

export { CREDIT_POLL_MS };

function uniqueUsdtAmount(baseThb: number, fx: number): string {
  // Convert THB intent to USDT then add unique fractional tail (copy-only amount).
  const base = baseThb / fx;
  const whole = Math.floor(base);
  const rand = crypto.getRandomValues(new Uint32Array(2));
  const frac = ((rand[0]! % 1_000_000) * 1_000 + (rand[1]! % 1_000)).toString().padStart(9, "0");
  // Ensure at least 4 decimal places visible uniqueness beyond whole USDT
  return `${whole}.${frac}`;
}

export async function createTopup(userId: string, thbIntent: number) {
  if (!Number.isFinite(thbIntent) || thbIntent <= 0) {
    return { ok: false as const, error: "กรุณาใส่จำนวนเงิน (บาท) ที่มากกว่า 0" };
  }
  const settings = await getPublicSettings();
  const db = getDb();
  let amountUsdt = "";
  for (let attempt = 0; attempt < 12; attempt++) {
    const candidate = uniqueUsdtAmount(thbIntent, settings.fxUsdtThb);
    const clash = await db
      .prepare("SELECT id FROM usdt_payments WHERE amount_usdt = ?")
      .bind(candidate)
      .first();
    if (!clash) {
      amountUsdt = candidate;
      break;
    }
  }
  if (!amountUsdt) return { ok: false as const, error: "สร้างยอดโอนไม่สำเร็จ ลองอีกครั้ง" };

  const amountThb = Number((Number(amountUsdt) * settings.fxUsdtThb).toFixed(2));
  const id = randomId();
  const ts = nowIso();
  const expires = addMinutesIso(USDT_PENDING_TIMEOUT_MIN);
  await db
    .prepare(
      `INSERT INTO usdt_payments
        (id, user_id, amount_usdt, amount_thb, fx_rate, status, receive_address, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
    )
    .bind(
      id,
      userId,
      amountUsdt,
      amountThb,
      settings.fxUsdtThb,
      settings.receiveWallet,
      expires,
      ts,
      ts,
    )
    .run();

  return {
    ok: true as const,
    payment: {
      id,
      amountUsdt,
      amountThb,
      fxRate: settings.fxUsdtThb,
      fxUpdatedAt: settings.fxUpdatedAt,
      receiveAddress: settings.receiveWallet,
      expiresAt: expires,
      status: "pending" as const,
    },
  };
}

export async function listLedger(userId: string, limit = 50) {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT id, kind, amount_thb, balance_after_thb, note, created_at
       FROM credit_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    )
    .bind(userId, limit)
    .all();
  return results ?? [];
}

export async function listPayments(userId: string, limit = 20) {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT id, amount_usdt, amount_thb, fx_rate, status, tx_hash, expires_at, confirmed_at, created_at
       FROM usdt_payments WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    )
    .bind(userId, limit)
    .all();
  return results ?? [];
}

export async function getPayment(userId: string, id: string) {
  return getDb()
    .prepare(`SELECT * FROM usdt_payments WHERE id = ? AND user_id = ?`)
    .bind(id, userId)
    .first();
}

export async function creditDepositFromPayment(paymentId: string, txHash: string) {
  const db = getDb();
  const payment = await db
    .prepare(`SELECT * FROM usdt_payments WHERE id = ?`)
    .bind(paymentId)
    .first<{
      id: string;
      user_id: string;
      amount_thb: number;
      status: string;
      tx_hash: string | null;
    }>();
  if (!payment || payment.status !== "pending") return { ok: false as const, reason: "not_pending" };

  const used = await db
    .prepare(`SELECT id FROM usdt_payments WHERE tx_hash = ?`)
    .bind(txHash)
    .first();
  if (used) return { ok: false as const, reason: "tx_used" };

  const user = await db
    .prepare(`SELECT credit_balance_thb FROM users WHERE id = ?`)
    .bind(payment.user_id)
    .first<{ credit_balance_thb: number }>();
  if (!user) return { ok: false as const, reason: "no_user" };

  const ts = nowIso();
  const nextBal = Number((user.credit_balance_thb + payment.amount_thb).toFixed(2));
  const ledgerId = randomId();

  await db.batch([
    db
      .prepare(
        `UPDATE usdt_payments SET status = 'confirmed', tx_hash = ?, confirmed_at = ?, updated_at = ? WHERE id = ? AND status = 'pending'`,
      )
      .bind(txHash, ts, ts, payment.id),
    db
      .prepare(`UPDATE users SET credit_balance_thb = ?, updated_at = ? WHERE id = ?`)
      .bind(nextBal, ts, payment.user_id),
    db
      .prepare(
        `INSERT INTO credit_ledger (id, user_id, kind, amount_thb, balance_after_thb, ref_type, ref_id, note, created_at)
         VALUES (?, ?, 'deposit', ?, ?, 'usdt_payment', ?, ?, ?)`,
      )
      .bind(
        ledgerId,
        payment.user_id,
        payment.amount_thb,
        nextBal,
        payment.id,
        `USDT TRC20 ${txHash}`,
        ts,
      ),
  ]);

  return { ok: true as const, balance: nextBal };
}

export async function chargeCredits(userId: string, amountThb: number, refType: string, refId: string, note: string) {
  const db = getDb();
  const user = await db
    .prepare(`SELECT credit_balance_thb FROM users WHERE id = ?`)
    .bind(userId)
    .first<{ credit_balance_thb: number }>();
  if (!user || user.credit_balance_thb < amountThb) {
    return { ok: false as const, error: "เครดิตไม่พอ" };
  }
  const ts = nowIso();
  const nextBal = Number((user.credit_balance_thb - amountThb).toFixed(2));
  const ledgerId = randomId();
  await db.batch([
    db
      .prepare(`UPDATE users SET credit_balance_thb = ?, updated_at = ? WHERE id = ?`)
      .bind(nextBal, ts, userId),
    db
      .prepare(
        `INSERT INTO credit_ledger (id, user_id, kind, amount_thb, balance_after_thb, ref_type, ref_id, note, created_at)
         VALUES (?, ?, 'charge', ?, ?, ?, ?, ?, ?)`,
      )
      .bind(ledgerId, userId, -amountThb, nextBal, refType, refId, note, ts),
  ]);
  return { ok: true as const, balance: nextBal };
}
