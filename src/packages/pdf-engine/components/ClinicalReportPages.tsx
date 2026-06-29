import React from 'react';
import { Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ClinicalReport } from '../../ai-engine/report-engine/types';
import { brandNameFor } from '../../ai-engine/report-engine/v3/kitBrandNames';

/**
 * Clinical Report V6 — dense, premium, layout-safe.
 *
 * Why V6 (vs V5):
 *  V5 used `flexWrap` 2-col grids with `height: '100%'` cells. react-pdf does
 *  not gracefully reflow mixed-height flex children — when one card was taller
 *  than its row partner, subsequent rows misaligned, footers were overwritten,
 *  and content occasionally jumped into the wrong page. V6 fixes this by:
 *    • Selections rendered as a dense single-column key/value list (no grid).
 *    • Interpretation cards rendered single-column with `wrap={false}` per card.
 *    • Topical cards rendered single-column.
 *    • Recovery milestone rows kept together with `wrap={false}`.
 *  Density is preserved through tighter margins, smaller type and inline runs.
 */

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  ink:        '#0F172A',
  body:       '#334155',
  muted:      '#64748B',
  faint:      '#94A3B8',
  hairline:   '#E2E8F0',
  panel:      '#F8FAFC',
  teal:       '#0F766E',
  tealSoft:   '#CCFBF1',
  tealTint:   '#F0FDFA',
  amber:      '#92400E',
  amberSoft:  '#FEF3C7',
  amberTint:  '#FFFBEB',
  violet:     '#6D28D9',
  violetSoft: '#EDE9FE',
};

