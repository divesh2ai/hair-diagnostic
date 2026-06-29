export * from "./types";
export { I18nProvider, useI18n, useT } from "./I18nProvider";
export type { DictionaryPath } from "./I18nProvider";
export { DICTIONARIES } from "./dictionaries";
// `readServerLocale` deliberately NOT re-exported here — it uses `next/headers`
// which would taint every client component importing from this barrel. Server
// callers import from "@/lib/i18n/server" directly.
