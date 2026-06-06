import React from 'react';
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { PatientInfo } from '../types';
import { NormalizedClinicalProfile } from '../../questionnaire-normalizer/types';

// ─── Lookup tables ────────────────────────────────────────────────────────────

const SEVERITY_LABEL: Record<string, string> = {
  NONE: 'No visible loss',
  LOW: 'Mild thinning',
  MODERATE: 'Moderate loss',
  HIGH: 'Significant loss',
  SEVERE: 'Severe / Advanced loss',
};

const SEVERITY_COLOR: Record<string, string> = {
  NONE: '#15803D',
  LOW: '#CA8A04',
  MODERATE: '#EA580C',
  HIGH: '#DC2626',
  SEVERE: '#7F1D1D',
};

const PATTERN_LABEL: Record<string, string> = {
  DIFFUSE: 'Diffuse across scalp',
  FRONTAL: 'Frontal hairline recession',
  CROWN: 'Crown / vertex thinning',
  PARTITION: 'Parting-line thinning',
  UNKNOWN: 'Pattern unspecified',
};

function humanize(signal: string): string {
  return signal
    .replace(/_/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// ─── Narrative builder ────────────────────────────────────────────────────────

function buildNarrative(
  patient: PatientInfo,
  profile: NormalizedClinicalProfile
): string {
  const severity =
    SEVERITY_LABEL[profile.hairfallSeverity] ?? profile.hairfallSeverity;
  const pattern =
    PATTERN_LABEL[profile.sheddingPattern] ?? profile.sheddingPattern;

  const drivers: string[] = [];
  if (profile.hormonalSignals.length > 0)
    drivers.push(
      `hormonal factors (${profile.hormonalSignals.map(humanize).join(', ')})`
    );
  if (profile.metabolicSignals.length > 0)
    drivers.push(
      `metabolic dysfunction (${profile.metabolicSignals.map(humanize).join(', ')})`
    );
  if (profile.deficiencySignals.length > 0)
    drivers.push(
      `nutritional deficiencies (${profile.deficiencySignals.map(humanize).join(', ')})`
    );
  if (profile.inflammatorySignals.length > 0)
    drivers.push(`scalp inflammation`);

  const driverSentence =
    drivers.length > 0
      ? `The assessment identifies ${drivers.join('; ')} as active contributing factors. `
      : '';

  const lifestyleSentence =
    profile.lifestyleSignals.length > 0
      ? `Lifestyle factors — ${profile.lifestyleSignals.map(humanize).join(', ')} — are actively modifying your recovery trajectory and are addressed in the protocol. `
      : '';

  const stressSentence =
    profile.psychologicalSignals.length > 0
      ? `Psychological signals (${profile.psychologicalSignals.map(humanize).join(', ')}) are also present and contribute to the HPA-axis stress load on follicles. `
      : '';

  return (
    `${patient.name}, your hair loss is currently classified as ${severity.toLowerCase()}, ` +
    `presenting in a ${pattern.toLowerCase()} pattern. ` +
    driverSentence +
    lifestyleSentence +
    stressSentence +
    `The protocol below is sequenced in a precise clinical order — each phase repairs a distinct biological layer that the next phase depends on. No phase can be skipped or reordered.`
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  wrapper: {
    padding: 50,
    backgroundColor: '#FFFFFF',
  },

  // Page header
  headerBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 14,
    marginBottom: 22,
  },
  eyebrow: {
    fontSize: 9,
    color: '#94A3B8',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  pageTitle: {
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
  },

  // Narrative card
  narrativeCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 18,
    borderLeftWidth: 4,
    borderLeftColor: '#0284C7',
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    marginBottom: 22,
  },
  narrativeEyebrow: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#0284C7',
    letterSpacing: 1.2,
    marginBottom: 7,
  },
  narrativeBody: {
    fontSize: 11,
    color: '#0C4A6E',
    lineHeight: 1.75,
  },

  // Metric row
  metricRow: {
    flexDirection: 'row',
    marginBottom: 22,
  },
  metricBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 10,
  },
  metricBoxLast: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricLabel: {
    fontSize: 9,
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 5,
  },
  metricValue: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
  },

  // Signal grid
  gridTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    marginBottom: 12,
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  signalCol: {
    flex: 1,
    marginRight: 12,
  },
  signalColLast: {
    flex: 1,
  },
  signalLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
    marginBottom: 6,
  },
  chip: {
    borderRadius: 4,
    paddingTop: 3,
    paddingBottom: 3,
    paddingLeft: 7,
    paddingRight: 7,
    marginBottom: 4,
  },
  chipText: {
    fontSize: 9,
  },
  emptyText: {
    fontSize: 9,
    color: '#94A3B8',
  },
});

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SignalColProps {
  label: string;
  signals: string[];
  color: string;
  bgColor: string;
  last?: boolean;
}

