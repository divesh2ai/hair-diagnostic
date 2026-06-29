import crypto from "node:crypto";

// 32 random bytes → base64url (~43 chars). The raw token is what the
// recipient receives in their invite link; only the sha256 hash is
// stored in the DB so a DB leak can't expose redeemable invites.
export function generateInvitationToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

export function hashInvitationToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}
