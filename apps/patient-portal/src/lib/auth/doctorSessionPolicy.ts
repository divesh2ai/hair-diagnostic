export const DOCTOR_SESSION_SECONDS = 30 * 24 * 60 * 60;
export const DOCTOR_IDLE_MS = 15 * 60 * 1000;
export const GOOGLE_SESSION_COOKIE = "hairos-google-session";
export const DOCTOR_SCREEN_COOKIE = "hairos-doctor-screen";

export function isDoctorSessionCurrent(createdAt: Date, now = Date.now()): boolean {
  const age = now - createdAt.getTime();
  return age >= 0 && age < DOCTOR_SESSION_SECONDS * 1000;
}
