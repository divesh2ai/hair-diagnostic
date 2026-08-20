import type { Metadata } from "next";
import { cookies } from "next/headers";

// Imported from the leaf modules rather than the `assessment-i18n` barrel: the
// barrel re-exports the `useAssessmentTranslator` hooks, which are marked
// 'use client' and reach into the zustand assessment store. Pulling that into
// a server component's graph would drag a client boundary — and a store this
// page has no business reading — into a page that renders static copy.
import { createAssessmentTranslator } from "@/lib/assessment-i18n/resolver";
import {
  DEFAULT_ASSESSMENT_LOCALE,
  isAssessmentLocale,
} from "@/lib/assessment-i18n/types";
import { LOCALE_COOKIE } from "@/lib/i18n/types";

import styles from "./thank-you.module.css";

/**
 * The end of the patient journey.
 *
 * ── What this page must not do ──────────────────────────────────────────────
 * A patient who submits an assessment used to be sent to a polling screen that
 * waited on the clinical pipeline and then showed them its output — findings
 * and a recommendation that no doctor had looked at. This page replaces that.
 * It is the terminal screen: the assessment is filed, the clinic takes over,
 * and the patient is free to leave.
 *
 * So, deliberately:
 *   · no assessmentId in the URL — nothing here is per-patient, so there is no
 *     identifier to leak into history, a screenshot or a shared link
 *   · no fetch, no polling, no status — there is no backend state this page is
 *     entitled to read, and a spinner would invite the patient to wait
 *   · no clinical content of any kind, and no claim that anything has been
 *     concluded or approved
 *
 * ── Why it is a server component ────────────────────────────────────────────
 * It renders one static block of copy in the patient's language. The locale is
 * already in the `hairos_locale` cookie, written when they chose a language at
 * the start of the assessment, so the server can read it directly. That keeps
 * the page free of client JavaScript entirely: nothing to hydrate, nothing to
 * rehydrate from a store that may have been cleared on submit, and no window
 * in which the copy renders in the wrong language before correcting itself.
 *
 * `clinicSlug` stays in the route because the patient arrived through a
 * clinic's QR and the URL should stay inside that clinic's space. It is not
 * read here — this page makes no database call, so a slow or unreachable
 * database cannot stop a patient from being told their assessment landed.
 */

export const metadata: Metadata = {
  title: "Assessment received",
  // The patient journey is finished; there is nothing here for a crawler and
  // nothing that should surface in a search result.
  robots: { index: false, follow: false },
};

export default async function ThankYouPage() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE)?.value;
  // The shared cookie carries any of the seven platform locales; the
  // assessment ships copy for three. Anything else falls back to English
  // rather than rendering an empty key.
  const locale = isAssessmentLocale(raw) ? raw : DEFAULT_ASSESSMENT_LOCALE;
  const { t } = createAssessmentTranslator(locale);

  return (
    <main className={styles.screen} lang={locale}>
      <div className={styles.content}>
        <span className={styles.mark} aria-hidden="true">
          ✓
        </span>

        <p className={styles.eyebrow}>{t("thankYou.eyebrow")}</p>
        <h1 className={styles.title}>{t("thankYou.title")}</h1>
        <p className={styles.body}>{t("thankYou.body")}</p>

        <section className={styles.next} aria-labelledby="next-steps">
          <h2 id="next-steps" className={styles.nextTitle}>
            {t("thankYou.nextTitle")}
          </h2>
          <ol className={styles.steps}>
            <li>{t("thankYou.nextReview")}</li>
            <li>{t("thankYou.nextPlan")}</li>
            <li>{t("thankYou.nextContact")}</li>
          </ol>
        </section>

        <p className={styles.closeNote}>{t("thankYou.closeNote")}</p>
      </div>
    </main>
  );
}
