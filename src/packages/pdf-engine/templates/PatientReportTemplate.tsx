import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { ReportInputPayload } from '../types';
import { CinematicCover } from '../components/CinematicCover';
import { VisualEducationBlock } from '../components/VisualEducationBlock';
import { PatientClinicalSummary } from '../components/PatientClinicalSummary';
import { AdjunctProtocolSection } from '../components/AdjunctProtocolSection';

// ─── Phase colour palette ─────────────────────────────────────────────────────

const PHASE_COLORS: Record<number, { bg: string; text: string; badge: string }> = {
  1: { bg: '#FFF7ED', text: '#EA580C', badge: '#EA580C' },
  2: { bg: '#F0F9FF', text: '#0369A1', badge: '#0369A1' },
  3: { bg: '#F5F3FF', text: '#7C3AED', badge: '#7C3AED' },
  4: { bg: '#ECFDF5', text: '#059669', badge: '#059669' },
  5: { bg: '#FFF1F2', text: '#BE123C', badge: '#BE123C' },
  6: { bg: '#FEFCE8', text: '#CA8A04', badge: '#CA8A04' },
  7: { bg: '#F0FDF4', text: '#15803D', badge: '#15803D' },
};

function phaseColor(phase: number) {
  return PHASE_COLORS[phase] ?? { bg: '#F8FAFC', text: '#0F172A', badge: '#64748B' };
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    padding: 50,
    backgroundColor: '#FFFFFF',
    fontFamily: 'Helvetica',
  },

  // Section header
  sectionEyebrow: {
    fontSize: 9,
    color: '#94A3B8',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    marginBottom: 6,
  },
  sectionDesc: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 28,
    lineHeight: 1.5,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 20,
  },

  // Phase kit card
  phaseCard: {
    borderRadius: 10,
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  phaseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  phaseBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  phaseBadgeText: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
  },
  phaseHeaderText: {
    flex: 1,
  },
  phaseKitName: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
  },
  phaseScore: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 2,
  },
  phaseCardBody: {
    paddingLeft: 14,
    paddingRight: 14,
    paddingBottom: 14,
  },
  needsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  needTag: {
    borderRadius: 4,
    paddingTop: 3,
    paddingBottom: 3,
    paddingLeft: 7,
    paddingRight: 7,
    marginRight: 5,
    marginBottom: 4,
  },
  needTagText: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  reasonText: {
    fontSize: 10,
    color: '#475569',
    lineHeight: 1.55,
    marginBottom: 3,
  },

  // Protocol rationale card
  rationaleCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 4,
  },
  rationaleTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    marginBottom: 6,
  },
  rationaleBody: {
    fontSize: 10,
    color: '#64748B',
    lineHeight: 1.55,
  },

  // Recovery roadmap
  milestoneCard: {
    flexDirection: 'row',
    marginBottom: 12,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  milestoneLabel: {
    width: 72,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneLabelText: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  milestoneBody: {
    flex: 1,
    padding: 14,
    backgroundColor: '#F8FAFC',
  },
  milestoneTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  milestoneDesc: {
    fontSize: 10,
    color: '#475569',
    lineHeight: 1.55,
  },
  recoveryNote: {
    marginTop: 16,
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  recoveryNoteText: {
    fontSize: 10,
    color: '#78350F',
    lineHeight: 1.6,
  },

  // Visual section
  body: {
    fontSize: 10,
    color: '#334155',
    lineHeight: 1.4,
  },
  muted: {
    fontSize: 10,
    color: '#64748B',
    lineHeight: 1.4,
  },
});

// ─── Template ─────────────────────────────────────────────────────────────────

export const PatientReportTemplate = ({
  payload,
}: {
  payload: ReportInputPayload;
}) => {
  // Guard every optional field — artifacts may arrive as null / {} when
  // orchestration hasn't persisted them yet.
  const kits = Array.isArray(payload.kitRecommendation?.rankedKits)
    ? payload.kitRecommendation!.rankedKits
    : [];
  const sections = Array.isArray(payload.visualJourney?.sections)
    ? payload.visualJourney.sections
    : [];

  return (
    <Document>
      {/* ── 1. Cover ─────────────────────────────────────────────────────── */}
      <Page size="A4">
        <CinematicCover
          patient={payload.patient}
          clinic={payload.clinic}
          doctor={payload.doctor}
          date={payload.createdAt}
        />
      </Page>

      {/* ── 2. Patient Clinical Summary (new) ────────────────────────────── */}
      <Page size="A4">
        <PatientClinicalSummary
          patient={payload.patient}
          profile={payload.clinicalProfile}
        />
      </Page>

      {/* ── 3. Visual Journey Sections ───────────────────────────────────── */}
      {sections.map((section, idx) => (
        <Page size="A4" style={S.page} key={idx}>
          <Text style={S.sectionTitle}>{section.defaultTitle ?? ''}</Text>
          <Text style={S.sectionDesc}>{section.defaultDescription ?? ''}</Text>
          {(Array.isArray(section.visuals) ? section.visuals : []).map((asset) => (
            <View key={asset.id}>
              <VisualEducationBlock asset={asset} />
            </View>
          ))}
        </Page>
      ))}

      {/* ── 4. Personalized Treatment Protocol ──────────────────────────── */}
      <Page size="A4" style={S.page}>
        <Text style={S.sectionEyebrow}>PRESCRIBED PROTOCOL</Text>
        <Text style={S.sectionTitle}>Your Treatment Plan</Text>
        <Text style={S.sectionDesc}>
          {payload.kitRecommendation?.protocolRationale ??
            'Your protocol is generated from your assessment signals and clinician rules.'}
        </Text>
        <View style={S.divider} />

        {kits.length === 0 ? (
          <View style={S.rationaleCard}>
            <Text style={S.rationaleTitle}>Protocol pending</Text>
            <Text style={S.rationaleBody}>
              Your kit recommendations are still being prepared.
            </Text>
          </View>
        ) : (
          kits.map((kit) => {
            const colors = phaseColor(kit.phase);
            return (
              <View
                style={S.phaseCard}
                key={`${kit.phase}-${kit.kitId}`}
              >
                {/* Card header */}
                <View
                  style={[
                    S.phaseCardHeader,
                    { backgroundColor: colors.bg },
                  ]}
                >
                  <View
                    style={[
                      S.phaseBadge,
                      { backgroundColor: colors.badge },
                    ]}
                  >
                    <Text style={S.phaseBadgeText}>{kit.phase}</Text>
                  </View>
                  <View style={S.phaseHeaderText}>
                    <Text style={[S.phaseKitName, { color: colors.text }]}>
                      {kit.kitId}
                    </Text>
                    <Text style={S.phaseScore}>
                      Match score: {kit.score} / 100
                    </Text>
                  </View>
                </View>

                {/* Card body */}
                <View style={S.phaseCardBody}>
                  {/* Need tags */}
                  {kit.matchedNeeds.length > 0 && (
                    <View style={S.needsRow}>
                      {kit.matchedNeeds.map((need, ni) => (
                        <View
                          key={ni}
                          style={[
                            S.needTag,
                            { backgroundColor: colors.bg },
                          ]}
                        >
                          <Text
                            style={[
                              S.needTagText,
                              { color: colors.text },
                            ]}
                          >
                            {need}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Reasons */}
                  {kit.reasons.map((reason, ri) => (
                    <Text
                      style={S.reasonText}
                      key={`${kit.kitId}-r-${ri}`}
                    >
                      {'•'} {reason}
                    </Text>
                  ))}
                </View>
              </View>
            );
          })
        )}

        {/* Protocol justification */}
        {payload.kitRecommendation?.selectionJustification && (
          <View style={S.rationaleCard}>
            <Text style={S.rationaleTitle}>
              Why this protocol was selected
            </Text>
            <Text style={S.rationaleBody}>
              {payload.kitRecommendation.selectionJustification}
            </Text>
          </View>
        )}
      </Page>

      {/* ── 5. Adjunct Protocol (scalp correction, follicular support, barrier repair) ── */}
      {payload.kitRecommendation?.adjunctProtocol && (
        (() => {
          const adj = payload.kitRecommendation!.adjunctProtocol;
          const hasAdjunct =
            (adj.scalpCorrection?.length ?? 0) > 0 ||
            (adj.follicularSupport?.length ?? 0) > 0 ||
            (adj.barrierRepair?.length ?? 0) > 0;
          if (!hasAdjunct) return null;
          return (
            <Page size="A4" style={S.page}>
              <AdjunctProtocolSection adjunctProtocol={adj} />
            </Page>
          );
        })()
      )}

      {/* ── 6. Recovery Roadmap ──────────────────────────────────────────── */}
      <Page size="A4" style={S.page}>
        <Text style={S.sectionEyebrow}>WHAT TO EXPECT</Text>
        <Text style={S.sectionTitle}>Your Recovery Roadmap</Text>
        <Text style={S.sectionDesc}>
          Hair recovery is a marathon, not a sprint. Here is what to expect at
          each milestone.
        </Text>
        <View style={S.divider} />

        {/* Week 4 */}
        <View style={S.milestoneCard}>
          <View style={[S.milestoneLabel, { backgroundColor: '#0369A1' }]}>
            <Text style={S.milestoneLabelText}>Week{'\n'}4</Text>
          </View>
          <View style={S.milestoneBody}>
            <Text style={S.milestoneTitle}>Foundation</Text>
            <Text style={S.milestoneDesc}>
              Active shedding begins to reduce. Scalp sensitivity decreases as
              cortisol load drops and ferritin levels start recovering above the
              follicle threshold.
            </Text>
          </View>
        </View>

        {/* Week 8 */}
        <View style={S.milestoneCard}>
          <View style={[S.milestoneLabel, { backgroundColor: '#0369A1' }]}>
            <Text style={S.milestoneLabelText}>Week{'\n'}8</Text>
          </View>
          <View style={S.milestoneBody}>
            <Text style={S.milestoneTitle}>Stabilisation</Text>
            <Text style={S.milestoneDesc}>
              Shedding volume reduces 40–60%. Scalp microenvironment becomes less
              androgenic. Hair feels less fragile at the root.
            </Text>
          </View>
        </View>

        {/* Month 1–2: Reset */}
        <View style={S.milestoneCard}>
          <View style={[S.milestoneLabel, { backgroundColor: '#7C3AED' }]}>
            <Text style={S.milestoneLabelText}>Month{'\n'}1–2</Text>
          </View>
          <View style={S.milestoneBody}>
            <Text style={S.milestoneTitle}>The Reset Phase</Text>
            <Text style={S.milestoneDesc}>
              You may notice increased shedding early on as dormant hairs are
              pushed out by new cellular growth. This is normal and expected.
            </Text>
          </View>
        </View>

        {/* Month 3–6: Regrowth */}
        <View style={S.milestoneCard}>
          <View style={[S.milestoneLabel, { backgroundColor: '#059669' }]}>
            <Text style={S.milestoneLabelText}>Month{'\n'}3–6</Text>
          </View>
          <View style={S.milestoneBody}>
            <Text style={S.milestoneTitle}>The Regrowth Phase</Text>
            <Text style={S.milestoneDesc}>
              Baby hairs begin emerging. Thinning areas start feeling denser to
              the touch. Parting width visibly narrows as DHT load reduces.
            </Text>
          </View>
        </View>

        {/* Month 6–12: Recovery */}
        <View style={S.milestoneCard}>
          <View style={[S.milestoneLabel, { backgroundColor: '#15803D' }]}>
            <Text style={S.milestoneLabelText}>Month{'\n'}6–12</Text>
          </View>
          <View style={S.milestoneBody}>
            <Text style={S.milestoneTitle}>Full Recovery</Text>
            <Text style={S.milestoneDesc}>
              Density visibly improved. Terminal hair recovery in previously
              thinning zones. Follicle cycle normalises for sustained results.
            </Text>
          </View>
        </View>

        {/* Recovery modifier note */}
        <View style={S.recoveryNote}>
          <Text style={S.recoveryNoteText}>
            Important: Lifestyle factors such as smoking, alcohol, and unmanaged
            blood sugar are recovery modifiers. Each active risk factor extends
            the visible results timeline by 4–6 weeks. Addressing these is as
            important as the supplement protocol itself.
          </Text>
        </View>
      </Page>
    </Document>
  );
};