const S = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 38,
    paddingHorizontal: 32,
    backgroundColor: '#FFFFFF',
    fontFamily: 'Helvetica',
    color: C.body,
  },

  // Section headers
  header:      { marginBottom: 12 },
  eyebrow:     { fontSize: 8, color: C.teal, letterSpacing: 1.6, fontFamily: 'Helvetica-Bold' },
  h1:          { fontSize: 22, fontFamily: 'Helvetica-Bold', color: C.ink, marginTop: 3 },
  lede:        { fontSize: 9, color: C.muted, lineHeight: 1.5, marginTop: 4, maxWidth: 460 },
  accentRule:  { height: 2, width: 28, backgroundColor: C.teal, marginTop: 8, borderRadius: 2 },

  h2:          { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.ink, marginTop: 14, marginBottom: 6, letterSpacing: 0.3 },
  h3:          { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.muted, letterSpacing: 0.5, marginTop: 5, marginBottom: 2 },

  body:        { fontSize: 9.5, color: C.body, lineHeight: 1.5 },
  small:       { fontSize: 8.5, color: C.muted, lineHeight: 1.4 },

  // Patient identity strip
  identityStrip: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.hairline,
  },
  patientName: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: C.ink },
  patientMeta: { fontSize: 9, color: C.muted, marginTop: 2 },
  patientGoalTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: C.tealTint,
    borderWidth: 1,
    borderColor: C.tealSoft,
    maxWidth: 240,
  },
  patientGoalTagTxt: {
    fontSize: 8,
    color: C.teal,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.4,
  },

  // Selections list — denser key/value row, no flex wrap grid
  selRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: C.hairline,
  },
  selKey: {
    width: 110,
    fontSize: 8,
    color: C.faint,
    letterSpacing: 1.1,
    fontFamily: 'Helvetica-Bold',
    paddingTop: 1,
  },
  selVal: { flex: 1, fontSize: 9.5, color: C.ink, lineHeight: 1.4 },

  // Interpretation card — single column, full width
  interpCard: {
    borderLeftWidth: 2.5,
    borderLeftColor: C.tealSoft,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.hairline,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  interpTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.ink, marginBottom: 3 },
  interpBody:  { fontSize: 9, color: C.body, lineHeight: 1.45 },

  // Treatment kit card
  kitCard: {
    borderWidth: 1,
    borderColor: C.hairline,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  kitHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  kitName: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.ink, letterSpacing: 0.4, flex: 1 },
  kitDisplay: { fontSize: 8.5, color: C.teal, fontStyle: 'italic', marginLeft: 8, maxWidth: 220, textAlign: 'right' },

  kitMetaRow: { flexDirection: 'row', marginTop: 4 },
  kitMetaCol: { flex: 1, paddingRight: 6 },
  kitMetaKey: { fontSize: 7.5, color: C.faint, letterSpacing: 1, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  kitMetaVal: { fontSize: 8.5, color: C.body, lineHeight: 1.4 },

  mechBlock: { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: C.hairline },

  // Topical card — single column for layout safety
  topicalCard: {
    borderWidth: 1,
    borderColor: C.hairline,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  topicalName:  { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.ink, marginBottom: 3 },
  topicalWhy:   { fontSize: 8.5, color: C.body, lineHeight: 1.45, marginBottom: 4 },
  topicalRow:   { flexDirection: 'row', marginTop: 3 },
  topicalCol:   { flex: 1, paddingRight: 6 },
  topicalLabel: { fontSize: 7.5, color: C.faint, letterSpacing: 1, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  topicalText:  { fontSize: 8.5, color: C.body, lineHeight: 1.4 },

  // Caution callout
  caution: {
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
    backgroundColor: C.amberTint,
  },
  cautionLabel: { fontSize: 8, color: C.amber, letterSpacing: 1.2, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  cautionText:  { fontSize: 8.5, color: '#78350F', lineHeight: 1.5 },

  // Story sections
  storyItem:       { marginBottom: 8 },
  storyEyebrowRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 3 },
  storyEyebrow: {
    fontSize: 7,
    color: C.teal,
    letterSpacing: 1.2,
    fontFamily: 'Helvetica-Bold',
    backgroundColor: C.tealSoft,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  storyTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.ink, marginLeft: 7 },
  storyBody:  { fontSize: 9, color: C.body, lineHeight: 1.5 },

  // Recovery milestone row
  mlRow: {
    flexDirection: 'row',
    marginBottom: 6,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.hairline,
  },
  mlBadge: {
    width: 88,
    paddingVertical: 10,
    paddingHorizontal: 6,
    backgroundColor: C.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mlBadgeTxt: {
    fontSize: 8.5,
    color: '#FFFFFF',
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  mlBody: { flex: 1, padding: 9, backgroundColor: C.panel },

  // Diet two-column row
  dietRow: { flexDirection: 'row', marginBottom: 8 },
  dietColLeft: {
    flex: 1,
    marginRight: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
    backgroundColor: C.amberTint,
    padding: 10,
  },
  dietColRight: {
    flex: 1,
    marginLeft: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.tealSoft,
    backgroundColor: C.tealTint,
    padding: 10,
  },
  dietHeadAmber: { fontSize: 8, color: C.amber, letterSpacing: 1.2, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  dietHeadTeal:  { fontSize: 8, color: C.teal,  letterSpacing: 1.2, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  lifestyleBox: { borderRadius: 8, borderWidth: 1, borderColor: C.hairline, backgroundColor: C.panel, padding: 10 },
  lifestyleHead: { fontSize: 8, color: C.muted, letterSpacing: 1.2, fontFamily: 'Helvetica-Bold', marginBottom: 6 },

  // Bullet
  bullet:     { flexDirection: 'row', marginBottom: 2 },
  bulletDot:  { width: 7, fontSize: 8.5, color: C.teal, fontFamily: 'Helvetica-Bold' },
  bulletText: { flex: 1, fontSize: 8.5, color: C.body, lineHeight: 1.42 },

  pageNum: {
    position: 'absolute',
    bottom: 14,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 7,
    color: C.faint,
    letterSpacing: 1,
  },
});

// ─── Atoms ────────────────────────────────────────────────────────────────────
function Bullet({ text }: { text: string }) {
  return (
    <View style={S.bullet} wrap={false}>
      <Text style={S.bulletDot}>›</Text>
      <Text style={S.bulletText}>{text}</Text>
    </View>
  );
}

function SectionHeader({ eyebrow, title, lede }: { eyebrow: string; title: string; lede?: string }) {
  return (
    <View style={S.header}>
      <Text style={S.eyebrow}>{eyebrow}</Text>
      <Text style={S.h1}>{title}</Text>
      {lede ? <Text style={S.lede}>{lede}</Text> : null}
      <View style={S.accentRule} />
    </View>
  );
}

function PageFooter({ caption }: { caption: string }) {
  return <Text style={S.pageNum} fixed>{caption}</Text>;
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
    ['DURATION',        sel.duration],
    ['SHEDDING',        sel.count],
    ['SEVERITY',        sel.grade],
    ['HAIR PATTERN',    sel.hairType],
    ['SCALP',           sel.scalp],
    ['SUSPECTED CAUSE', sel.cause],
    ['LIFESTYLE',       sel.lifestyle],
    ['HORMONAL',        sel.hormonal],
    ['THYROID',         sel.thyroid],
    ['IMMUNITY',        sel.immunity],
    ['DEFICIENCY',      sel.deficiency],
    ['GUT',             sel.gut],
    ['DIET',            sel.diet],
    ['TREATMENTS',      sel.treatment],
    ['GOAL',            sel.goal],
  ];
  const selRows = selRowsRaw.filter(
    ([, v]) => v !== undefined && (Array.isArray(v) ? v.length > 0 : String(v).trim().length > 0)
  );

  return (
    <>
      {/* ── Page 1 — Patient summary + interpretation ────────────────────── */}
      <Page size="A4" style={S.page}>
        <View style={S.identityStrip}>
          <View>
            <Text style={S.eyebrow}>PATIENT SUMMARY</Text>
            <Text style={S.patientName}>{patientSummary.name}</Text>
            <Text style={S.patientMeta}>
              {patientSummary.age} years · {patientSummary.gender}
            </Text>
          </View>
          {patientSummary.goal.length > 0 && (
            <View style={S.patientGoalTag}>
              <Text style={S.patientGoalTagTxt}>
                GOAL · {patientSummary.goal.join(', ').toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Selections — single-column dense key/value rows (layout-safe) */}
        <Text style={S.h2}>Your assessment at a glance</Text>
        <View>
          {selRows.map(([k, v], i) => (
            <View key={i} style={S.selRow} wrap={false}>
              <Text style={S.selKey}>{k}</Text>
              <Text style={S.selVal}>{Array.isArray(v) ? v.join(', ') : v}</Text>
            </View>
          ))}
        </View>

        {/* Clinical interpretation — single column cards */}
        {patientSummary.clinicalInterpretation.length > 0 && (
          <>
            <Text style={S.h2}>Clinical interpretation</Text>
            {patientSummary.clinicalInterpretation.map((ci, i) => (
              <View key={i} style={S.interpCard} wrap={false}>
                <Text style={S.interpTitle}>{ci.signal}</Text>
                <Text style={S.interpBody}>{ci.interpretation}</Text>
              </View>
            ))}
          </>
        )}

        <PageFooter caption="DRFACT · CLINICAL REPORT · PAGE 1" />
      </Page>

      {/* ── Page 2 — Treatment strategy ──────────────────────────────────── */}
      <Page size="A4" style={S.page}>
        <SectionHeader
          eyebrow="PRESCRIBED PROTOCOL"
          title="Treatment Strategy"
          lede="Each kit below addresses a specific layer of your hair-cycle picture. Sequenced for compounding effect — inflammation first, metabolic correction over hormonal, pattern correction last."
        />

        {treatmentStrategy.length === 0 ? (
          <Text style={S.body}>No kits selected.</Text>
        ) : treatmentStrategy.map((p) => (
          <View key={`${p.phase}-${p.kitId}`} style={S.kitCard} wrap={false}>
            <View style={S.kitHeader}>
              <Text style={S.kitName}>{brandNameFor(p.kitId)}</Text>
              <Text style={S.kitDisplay}>{p.displayName}</Text>
            </View>

            <View style={S.kitMetaRow}>
              {p.supportingConditions.length > 0 && (
                <View style={S.kitMetaCol}>
                  <Text style={S.kitMetaKey}>SUPPORTING CONDITIONS</Text>
                  <Text style={S.kitMetaVal}>{p.supportingConditions.join(', ')}</Text>
                </View>
              )}
              {p.keyIngredients.length > 0 && (
                <View style={S.kitMetaCol}>
                  <Text style={S.kitMetaKey}>KEY INGREDIENTS</Text>
                  <Text style={S.kitMetaVal}>{p.keyIngredients.join(', ')}</Text>
                </View>
              )}
            </View>

            {p.mechanismOfAction.length > 0 && (
              <View style={S.mechBlock}>
                <Text style={S.kitMetaKey}>MECHANISM OF ACTION</Text>
                {p.mechanismOfAction.map((m, i) => (<Bullet key={i} text={m} />))}
              </View>
            )}
          </View>
        ))}

        <PageFooter caption="DRFACT · TREATMENT STRATEGY · PAGE 2" />
      </Page>

      {/* ── Page 3 — Topical recommendations ────────────────────────────── */}
      <Page size="A4" style={S.page}>
        <SectionHeader
          eyebrow="OUTSIDE-IN CARE"
          title="Topical Recommendations"
          lede="Targeted topical agents that work alongside your oral protocol."
        />

        {(!topicalRecommendations || topicalRecommendations.length === 0) ? (
          <Text style={S.body}>No topical recommendations for this profile.</Text>
        ) : topicalRecommendations.map((t, i) => (
          <View key={i} style={S.topicalCard} wrap={false}>
            <Text style={S.topicalName}>{t.name}</Text>
            <Text style={S.topicalWhy}>{t.whySelected}</Text>

            <View style={S.topicalRow}>
              <View style={S.topicalCol}>
                <Text style={S.topicalLabel}>HOW TO USE</Text>
                <Text style={S.topicalText}>{t.usage}</Text>
              </View>
              <View style={S.topicalCol}>
                <Text style={S.topicalLabel}>CLINICAL NOTE</Text>
                <Text style={S.topicalText}>{t.note}</Text>
              </View>
            </View>
          </View>
        ))}

        {topicalCautions && topicalCautions.length > 0 && (
          <View style={S.caution} wrap={false}>
            <Text style={S.cautionLabel}>CAUTIONS / CONTRAINDICATIONS</Text>
            {topicalCautions.map((c, i) => (
              <Text key={i} style={S.cautionText}>
                • <Text style={{ fontFamily: 'Helvetica-Bold' }}>{c.name}</Text> — {c.reason}
              </Text>
            ))}
          </View>
        )}

        <PageFooter caption="DRFACT · TOPICAL CARE · PAGE 3" />
      </Page>

      {/* ── Page 4 — Clinical insight story ─────────────────────────────── */}
      {clinicalInsightStory && (
        <Page size="A4" style={S.page}>
          <SectionHeader
            eyebrow="CLINICAL INSIGHT · YOUR STORY"
            title="Clinical insight & recovery story"
            lede="The factors influencing your hair, why they matter, why this plan was selected, and what realistic progress looks like."
          />

          {[
            { eyebrow: 'SECTION 1', title: 'Your hair story',                body: clinicalInsightStory.yourHairStory },
            { eyebrow: 'SECTION 2', title: 'What we found',                  body: clinicalInsightStory.whyThisMayBeHappening },
            { eyebrow: 'SECTION 3', title: 'Your recovery plan',             body: clinicalInsightStory.whyThisPlanWasRecommended },
            { eyebrow: 'SECTION 4', title: 'What recovery could look like',  body: clinicalInsightStory.whatToExpect },
          ].map((s, i) => (
            <View key={i} style={S.storyItem} wrap={false}>
              <View style={S.storyEyebrowRow}>
                <Text style={S.storyEyebrow}>{s.eyebrow}</Text>
                <Text style={S.storyTitle}>{s.title}</Text>
              </View>
              <Text style={S.storyBody}>{s.body}</Text>
            </View>
          ))}

          <PageFooter caption="DRFACT · YOUR STORY · PAGE 4" />
        </Page>
      )}

      {/* ── Page 5 — Recovery milestones + Diet & Lifestyle ─────────────── */}
      <Page size="A4" style={S.page}>
        <SectionHeader
          eyebrow="WHAT TO EXPECT"
          title="Recovery milestones"
          lede="A realistic clinical expectation framework for your recovery journey."
        />

        <View>
          {recoveryMilestones.map((m, i) => (
            <View key={`rm-${i}`} style={S.mlRow} wrap={false}>
              <View style={S.mlBadge}>
                <Text style={S.mlBadgeTxt}>{m.window.toUpperCase()}</Text>
              </View>
              <View style={S.mlBody}>
                {m.bullets.map((b, j) => (
                  <Bullet key={`rm-${i}-${j}`} text={b} />
                ))}
              </View>
            </View>
          ))}
        </View>

        {generalLifestyleGuide && (
          <>
            <Text style={S.h2}>Diet & lifestyle reference</Text>
            <Text style={S.small}>
              Foundational habits that support hair recovery regardless of diagnosis.
            </Text>

            <View style={[S.dietRow, { marginTop: 8 }]}>
              <View style={S.dietColLeft}>
                <Text style={S.dietHeadAmber}>FOODS TO LIMIT (≤ TWICE A WEEK)</Text>
                {generalLifestyleGuide.foodsToAvoid.slice(0, 10).map((f, i) => (
                  <Bullet key={`avoid-${i}`} text={f} />
                ))}
              </View>
              <View style={S.dietColRight}>
                <Text style={S.dietHeadTeal}>FOODS TO EMBRACE</Text>
                {generalLifestyleGuide.foodsToAdd.slice(0, 10).map((f, i) => (
                  <Bullet key={`add-${i}`} text={f} />
                ))}
              </View>
            </View>

            <View style={S.lifestyleBox}>
              <Text style={S.lifestyleHead}>DAILY LIFESTYLE · CONSISTENCY WINS</Text>
              {generalLifestyleGuide.lifestyleRecommendations.map((l, i) => (
                <Bullet key={`life-${i}`} text={l} />
              ))}
            </View>
          </>
        )}

        <PageFooter caption="DRFACT · ROADMAP & GUIDANCE · PAGE 5" />
      </Page>
    </>
  );
}