const SignalCol = ({ label, signals, color, bgColor, last }: SignalColProps) => (
  <View style={last ? S.signalColLast : S.signalCol}>
    <Text style={[S.signalLabel, { color }]}>{label.toUpperCase()}</Text>
    {signals.length > 0 ? (
      signals.map((s, i) => (
        <View key={i} style={[S.chip, { backgroundColor: bgColor }]}>
          <Text style={[S.chipText, { color }]}>{humanize(s)}</Text>
        </View>
      ))
    ) : (
      <Text style={S.emptyText}>None detected</Text>
    )}
  </View>
);

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  patient: PatientInfo;
  // Accept partial / empty objects gracefully — clinicalProfile may arrive as {}
  // when the CLINICAL_REASONING artifact hasn't been persisted yet.
  profile: Partial<NormalizedClinicalProfile> | null | undefined;
}

export const PatientClinicalSummary = ({ patient, profile }: Props) => {
  // Defensive defaults — every field guarded so an empty profile renders safely
  const p: NormalizedClinicalProfile = {
    hairfallSeverity:      profile?.hairfallSeverity      ?? 'NONE',
    sheddingPattern:       profile?.sheddingPattern        ?? 'UNKNOWN',
    hormonalSignals:       profile?.hormonalSignals        ?? [],
    metabolicSignals:      profile?.metabolicSignals       ?? [],
    inflammatorySignals:   profile?.inflammatorySignals    ?? [],
    deficiencySignals:     profile?.deficiencySignals      ?? [],
    psychologicalSignals:  profile?.psychologicalSignals   ?? [],
    lifestyleSignals:      profile?.lifestyleSignals       ?? [],
    medicalHistory:        profile?.medicalHistory         ?? [],
  };

  const severityColor = SEVERITY_COLOR[p.hairfallSeverity] ?? '#0F172A';
  const severityLabel =
    SEVERITY_LABEL[p.hairfallSeverity] ?? p.hairfallSeverity;
  const patternLabel =
    PATTERN_LABEL[p.sheddingPattern] ?? p.sheddingPattern;

  const primarySignal =
    p.hormonalSignals[0] ??
    p.metabolicSignals[0] ??
    p.inflammatorySignals[0] ??
    null;

  return (
    <View style={S.wrapper}>
      {/* Header */}
      <View style={S.headerBorder}>
        <Text style={S.eyebrow}>CLINICAL ASSESSMENT</Text>
        <Text style={S.pageTitle}>Patient Summary &amp; Profile</Text>
      </View>

      {/* Narrative */}
      <View style={S.narrativeCard}>
        <Text style={S.narrativeEyebrow}>CLINICAL OVERVIEW</Text>
        <Text style={S.narrativeBody}>{buildNarrative(patient, p)}</Text>
      </View>

      {/* Key metrics */}
      <View style={S.metricRow}>
        <View style={S.metricBox}>
          <Text style={S.metricLabel}>SEVERITY</Text>
          <Text style={[S.metricValue, { color: severityColor }]}>
            {severityLabel}
          </Text>
        </View>
        <View style={S.metricBox}>
          <Text style={S.metricLabel}>SHEDDING PATTERN</Text>
          <Text style={S.metricValue}>{patternLabel}</Text>
        </View>
        <View style={S.metricBoxLast}>
          <Text style={S.metricLabel}>PRIMARY SIGNAL</Text>
          <Text style={S.metricValue}>
            {primarySignal ? humanize(primarySignal) : 'Multifactorial'}
          </Text>
        </View>
      </View>

      {/* Signal grid — 2 rows x 3 cols */}
      <Text style={S.gridTitle}>Detected Clinical Signals</Text>

      <View style={S.gridRow}>
        <SignalCol
          label="Hormonal"
          signals={p.hormonalSignals}
          color="#7C3AED"
          bgColor="#F5F3FF"
        />
        <SignalCol
          label="Metabolic"
          signals={p.metabolicSignals}
          color="#EA580C"
          bgColor="#FFF7ED"
        />
        <SignalCol
          label="Inflammatory"
          signals={p.inflammatorySignals}
          color="#DC2626"
          bgColor="#FEF2F2"
          last
        />
      </View>

      <View style={S.gridRow}>
        <SignalCol
          label="Deficiencies"
          signals={p.deficiencySignals}
          color="#B45309"
          bgColor="#FFFBEB"
        />
        <SignalCol
          label="Psychological"
          signals={p.psychologicalSignals}
          color="#0369A1"
          bgColor="#F0F9FF"
        />
        <SignalCol
          label="Lifestyle"
          signals={p.lifestyleSignals}
          color="#475569"
          bgColor="#F1F5F9"
          last
        />
      </View>
    </View>
  );
};
