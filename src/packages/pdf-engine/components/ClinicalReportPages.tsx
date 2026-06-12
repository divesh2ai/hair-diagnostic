import React from 'react';
import { Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ClinicalReport } from '../../ai-engine/report-engine/types';

/**
 * Clinical Report V4 — patient-specific clinical decision report.
 *
 * Spec: HAIROS_REPORT_V4_FINAL_REDESIGN. Hard rules:
 *  - No Executive Summary, no Monitoring Plan, no narratives.
 *  - No confidence / severity scores.
 *  - Card-driven layout (no paragraphs of essays).
 *  - Every page renders content sourced from buildClinicalReport — this
 *    component is a pure rendering layer.
 */

const S = StyleSheet.create({
  page:      { padding: 40, backgroundColor: '#FFFFFF', fontFamily: 'Helvetica' },
  pageTag:   { fontSize: 9, color: '#94A3B8', letterSpacing: 1.5, marginBottom: 4 },
  h1:        { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#0F172A', marginBottom: 10 },
  h2:        { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#0F172A', marginTop: 10, marginBottom: 4 },
  h3:        { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#334155', marginTop: 6, marginBottom: 2 },
  body:      { fontSize: 10, color: '#334155', lineHeight: 1.45, marginBottom: 3 },
  small:     { fontSize: 9, color: '#64748B' },
  divider:   { borderBottomWidth: 1, borderBottomColor: '#E2E8F0', marginVertical: 10 },

  metaRow:   { flexDirection: 'row', marginBottom: 2 },
  metaKey:   { width: 130, fontSize: 9, color: '#64748B' },
  metaVal:   { flex: 1, fontSize: 10, color: '#0F172A' },

  card:      { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, padding: 10, marginBottom: 8 },
  cardLabel: { fontSize: 9, color: '#64748B', letterSpacing: 0.6, marginBottom: 2 },
  cardTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#0F172A' },
  cardKitId: { fontSize: 9, color: '#94A3B8', marginTop: 1, marginBottom: 5 },

  twoCol:    { flexDirection: 'row', gap: 10 },
  col:       { flex: 1 },

  bullet:     { flexDirection: 'row', marginBottom: 2 },
  bulletDot:  { width: 8, fontSize: 9, color: '#64748B' },
  bulletText: { flex: 1, fontSize: 9, color: '#334155', lineHeight: 1.4 },

  // Category banners (Primary / Secondary / Amplifier)
  catBanner:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, marginBottom: 6, marginTop: 6, alignSelf: 'flex-start' },
  catBannerTxt:   { fontSize: 9, fontFamily: 'Helvetica-Bold', letterSpacing: 0.6 },

  // Roadmap badge
  tlItem:     { flexDirection: 'row', marginBottom: 8 },
  tlBadge:    { width: 64, backgroundColor: '#7C3AED', borderRadius: 4, paddingVertical: 4, paddingHorizontal: 6, marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  tlBadgeTxt: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' },
  tlBody:     { flex: 1 },

  // Impact pill
  pill:       { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, fontSize: 8, fontFamily: 'Helvetica-Bold' },

  // Recommendation flow row (condition → recommendation → benefit)
  recRow:     { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, padding: 8, marginBottom: 6 },
  recKey:     { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#0F172A' },
  recArrow:   { fontSize: 9, color: '#94A3B8', marginVertical: 2 },
});

function Bullet({ text }: { text: string }) {
  return (
    <View style={S.bullet} wrap={false}>
      <Text style={S.bulletDot}>•</Text>
      <Text style={S.bulletText}>{text}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGES
// ─────────────────────────────────────────────────────────────────────────────

export function ClinicalReportPages({ report }: { report: ClinicalReport }) {
  const {
    patientSummary,
    treatmentStrategy,
    topicalRecommendations,
    topicalCautions,
    clinicalInsightStory,
    recoveryMilestones,
    generalLifestyleGuide,
  } = report;

  const sel = patientSummary.questionnaireSelections;
  const selRowsRaw: Array<[string, string[] | string | undefined]> = [
    ['Duration',            sel.duration],
    ['Shedding intensity',  sel.count],
    ['Severity grade',      sel.grade],
    ['Hair pattern',        sel.hairType],
    ['Scalp',               sel.scalp],
    ['Suspected cause',     sel.cause],
    ['Lifestyle',           sel.lifestyle],
    ['Hormonal',            sel.hormonal],
    ['Thyroid',             sel.thyroid],
    ['Immunity',            sel.immunity],
    ['Deficiency',          sel.deficiency],
    ['Gut',                 sel.gut],
    ['Diet',                sel.diet],
    ['Previous treatments', sel.treatment],
    ['Goal',                sel.goal],
  ];
  const selRows = selRowsRaw.filter(
    ([, v]) => v !== undefined && (Array.isArray(v) ? v.length > 0 : true)
  );

  return (
    <>
      {/* ── Page 1 — Patient Summary ───────────────────────────────────────── */}
      <Page size="A4" style={S.page}>
        <Text style={S.pageTag}>PAGE 1 · PATIENT SUMMARY</Text>
        <Text style={S.h1}>{patientSummary.name}</Text>
        <Text style={S.small}>
          {patientSummary.age} years · {patientSummary.gender}
          {patientSummary.goal.length ? `  ·  Goal: ${patientSummary.goal.join(', ')}` : ''}
        </Text>

        <Text style={S.h2}>Questionnaire selections</Text>
        {selRows.map(([k, v], i) => (
          <View key={i} style={S.metaRow}>
            <Text style={S.metaKey}>{k}</Text>
            <Text style={S.metaVal}>{Array.isArray(v) ? v.join(', ') : v}</Text>
          </View>
        ))}

        {patientSummary.clinicalInterpretation.length > 0 && (
          <>
            <Text style={S.h2}>Clinical interpretation</Text>
            {patientSummary.clinicalInterpretation.map((ci, i) => (
              <View key={i} style={S.card} wrap={false}>
                <Text style={S.cardTitle}>{ci.signal}</Text>
                <Text style={[S.body, { marginTop: 2 }]}>{ci.interpretation}</Text>
              </View>
            ))}
          </>
        )}
      </Page>

      {/* ── Treatment Strategy ────────────────────────────────────────── */}
      <Page size="A4" style={S.page}>
        <Text style={S.pageTag}>PAGES 3-4 · TREATMENT STRATEGY</Text>
        <Text style={S.h1}>Treatment Strategy</Text>

        {treatmentStrategy.length === 0 ? (
          <Text style={S.body}>No kits selected.</Text>
        ) : treatmentStrategy.map((p) => (
          <View key={`${p.phase}-${p.kitId}`} style={S.card} wrap={false}>
            <Text style={[S.cardTitle, { letterSpacing: 0.5 }]}>{p.kitId}</Text>
            <Text style={[S.cardKitId, { fontStyle: 'italic' }]}>{p.displayName}</Text>

            {p.supportingConditions.length > 0 && (
              <>
                <Text style={S.h3}>Supporting conditions</Text>
                <Text style={S.body}>{p.supportingConditions.join(', ')}</Text>
              </>
            )}

            {p.keyIngredients.length > 0 && (
              <>
                <Text style={S.h3}>Key ingredients</Text>
                <Text style={S.body}>{p.keyIngredients.join(', ')}</Text>
              </>
            )}

            {p.mechanismOfAction.length > 0 && (
              <>
                <Text style={S.h3}>Mechanism of action</Text>
                {p.mechanismOfAction.map((m, i) => (<Bullet key={i} text={m} />))}
              </>
            )}
          </View>
        ))}
      </Page>

      {/* ── Topical Recommendations ──────────────────────────────────────── */}
      <Page size="A4" style={S.page}>
        <Text style={S.pageTag}>TOPICAL RECOMMENDATIONS</Text>
        <Text style={S.h1}>Topical Recommendations</Text>

        {(!topicalRecommendations || topicalRecommendations.length === 0) ? (
          <Text style={S.body}>No topical recommendations for this profile.</Text>
        ) : topicalRecommendations.map((t, i) => (
          <View key={i} style={S.card} wrap={false}>
            <Text style={[S.cardTitle, { letterSpacing: 0.5 }]}>{t.name}</Text>
            <Text style={S.h3}>Why selected</Text>
            <Text style={S.body}>{t.whySelected}</Text>
            <Text style={S.h3}>How to use</Text>
            <Text style={S.body}>{t.usage}</Text>
            <Text style={S.h3}>Clinical note</Text>
            <Text style={S.body}>{t.note}</Text>
          </View>
        ))}

        {topicalCautions && topicalCautions.length > 0 && (
          <View style={[S.card, { borderColor: '#FCD34D', backgroundColor: '#FFFBEB' }]} wrap={false}>
            <Text style={[S.cardLabel, { color: '#92400E' }]}>CAUTIONS / CONTRAINDICATIONS</Text>
            {topicalCautions.map((c, i) => (
              <Text key={i} style={S.body}>
                • <Text style={{ fontFamily: 'Helvetica-Bold' }}>{c.name}</Text> — {c.reason}
              </Text>
            ))}
          </View>
        )}
      </Page>

      {/* ── Clinical Insight & Recovery Story ───────────────────────────── */}
      {clinicalInsightStory && (
        <Page size="A4" style={S.page}>
          <Text style={S.pageTag}>CLINICAL INSIGHT · YOUR STORY</Text>
          <Text style={S.h1}>Clinical insight & recovery story</Text>
          <Text style={[S.body, { marginBottom: 12, fontStyle: 'italic', color: '#64748B' }]}>
            Based on the information you shared with us — the factors that may
            be influencing your hair, why they matter, why this plan was
            selected, and what realistic progress may look like.
          </Text>

          {clinicalInsightStory.drivers?.length > 0 && (
            <>
              <Text style={S.h2}>Factors influencing your hair</Text>
              {clinicalInsightStory.drivers.map((d, i) => (
                <View key={`driver-${i}`} style={S.card} wrap={false}>
                  <Text style={S.cardTitle}>{d.label}</Text>
                  <Text style={[S.body, { marginTop: 3 }]}>{d.hairImpact}</Text>
                  <Text style={[S.cardLabel, { marginTop: 6 }]}>GOAL</Text>
                  <Text style={S.body}>{d.treatmentGoal}</Text>
                </View>
              ))}
            </>
          )}

          <Text style={S.h3}>Section 1 · Your hair story</Text>
          <Text style={[S.body, { marginBottom: 10, lineHeight: 1.55 }]}>
            {clinicalInsightStory.yourHairStory}
          </Text>

          <Text style={S.h3}>Section 2 · Why this may be happening</Text>
          <Text style={[S.body, { marginBottom: 10, lineHeight: 1.55 }]}>
            {clinicalInsightStory.whyThisMayBeHappening}
          </Text>

          <Text style={S.h3}>Section 3 · Why this plan was recommended</Text>
          <Text style={[S.body, { marginBottom: 10, lineHeight: 1.55 }]}>
            {clinicalInsightStory.whyThisPlanWasRecommended}
          </Text>

          <Text style={S.h3}>Section 4 · What to expect</Text>
          <Text style={[S.body, { marginBottom: 4, lineHeight: 1.55 }]}>
            {clinicalInsightStory.whatToExpect}
          </Text>
        </Page>
      )}

      {/* ── Recovery Milestones (universal, identical for every report) ── */}
      <Page size="A4" style={S.page}>
        <Text style={S.pageTag}>RECOVERY MILESTONES</Text>
        <Text style={S.h1}>Recovery Milestones</Text>
        <Text style={[S.body, { marginBottom: 10 }]}>
          A realistic clinical expectation framework for your recovery journey.
        </Text>

        {recoveryMilestones.map((m, i) => (
          <View key={`rm-${i}`} style={S.tlItem} wrap={false}>
            <View style={[S.tlBadge, { width: 96 }]}>
              <Text style={S.tlBadgeTxt}>{m.window.toUpperCase()}</Text>
            </View>
            <View style={S.tlBody}>
              {m.bullets.map((b, j) => (
                <Bullet key={`rm-${i}-${j}`} text={b} />
              ))}
            </View>
          </View>
        ))}
      </Page>

      {/* ── Diet & Lifestyle (generic — same for every patient) ─────────── */}
      <Page size="A4" style={S.page}>
        <Text style={S.pageTag}>DIET & LIFESTYLE</Text>
        <Text style={S.h1}>Diet & Lifestyle</Text>
        <Text style={[S.body, { marginBottom: 10 }]}>
          General diet and lifestyle guidance for healthy hair — applies regardless of diagnosis.
        </Text>

        {generalLifestyleGuide && (
          <>
            <Text style={S.h2}>Foods to avoid (may be consumed twice a week)</Text>
            {generalLifestyleGuide.foodsToAvoid.map((f, i) => (
              <Bullet key={`avoid-${i}`} text={f} />
            ))}

            <Text style={S.h2}>Foods to add to your diet</Text>
            {generalLifestyleGuide.foodsToAdd.map((f, i) => (
              <Bullet key={`add-${i}`} text={f} />
            ))}

            <Text style={S.h2}>Lifestyle recommendations</Text>
            {generalLifestyleGuide.lifestyleRecommendations.map((l, i) => (
              <Bullet key={`life-${i}`} text={l} />
            ))}
          </>
        )}
      </Page>
    </>
  );
}
