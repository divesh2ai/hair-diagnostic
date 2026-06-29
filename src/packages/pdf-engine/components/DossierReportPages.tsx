import React from 'react';
import { Page, Text, View, StyleSheet, Svg, Defs, LinearGradient, Stop, Rect, Circle } from '@react-pdf/renderer';
import type { ClinicalReport } from '../../ai-engine/report-engine/types';
import { composeNarrativeV3 } from '../../ai-engine/report-engine/v3';

/**
 * Patient PDF — mirrors the on-screen ClinicalReportView section order.
 *
 *   1. Hero (name, age, gender, goal)
 *   2. Questionnaire selections
 *   3. Clinical summary & interpretation
 *   4. Recommended recovery protocol  (kit + therapeuticFocus — no
 *      formulation/ingredient mechanism)
 *   5. Topical recommendations
 *   6. Clinical Insight & Recovery Story (4 sub-sections)
 *   7. Recovery milestones
 *   8. General guidance — diet & lifestyle  (foods to add + lifestyle
 *      habits — no foods-to-avoid panel)
 *   9. Footer note
 */

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  inkDeep:   '#07111F',
  body:      '#E9EFF6',
  bodyDim:   '#A8B5C4',
  bodyMute:  '#8A99AB',
  faint:     '#5F7488',
  hairline:  '#1B3550',
  teal:      '#00C2A8',
  gold:      '#F4B942',
  green:     '#22C55E',
  greenSoft: '#0E3A22',
  red:       '#EF6F6C',
  blue:      '#60A5FA',
  violet:    '#A78BFA',
};

