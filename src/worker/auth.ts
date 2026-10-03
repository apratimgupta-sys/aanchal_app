import type { UserSession } from "../shared/types";
const enc = new TextEncoder();
const hex = (v: ArrayBuffer) =>
  Array.from(new Uint8Array(v), (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
export async function tokenHash(s: string) {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}
async function derive(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return hex(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: enc.encode(salt),
        iterations: 100000,
        hash: "SHA-256",
      },
      key,
      256,
    ),
  );
}
export async function hashPassword(password: string) {
  const salt = crypto.randomUUID();
  return salt + ":" + (await derive(password, salt));
}
export async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  const actual = await derive(password, salt);
  let difference = actual.length ^ hash.length;
  for (let i = 0; i < actual.length; i++)
    difference |= actual.charCodeAt(i) ^ (hash.charCodeAt(i) || 0);
  return difference === 0;
}
export async function authenticate(
  request: Request,
  db: D1Database,
): Promise<UserSession | null> {
  const token = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)rmc_session=([^;]+)/)?.[1];
  if (!token) return null;
  return db
    .prepare(
      "SELECT u.id AS userId,u.username,u.role,u.office_id AS officeId,s.expires_at AS expiresAt FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?",
    )
    .bind(await tokenHash(token), Date.now())
    .first<UserSession>();
}
export function cookie(token: string, request: Request, age = 28800) {
  return `rmc_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
