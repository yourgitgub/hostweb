import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_DAYS } from "./constants";
import { addDaysIso, hashPassword, nowIso, randomId, sha256Hex, verifyPassword } from "./crypto";
import { getDb, getEnv, isProduction } from "./env";

export type UserRow = {
  id: string;
  email: string;
  role: "customer" | "admin";
  credit_balance_thb: number;
  disabled: number;
};

export async function ensureBootstrapAdmin(): Promise<void> {
  const env = getEnv();
  const email = env.BOOTSTRAP_ADMIN_EMAIL;
  const password = env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) return;
  const db = getDb();
  const existing = await db
    .prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE")
    .bind(email)
    .first();
  if (existing) return;
  const id = randomId();
  const ts = nowIso();
  const password_hash = await hashPassword(password);
  await db
    .prepare(
      `INSERT INTO users (id, email, password_hash, role, credit_balance_thb, disabled, created_at, updated_at)
       VALUES (?, ?, ?, 'admin', 0, 0, ?, ?)`,
    )
    .bind(id, email.toLowerCase(), password_hash, ts, ts)
    .run();
}

export async function registerUser(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const cleaned = email.trim().toLowerCase();
  if (!cleaned.includes("@") || cleaned.length < 5) return { ok: false, error: "กรุณาใส่อีเมลที่ถูกต้อง" };
  if (password.length < 8) return { ok: false, error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" };
  const db = getDb();
  const dup = await db
    .prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE")
    .bind(cleaned)
    .first();
  if (dup) return { ok: false, error: "อีเมลนี้ถูกใช้แล้ว" };
  const id = randomId();
  const ts = nowIso();
  const password_hash = await hashPassword(password);
  await db
    .prepare(
      `INSERT INTO users (id, email, password_hash, role, credit_balance_thb, disabled, created_at, updated_at)
       VALUES (?, ?, ?, 'customer', 0, 0, ?, ?)`,
    )
    .bind(id, cleaned, password_hash, ts, ts)
    .run();
  await createSession(id);
  return { ok: true };
}

export async function loginUser(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getDb();
  const row = await db
    .prepare(
      `SELECT id, password_hash, disabled FROM users WHERE email = ? COLLATE NOCASE`,
    )
    .bind(email.trim().toLowerCase())
    .first<{ id: string; password_hash: string; disabled: number }>();
  if (!row || row.disabled) return { ok: false, error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) return { ok: false, error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  await createSession(row.id);
  return { ok: true };
}

async function createSession(userId: string): Promise<void> {
  const token = randomId(32);
  const tokenHash = await sha256Hex(token);
  const id = randomId();
  const ts = nowIso();
  const expires = addDaysIso(SESSION_DAYS);
  const db = getDb();
  await db
    .prepare(
      `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(id, userId, tokenHash, expires, ts)
    .run();
  const jar = await cookies();
  const secure = isProduction();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    expires: new Date(expires),
  });
}

export async function logoutUser(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const hash = await sha256Hex(token);
    await getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").bind(hash).run();
  }
  jar.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getCurrentUser(): Promise<UserRow | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const hash = await sha256Hex(token);
  const db = getDb();
  const row = await db
    .prepare(
      `SELECT u.id, u.email, u.role, u.credit_balance_thb, u.disabled
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ? AND u.disabled = 0`,
    )
    .bind(hash, nowIso())
    .first<UserRow>();
  return row ?? null;
}

export async function requireUser(): Promise<UserRow> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<UserRow> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/app");
  return user;
}