const DRIVER_TONES: { match: RegExp; tone: string }[] = [
  { match: /hormon|androgen|dht|estrog|thyroid|cortisol/i, tone: C.gold },
  { match: /nutrient|iron|ferritin|vitamin|protein|deficien/i, tone: C.green },
  { match: /inflamm|scalp|sebum|microbiome|dermatit/i, tone: C.red },
  { match: /circul|micro.?circ|blood|perfusion|vascular/i, tone: C.blue },
  { match: /oxid|stress|free.?radical|antioxidant/i, tone: C.violet },
  { match: /genetic|pattern|aga|follicle|miniatur|gut|absorpt/i, tone: C.teal },
];
function toneFor(name: string, i: number) {
  const found = DRIVER_TONES.find((d) => d.match.test(name));
  if (found) return found.tone;
  return [C.teal, C.gold, C.green, C.blue, C.violet, C.red][i % 6];
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    paddingTop: 0, paddingBottom: 0, paddingHorizontal: 0,
    backgroundColor: C.inkDeep,
    color: C.body,
    fontFamily: 'Helvetica',
    position: 'relative',
  },
  bgSvg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  content: { paddingHorizontal: 44, paddingTop: 48, paddingBottom: 60 },

  // Section header
  eyebrow: {
    fontSize: 8.5, letterSpacing: 3.5,
    color: C.teal, fontFamily: 'Helvetica-Bold',
    marginBottom: 12,
  },
  title: {
    fontSize: 34, color: C.body, fontFamily: 'Helvetica-Bold',
    letterSpacing: -1, lineHeight: 1,
  },
  titleAccent: {
    fontSize: 34, color: 'rgba(233,239,246,0.42)',
    fontFamily: 'Helvetica-Bold', letterSpacing: -1, lineHeight: 1,
    marginTop: 2,
  },
  rule: { height: 1.5, width: 44, backgroundColor: C.teal, marginTop: 16, marginBottom: 12 },
  lede: { fontSize: 11, color: C.bodyDim, lineHeight: 1.6, maxWidth: 430 },

  // Hero meta
  meta: {
    flexDirection: 'row', alignItems: 'baseline',
    marginTop: 22, marginBottom: 4,
    paddingBottom: 12,
    borderBottomWidth: 0.5, borderBottomColor: C.hairline,
  },
  metaName: { fontSize: 22, color: C.body, fontFamily: 'Helvetica-Bold', letterSpacing: -0.4 },
  metaSub: { marginLeft: 12, fontSize: 10, color: C.bodyMute, letterSpacing: 1 },

  // Questionnaire grid
  qsGrid: {
    marginTop: 14,
    flexDirection: 'row', flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  qsCell: {
    width: '33.333%',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  qsCellInner: {
    borderRadius: 10,
    borderWidth: 0.5, borderColor: C.hairline,
    backgroundColor: 'rgba(255,255,255,0.025)',
    padding: 10,
    minHeight: 50,
  },
  qsLabel: {
    fontSize: 6.5, letterSpacing: 1.8,
    color: C.bodyMute, fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  qsValue: { fontSize: 9.5, color: C.body, lineHeight: 1.4 },

  // Findings
  findingsHead: {
    fontSize: 8, letterSpacing: 2.5, color: C.teal,
    fontFamily: 'Helvetica-Bold', marginTop: 4, marginBottom: 10,
  },
  finding: {
    flexDirection: 'row',
    marginBottom: 9,
    borderRadius: 10,
    borderWidth: 0.5, borderColor: C.hairline,
    backgroundColor: 'rgba(255,255,255,0.02)',
    overflow: 'hidden',
  },
  findingTone: { width: 3 },
  findingBody: { flex: 1, paddingVertical: 10, paddingHorizontal: 14 },
  findingTitle: { fontSize: 12, color: C.body, fontFamily: 'Helvetica-Bold', letterSpacing: -0.2 },
  findingText: { fontSize: 9.5, color: C.bodyDim, lineHeight: 1.5, marginTop: 3 },
  findingMeta: { fontSize: 7, letterSpacing: 1.8, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  findingTagWrap: { flexDirection: 'row', marginTop: 4 },
  findingTag: {
    fontSize: 7, letterSpacing: 1.5,
    color: C.teal, fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 8, backgroundColor: 'rgba(0,194,168,0.12)',
  },

  // Kit card
  kit: {
    marginBottom: 14,
    borderRadius: 12,
    borderWidth: 0.5, borderColor: C.hairline,
    backgroundColor: 'rgba(255,255,255,0.025)',
    padding: 16,
  },
  kitHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  kitPhase: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 10, backgroundColor: C.greenSoft, marginRight: 10,
  },
  kitPhaseTxt: {
    fontSize: 7, letterSpacing: 1.8,
    color: C.green, fontFamily: 'Helvetica-Bold',
  },
  kitName: { flex: 1, fontSize: 15, color: C.body, fontFamily: 'Helvetica-Bold', letterSpacing: -0.3 },
  kitWhyLabel: {
    fontSize: 7, letterSpacing: 1.8,
    color: C.teal, fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  kitWhy: { fontSize: 10, color: C.body, lineHeight: 1.55, marginBottom: 12 },
  kitFocusLabel: {
    fontSize: 7, letterSpacing: 1.8,
    color: C.gold, fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
  },
  kitFocusRow: { flexDirection: 'row', marginBottom: 4 },
  kitFocusDot: { fontSize: 9, color: C.teal, marginRight: 6, lineHeight: 1.5 },
  kitFocusTxt: { flex: 1, fontSize: 9.5, color: C.body, lineHeight: 1.5 },

  // Topical card
  topical: {
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 0.5, borderColor: C.hairline,
    backgroundColor: 'rgba(255,255,255,0.025)',
    padding: 14,
  },
  topicalName: { fontSize: 13, color: C.body, fontFamily: 'Helvetica-Bold', letterSpacing: -0.2 },
  topicalWhy: { fontSize: 9.5, color: C.bodyDim, lineHeight: 1.5, marginTop: 4, marginBottom: 8 },
  topicalSubLabel: {
    fontSize: 6.5, letterSpacing: 1.8,
    color: C.bodyMute, fontFamily: 'Helvetica-Bold',
    marginTop: 4, marginBottom: 2,
  },
  topicalSubTxt: { fontSize: 9, color: C.body, lineHeight: 1.45 },

  // Cautions
  caution: {
    marginTop: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 0.5, borderColor: C.hairline,
    backgroundColor: 'rgba(239,111,108,0.07)',
  },
  cautionHead: {
    fontSize: 8, letterSpacing: 2.2,
    color: C.red, fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
  },
  cautionRow: { flexDirection: 'row', marginTop: 4 },
  cautionDot: { fontSize: 9, color: C.red, marginRight: 6, lineHeight: 1.5 },
  cautionTxt: { flex: 1, fontSize: 9.5, color: C.body, lineHeight: 1.5 },

  // Insight story
  story: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 0.5, borderColor: C.hairline,
    backgroundColor: 'rgba(255,255,255,0.025)',
    padding: 18,
  },
  storyItem: { marginBottom: 14 },
  storyEyebrow: {
    fontSize: 7, letterSpacing: 1.8,
    color: C.teal, fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  storyTitle: { fontSize: 12, color: C.body, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  storyBody: { fontSize: 10, color: C.bodyDim, lineHeight: 1.65 },

  // Milestones
  milestone: {
    flexDirection: 'row',
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 0.5, borderColor: C.hairline,
    backgroundColor: 'rgba(255,255,255,0.025)',
    overflow: 'hidden',
  },
  milestoneLabelBox: {
    width: 96,
    paddingVertical: 14, paddingHorizontal: 12,
    backgroundColor: 'rgba(0,194,168,0.10)',
    justifyContent: 'center',
  },
  milestoneLabel: {
    fontSize: 11, fontFamily: 'Helvetica-Bold',
    color: C.teal, letterSpacing: 0.4,
  },
  milestoneBody: { flex: 1, padding: 14 },
  milestoneRow: { flexDirection: 'row', marginBottom: 4 },
  milestoneDot: { fontSize: 9, color: C.teal, marginRight: 6, lineHeight: 1.5 },
  milestoneTxt: { flex: 1, fontSize: 9.5, color: C.body, lineHeight: 1.5 },

  // Diet guidance
  dietGroup: { marginTop: 18 },
  dietGroupHead: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 8,
  },
  dietGroupBar: { width: 4, height: 16, borderRadius: 2, marginRight: 8 },
  dietGroupTitle: {
    fontSize: 11, fontFamily: 'Helvetica-Bold',
    color: C.body, letterSpacing: 0.4, textTransform: 'uppercase',
  },
  dietTagline: {
    fontSize: 9, color: C.bodyMute, lineHeight: 1.5,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  dietRow: { flexDirection: 'row', marginBottom: 4 },
  dietDot: { fontSize: 9, marginRight: 6, lineHeight: 1.5 },
  dietTxt: { flex: 1, fontSize: 9.5, color: C.body, lineHeight: 1.5 },

  // Footer note
  footerNote: {
    marginTop: 18,
    padding: 14,
    borderRadius: 10,
    borderWidth: 0.5, borderColor: C.hairline,
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  footerNoteTxt: {
    fontSize: 9, color: C.bodyDim,
    lineHeight: 1.6, textAlign: 'center',
  },

  // Page footer
  footer: {
    position: 'absolute',
    bottom: 26, left: 44, right: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerTxt: {
    fontSize: 7.5, letterSpacing: 2,
    color: C.faint, fontFamily: 'Helvetica-Bold',
  },
});

// ─── Backdrop ────────────────────────────────────────────────────────────────
function Backdrop({ accent = C.teal, secondary = C.gold }: { accent?: string; secondary?: string }) {
  return (
    <Svg style={S.bgSvg} viewBox="0 0 595 842" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#07111F" />
          <Stop offset="0.6" stopColor="#0A2540" />
          <Stop offset="1" stopColor="#0F2E4A" />
        </LinearGradient>
        <LinearGradient id="bgA" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={accent} stopOpacity="0.18" />
          <Stop offset="1" stopColor={accent} stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id="bgB" x1="1" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor={secondary} stopOpacity="0.1" />
          <Stop offset="1" stopColor={secondary} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="595" height="842" fill="url(#bg)" />
      <Circle cx="520" cy="120" r="200" fill="url(#bgA)" />
      <Circle cx="60"  cy="720" r="220" fill="url(#bgB)" />
    </Svg>
  );
}

function Footer({ caption }: { caption: string }) {
  return (
    <View style={S.footer} fixed>
      <Text style={S.footerTxt}>HAIROS · DOSSIER</Text>
      <Text style={S.footerTxt}>{caption}</Text>
    </View>
  );
}

function SectionHeader({ eyebrow, title, accent, lede }: {
  eyebrow: string; title: string; accent?: string; lede?: string;
}) {
  return (
    <View>
      <Text style={S.eyebrow}>{eyebrow.toUpperCase()}</Text>
      <Text style={S.title}>{title}</Text>
      {accent ? <Text style={S.titleAccent}>{accent}</Text> : null}
      <View style={S.rule} />
      {lede ? <Text style={S.lede}>{lede}</Text> : null}
    </View>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export function DossierReportPages({ report }: { report: ClinicalReport }) {
  const {
    patientSummary,
    topicalRecommendations,
    topicalCautions,
    clinicalInsightStory,
    recoveryMilestones,
    generalLifestyleGuide,
  } = report;

  // V3 narrative gives us patient-voiced kit cards: whySelected + therapeuticFocus.
  // Formulation/ingredient mechanism is intentionally NOT rendered per spec.
  const narrative = composeNarrativeV3(report);
  const kits = narrative.recommendedKits;

  const name = patientSummary?.name ?? 'Patient';
  const ageGender = [patientSummary?.age, patientSummary?.gender]
    .filter(Boolean).join(' · ');
  const goal = (patientSummary?.goal ?? []).join(', ');

  // Questionnaire rows
  const sel = patientSummary?.questionnaireSelections ?? {};
  const qsRows: Array<[string, string | undefined]> = [
    ['Duration',             toStr(sel.duration)],
    ['Shedding intensity',   toStr(sel.count)],
    ['Severity grade',       toStr(sel.grade)],
    ['Hair pattern',         toStr(sel.hairType)],
    ['Scalp',                toStr(sel.scalp)],
    ['Suspected cause',      toStr(sel.cause)],
    ['Lifestyle',            toStr(sel.lifestyle)],
    ['Hormonal',             toStr(sel.hormonal)],
    ['Thyroid',              toStr(sel.thyroid)],
    ['Immunity',             toStr(sel.immunity)],
    ['Deficiency',           toStr(sel.deficiency)],
    ['Gut',                  toStr(sel.gut)],
    ['Diet',                 toStr(sel.diet)],
    ['Previous treatments',  toStr(sel.treatment)],
    ['Goal',                 toStr(sel.goal)],
  ].filter(([, v]) => v && v.trim().length > 0) as Array<[string, string]>;

  const interpretations = patientSummary?.clinicalInterpretation ?? [];

  const insightSections = clinicalInsightStory?.yourHairStory ? [
    { eyebrow: 'Section 1', title: 'Your hair story',               body: clinicalInsightStory.yourHairStory },
    { eyebrow: 'Section 2', title: 'What we found',                 body: clinicalInsightStory.whyThisMayBeHappening },
    { eyebrow: 'Section 3', title: 'Your recovery plan',            body: clinicalInsightStory.whyThisPlanWasRecommended },
    { eyebrow: 'Section 4', title: 'What recovery could look like', body: clinicalInsightStory.whatToExpect },
  ] : [];

  const foodsAdd = generalLifestyleGuide?.foodsToAdd ?? [];
  const habits   = generalLifestyleGuide?.lifestyleRecommendations ?? [];

  return (
    <>
      {/* ── 1. Patient Summary (hero + questionnaire selections) ────────── */}
      <Page size="A4" style={S.page}>
        <Backdrop accent={C.teal} secondary={C.gold} />
        <View style={S.content}>
          <SectionHeader
            eyebrow="Personalised clinical report"
            title="Your Clinical"
            accent="Snapshot."
            lede="A consolidated view of the selections you shared and the clinical patterns they point to."
          />

          <View style={S.meta}>
            <Text style={S.metaName}>{name}</Text>
            {ageGender ? <Text style={S.metaSub}>{ageGender}</Text> : null}
          </View>
          {goal ? (
            <Text style={[S.lede, { marginTop: 6 }]}>
              <Text style={{ color: C.bodyMute }}>Goal · </Text>
              <Text style={{ color: C.body }}>{goal}</Text>
            </Text>
          ) : null}

          {qsRows.length > 0 && (
            <>
              <Text style={[S.findingsHead, { marginTop: 22 }]}>YOUR ASSESSMENT</Text>
              <View style={S.qsGrid}>
                {qsRows.map(([label, value]) => (
                  <View key={label} style={S.qsCell}>
                    <View style={S.qsCellInner}>
                      <Text style={S.qsLabel}>{label.toUpperCase()}</Text>
                      <Text style={S.qsValue}>{value}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
        <Footer caption="PATIENT SUMMARY" />
      </Page>

      {/* ── 2. Clinical Summary & Interpretation ──────────────────────── */}
      {interpretations.length > 0 && (
        <Page size="A4" style={S.page}>
          <Backdrop accent={C.teal} secondary={C.violet} />
          <View style={S.content}>
            <SectionHeader
              eyebrow="What we noticed"
              title="Clinical Summary"
              accent="& Interpretation."
              lede="Each selection you made was reviewed and matched to the most likely clinical pattern. Here is how those signals translate into hair-cycle terms."
            />
            <View style={{ marginTop: 18 }}>
              {interpretations.map((item, i) => {
                const tone = toneFor(item.condition ?? item.signal, i);
                return (
                  <View key={`ci-${i}`} style={S.finding} wrap={false}>
                    <View style={[S.findingTone, { backgroundColor: tone }]} />
                    <View style={S.findingBody}>
                      <Text style={S.findingTitle}>{item.signal}</Text>
                      {item.condition ? (
                        <View style={S.findingTagWrap}>
                          <Text style={S.findingTag}>{item.condition.toUpperCase()}</Text>
                        </View>
                      ) : null}
                      <Text style={S.findingText}>{item.interpretation}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
          <Footer caption="CLINICAL INTERPRETATION" />
        </Page>
      )}

      {/* ── 3. Recommended Recovery Protocol (kits — no formulation) ───── */}
      <Page size="A4" style={S.page}>
        <Backdrop accent={C.green} secondary={C.teal} />
        <View style={S.content}>
          <SectionHeader
            eyebrow="The protocol"
            title={kits.heading}
            lede={kits.intro}
          />
          <View style={{ marginTop: 18 }}>
            {kits.kits.length === 0 ? (
              <View style={S.kit}>
                <Text style={S.kitWhy}>Protocol composition in progress.</Text>
              </View>
            ) : kits.kits.map((k, i) => (
              <View key={`kit-${i}`} style={S.kit} wrap={false}>
                <View style={S.kitHead}>
                  <View style={S.kitPhase}>
                    <Text style={S.kitPhaseTxt}>PHASE {i + 1}</Text>
                  </View>
                  <Text style={S.kitName}>{k.name}</Text>
                </View>
                {k.whySelected ? (
                  <>
                    <Text style={S.kitWhyLabel}>WHY THIS KIT WAS SELECTED</Text>
                    <Text style={S.kitWhy}>{k.whySelected}</Text>
                  </>
                ) : null}
                {k.therapeuticFocus.length > 0 ? (
                  <>
                    <Text style={S.kitFocusLabel}>THERAPEUTIC FOCUS · KIT MECHANISM</Text>
                    {k.therapeuticFocus.map((f, j) => (
                      <View key={`focus-${i}-${j}`} style={S.kitFocusRow}>
                        <Text style={S.kitFocusDot}>›</Text>
                        <Text style={S.kitFocusTxt}>{f}</Text>
                      </View>
                    ))}
                  </>
                ) : null}
              </View>
            ))}
          </View>
        </View>
        <Footer caption="RECOMMENDED PROTOCOL" />
      </Page>

      {/* ── 4. Topical Recommendations ──────────────────────────────────── */}
      {topicalRecommendations.length > 0 && (
        <Page size="A4" style={S.page}>
          <Backdrop accent={C.violet} secondary={C.teal} />
          <View style={S.content}>
            <SectionHeader
              eyebrow="Outside-in care"
              title="Topical"
              accent="Recommendations."
            />
            <View style={{ marginTop: 18 }}>
              {topicalRecommendations.map((t, i) => (
                <View key={`top-${i}`} style={S.topical} wrap={false}>
                  <Text style={S.topicalName}>{t.name}</Text>
                  <Text style={S.topicalWhy}>{t.whySelected}</Text>
                  <Text style={S.topicalSubLabel}>HOW TO USE</Text>
                  <Text style={S.topicalSubTxt}>{t.usage}</Text>
                  <Text style={S.topicalSubLabel}>CLINICAL NOTE</Text>
                  <Text style={[S.topicalSubTxt, { fontStyle: 'italic', color: C.bodyDim }]}>{t.note}</Text>
                </View>
              ))}
              {topicalCautions && topicalCautions.length > 0 && (
                <View style={S.caution} wrap={false}>
                  <Text style={S.cautionHead}>IMPORTANT CAUTIONS</Text>
                  {topicalCautions.map((c, i) => (
                    <View key={`cau-${i}`} style={S.cautionRow}>
                      <Text style={S.cautionDot}>•</Text>
                      <Text style={S.cautionTxt}>
                        <Text style={{ fontFamily: 'Helvetica-Bold' }}>{c.name}</Text>
                        {' — '}{c.reason}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
          <Footer caption="TOPICAL CARE" />
        </Page>
      )}

      {/* ── 5. Clinical Insight & Recovery Story ────────────────────────── */}
      {insightSections.length > 0 && (
        <Page size="A4" style={S.page}>
          <Backdrop accent={C.gold} secondary={C.teal} />
          <View style={S.content}>
            <SectionHeader
              eyebrow="Clinical insight · your story"
              title="Clinical Insight"
              accent="& Recovery Story."
              lede="Based on what you shared with us — the factors that may be influencing your hair, why they matter, why this plan was selected, and what realistic progress could look like."
            />
            <View style={S.story}>
              {insightSections.map((s, i) => (
                <View key={s.eyebrow} style={[S.storyItem, i === insightSections.length - 1 ? { marginBottom: 0 } : null]} wrap={false}>
                  <Text style={S.storyEyebrow}>{s.eyebrow.toUpperCase()}</Text>
                  <Text style={S.storyTitle}>{s.title}</Text>
                  <Text style={S.storyBody}>{s.body}</Text>
                </View>
              ))}
            </View>
          </View>
          <Footer caption="CLINICAL INSIGHT" />
        </Page>
      )}

      {/* ── 6. Recovery Milestones ──────────────────────────────────────── */}
      {recoveryMilestones && recoveryMilestones.length > 0 && (
        <Page size="A4" style={S.page}>
          <Backdrop accent={C.teal} secondary={C.green} />
          <View style={S.content}>
            <SectionHeader
              eyebrow="The road ahead"
              title="Recovery"
              accent="Milestones."
              lede="A realistic clinical expectation framework for your recovery journey."
            />
            <View style={{ marginTop: 18 }}>
              {recoveryMilestones.map((m, i) => (
                <View key={`ms-${i}`} style={S.milestone} wrap={false}>
                  <View style={S.milestoneLabelBox}>
                    <Text style={S.milestoneLabel}>{m.window}</Text>
                  </View>
                  <View style={S.milestoneBody}>
                    {m.bullets.map((b, j) => (
                      <View key={`mb-${i}-${j}`} style={S.milestoneRow}>
                        <Text style={S.milestoneDot}>•</Text>
                        <Text style={S.milestoneTxt}>{b}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </View>
          <Footer caption="RECOVERY MILESTONES" />
        </Page>
      )}

      {/* ── 7. General Guidance — Diet & Lifestyle (no foods-to-avoid) ── */}
      <Page size="A4" style={S.page}>
        <Backdrop accent={C.gold} secondary={C.green} />
        <View style={S.content}>
          <SectionHeader
            eyebrow="General guidance"
            title="Diet & Lifestyle"
            accent="Reference."
            lede="The foundational habits that support hair recovery alongside your protocol. Small, consistent daily inputs decide how much of the recovery you actually keep."
          />

          {foodsAdd.length > 0 && (
            <View style={S.dietGroup}>
              <View style={S.dietGroupHead}>
                <View style={[S.dietGroupBar, { backgroundColor: C.green }]} />
                <Text style={S.dietGroupTitle}>Foods to embrace</Text>
              </View>
              <Text style={S.dietTagline}>
                Rotate these through the week — they supply iron, amino acids and antioxidants the follicle needs.
              </Text>
              {foodsAdd.map((item, i) => (
                <View key={`add-${i}`} style={S.dietRow}>
                  <Text style={[S.dietDot, { color: C.green }]}>+</Text>
                  <Text style={S.dietTxt}>{item}</Text>
                </View>
              ))}
            </View>
          )}

          {habits.length > 0 && (
            <View style={S.dietGroup}>
              <View style={S.dietGroupHead}>
                <View style={[S.dietGroupBar, { backgroundColor: C.teal }]} />
                <Text style={S.dietGroupTitle}>Daily lifestyle</Text>
              </View>
              <Text style={S.dietTagline}>Consistency wins. These are the non-negotiables.</Text>
              {habits.map((item, i) => (
                <View key={`hab-${i}`} style={S.dietRow}>
                  <Text style={[S.dietDot, { color: C.teal }]}>•</Text>
                  <Text style={S.dietTxt}>{item}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={S.footerNote}>
            <Text style={S.footerNoteTxt}>
              This report has been prepared from the information you provided in
              your assessment. Discuss any changes to your routine, supplements
              or medications with your treating doctor before starting.
            </Text>
          </View>
        </View>
        <Footer caption="DIET & LIFESTYLE" />
      </Page>
    </>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toStr(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  if (Array.isArray(v)) return v.length ? v.join(', ') : undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}
