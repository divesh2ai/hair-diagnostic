import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./types";

// Read the locale a server component should hydrate the I18nProvider with.
// Falls back to DEFAULT_LOCALE when the cookie is missing or invalid.
export async function readServerLocale(): Promise<Locale> {
  const c = await cookies();
  const v = c.get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : DEFAULT_LOCALE;
}
