'use client';

import type { InsightMomentContent } from '@/components/questionnaire/v2/insightRules';

import styles from './assessment-v3.module.css';

export function InsightMomentV3({ content }: { content: InsightMomentContent }) {
  return (
    <aside className={styles.insightMoment} role="note">
      <span>{content.eyebrow}</span>
      <p>{content.body}</p>
    </aside>
  );
}
