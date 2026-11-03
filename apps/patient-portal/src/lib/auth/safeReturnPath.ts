const RETURN_ORIGIN = "https://hairos.invalid";

export function safeReturnPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(value)) {
    return null;
  }
  const target = new URL(value, RETURN_ORIGIN);
  if (target.origin !== RETURN_ORIGIN || target.pathname.startsWith("//")) {
    return null;
  }
  return target.pathname + target.search + target.hash;
}
