// Safe post-login return path.
//
// A `next`/`returnTo` parameter that comes off a URL is attacker-controllable,
// so it must never be used as a redirect target unless it is a plain
// same-origin absolute path. Everything else — an absolute URL
// ("https://evil.test"), a protocol-relative host ("//evil.test"), a backslash
// trick ("/\\evil.test") or anything not starting with a single "/" — is
// dropped to the fallback, which closes the open-redirect vector while keeping
// the legitimate "return to the page I was heading for" behaviour.
export function safeReturnPath(
  raw: string | null | undefined,
  fallback = "/post-login",
): string {
  if (
    !raw ||
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.startsWith("/\\")
  ) {
    return fallback;
  }
  return raw;
}
