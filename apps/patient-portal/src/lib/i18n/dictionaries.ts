import type { Dictionary, Locale } from "./types";
import { en } from "./locales/en";
import { hi } from "./locales/hi";
import { mr } from "./locales/mr";
import { gu } from "./locales/gu";
import { pa } from "./locales/pa";
import { ta } from "./locales/ta";
import { te } from "./locales/te";

export const DICTIONARIES: Record<Locale, Dictionary> = {
  en,
  hi,
  mr,
  gu,
  pa,
  ta,
  te,
};
