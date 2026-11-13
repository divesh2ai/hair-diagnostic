import { createHmac, timingSafeEqual } from "node:crypto";
import { DOCTOR_IDLE_MS } from "./doctorSessionPolicy";

export function googleSessionBinding(sessionId: string): string {
  const secret = process.env.REVIEW_TOKEN_SECRET;
  if (!secret) throw new Error("Missing session signing configuration");
  return createHmac("sha256", secret).update("hairos-google-session:" + sessionId).digest("hex");
}

export function matchesGoogleSessionBinding(sessionId: string, binding?: string): boolean {
  if (!binding || !/^[a-f0-9]{64}$/.test(binding)) return false;
  return timingSafeEqual(Buffer.from(binding, "hex"), Buffer.from(googleSessionBinding(sessionId), "hex"));
}

export function doctorScreenCookie(binding: string, now = Date.now()): string {
  return now + "." + googleSessionBinding("screen:" + binding + ":" + now);
}

export function doctorScreenIsUnlocked(binding: string, cookie?: string, now = Date.now()): boolean {
  const [timestamp, signature, extra] = (cookie ?? "").split(".");
  if (!/^\d{13}$/.test(timestamp) || extra !== undefined) return false;
  const age = now - Number(timestamp);
  return age >= 0 && age < DOCTOR_IDLE_MS &&
    matchesGoogleSessionBinding("screen:" + binding + ":" + timestamp, signature);
}
