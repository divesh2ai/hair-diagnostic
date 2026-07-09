"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { DICTIONARIES } from "./dictionaries";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  type Dictionary,
  type Locale,
} from "./types";

// "Path" type — flattens nested dictionary keys into dot paths so useT() is
// fully type-safe and renames are caught at compile time.
type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
type Paths<T> = T extends object
  ? { [K in keyof T]: T[K] extends object ? Join<K, Paths<T[K]>> : K }[keyof T]
  : never;

export type DictionaryPath = Paths<Dictionary>;

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: DictionaryPath, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<Ctx | null>(null);

function walk(dict: unknown, parts: string[]): string | null {
  let cur: unknown = dict;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return null;
    }
  }
  return typeof cur === "string" ? cur : null;
}

function resolve(dict: Dictionary, path: string): string {
  const parts = path.split(".");
  const inLocale = walk(dict, parts);
  if (inLocale !== null) return inLocale;
  // Fall back to English so a missing translation renders in a real language,
  // never as a raw dot-path. Better fully-English than mixed-mode.
  const inEnglish = walk(DICTIONARIES.en, parts);
  if (inEnglish !== null) return inEnglish;
  return path;
}

function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale?: string;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(
    isLocale(initialLocale) ? initialLocale : DEFAULT_LOCALE,
  );

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    if (typeof document !== "undefined") {
      // Persist on the document so SSR can read it back on next request.
      // 1 year — locale is a low-churn preference.
      document.cookie = `${LOCALE_COOKIE}=${l};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
      document.documentElement.lang = l;
    }
  }, []);

  const value = useMemo<Ctx>(() => {
    const dict = DICTIONARIES[locale];
    return {
      locale,
      setLocale,
      t: (key, vars) => interpolate(resolve(dict, key), vars),
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

export function useT() {
  return useI18n().t;
}
