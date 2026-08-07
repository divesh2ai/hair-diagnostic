import { notFound } from "next/navigation";
import questionnaireSchema from "@hairos/packages/ai-engine/questionnaire-engine/schema/questionnaire.schema.json";
import { ClinicalOptionIcon } from "@/components/reports/one-page/ClinicalOptionIcon";
import {
  clinicalOptionCodeForLabel,
  resolveClinicalOptionAsset,
} from "@/lib/reports/one-page/clinicalOptionAssets";
import styles from "./catalogue.module.css";

type RawOption = { label?: unknown; value?: unknown };
type RawQuestion = { id?: unknown; label?: unknown; options?: unknown };

function questionnaireOptions(value: unknown): Array<{ questionId: string; questionLabel: string; label: string; value: string }> {
  const questions: RawQuestion[] = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== "object") return;
    const candidate = node as RawQuestion;
    if (typeof candidate.id === "string" && Array.isArray(candidate.options)) questions.push(candidate);
    Object.values(node as Record<string, unknown>).forEach(visit);
  };
  visit(value);

  const seen = new Set<string>();
  return questions.flatMap((question) => {
    const questionId = String(question.id);
    const questionLabel = typeof question.label === "string" ? question.label : questionId;
    return (question.options as RawOption[]).flatMap((option) => {
      if (typeof option.label !== "string") return [];
      const label = option.label.trim();
      const optionCode = clinicalOptionCodeForLabel(label);
      const key = `${questionId}:${optionCode}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ questionId, questionLabel, label, value: typeof option.value === "string" ? option.value : label }];
    });
  });
}

export default function ClinicalIconCataloguePage() {
  if (process.env.NODE_ENV === "production") notFound();

  const options = questionnaireOptions(questionnaireSchema);
  const rows = options.map((option) => {
    const optionCode = clinicalOptionCodeForLabel(option.label);
    return { ...option, optionCode, resolved: resolveClinicalOptionAsset({ optionCode, label: option.label }) };
  });
  const counts = rows.reduce(
    (total, row) => ({ ...total, [row.resolved.status]: total[row.resolved.status] + 1 }),
    { exact: 0, fallback: 0, needs_replacement: 0 },
  );

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Dr. FACT · development only</p>
          <h1>Clinical option icon catalogue</h1>
          <p>Questionnaire labels are authoritative. Snapshot and trigger previews resolve through the same typed registry.</p>
        </div>
        <div className={styles.metrics}>
          <span><b>{rows.length}</b> options</span>
          <span className={styles.exact}><b>{counts.exact}</b> exact</span>
          <span className={styles.fallback}><b>{counts.fallback}</b> fallback</span>
          <span className={styles.replacement}><b>{counts.needs_replacement}</b> replace</span>
        </div>
      </header>

      <section className={styles.grid}>
        {rows.map((row) => {
          const crop = row.resolved.registryEntry?.sourceCrop;
          return (
            <article className={styles.card} key={`${row.questionId}:${row.optionCode}`} data-status={row.resolved.status}>
              <div className={styles.cardTop}>
                <div className={styles.snapshotPreview}>
                  <ClinicalOptionIcon optionCode={row.optionCode} label={row.label} usage="snapshot" />
                </div>
                <div className={styles.triggerPreview}>
                  <ClinicalOptionIcon optionCode={row.optionCode} label={row.label} usage="trigger" />
                  <span>{row.label}</span>
                </div>
              </div>
              <div className={styles.cardBody}>
                <span className={`${styles.badge} ${styles[row.resolved.status]}`}>{row.resolved.status.replaceAll("_", " ")}</span>
                <h2>{row.label}</h2>
                <code>{row.optionCode}</code>
                <dl>
                  <div><dt>Question</dt><dd>{row.questionId}</dd></div>
                  <div><dt>Path</dt><dd>{row.resolved.asset.src}</dd></div>
                  <div><dt>Crop</dt><dd>{crop ? `${crop.x}, ${crop.y}, ${crop.width}×${crop.height}` : "Domain fallback"}</dd></div>
                </dl>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
