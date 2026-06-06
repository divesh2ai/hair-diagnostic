/**
 * AdjunctProtocolSection
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders the multi-layer adjunct therapy section of the patient report.
 *
 * Sections rendered (only when non-empty):
 *   1. Scalp Correction — medicated shampoos, sebum regulation
 *   2. Follicular Support — scalp serums, moisture barrier
 *   3. Barrier Repair — treatment-history shaft repair
 *
 * Clinical validation warnings are rendered at the bottom when present.
 * No content is rendered if all adjunct layers are empty (normal scalp patients).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from 'react';
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import type { AdjunctProtocol, AdjunctItem } from '../../ai-engine/kit-scorer/types';

// ─── Category display config ──────────────────────────────────────────────────

const CATEGORY_CONFIG = {
  SCALP_CORRECTION: {
    label:   'Scalp Correction',
    color:   '#0369A1',  // sky-700
    bg:      '#F0F9FF',  // sky-50
    border:  '#0284C7',
    eyebrow: 'SCALP MICROENVIRONMENT',
  },
  FOLLICULAR_SUPPORT: {
    label:   'Follicular Support',
    color:   '#059669',  // emerald-600
    bg:      '#ECFDF5',  // emerald-50
    border:  '#10B981',
    eyebrow: 'SCALP BARRIER SUPPORT',
  },
  BARRIER_REPAIR: {
    label:   'Shaft Barrier Repair',
    color:   '#B45309',  // amber-700
    bg:      '#FFFBEB',  // amber-50
    border:  '#D97706',
    eyebrow: 'TREATMENT HISTORY RECOVERY',
  },
  LIFESTYLE_SUPPORT: {
    label:   'Lifestyle Intervention',
    color:   '#475569',
    bg:      '#F8FAFC',
    border:  '#94A3B8',
    eyebrow: 'LIFESTYLE',
  },
} as const;

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
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
    lineHeight: 1.5,
    marginBottom: 24,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 20,
  },

  // Layer group heading
  layerHeading: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 4,
  },

  // Adjunct product card
  adjunctCard: {
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  adjunctCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  adjunctCategoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  adjunctProductName: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    flex: 1,
  },
  adjunctCardBody: {
    paddingLeft: 14,
    paddingRight: 14,
    paddingBottom: 12,
  },
  indicationText: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#334155',
    marginBottom: 6,
  },
  rationaleText: {
    fontSize: 10,
    color: '#475569',
    lineHeight: 1.6,
    marginBottom: 8,
  },
  usageBadge: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    padding: 8,
  },
  usageLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#64748B',
    marginRight: 4,
  },
  usageText: {
    fontSize: 9,
    color: '#334155',
    flex: 1,
    lineHeight: 1.5,
  },

  // Clinical validation warning
  warningCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 6,
    padding: 10,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#DC2626',
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  warningLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#DC2626',
    letterSpacing: 1,
    marginBottom: 4,
  },
  warningText: {
    fontSize: 9,
    color: '#991B1B',
    lineHeight: 1.5,
  },
});

// ─── Sub-components ───────────────────────────────────────────────────────────

const AdjunctCard = ({ item }: { item: AdjunctItem }) => {
  const config = CATEGORY_CONFIG[item.category] ?? CATEGORY_CONFIG.LIFESTYLE_SUPPORT;

  return (
    <View style={S.adjunctCard}>
      {/* Header */}
      <View style={[S.adjunctCardHeader, { backgroundColor: config.bg }]}>
        <View style={[S.adjunctCategoryDot, { backgroundColor: config.color }]} />
        <Text style={[S.adjunctProductName, { color: config.color }]}>
          {item.productName}
        </Text>
      </View>

      {/* Body */}
      <View style={S.adjunctCardBody}>
        <Text style={S.indicationText}>{item.indication}</Text>
        <Text style={S.rationaleText}>{item.clinicalRationale}</Text>

        {/* Usage instruction */}
        <View style={S.usageBadge}>
          <Text style={S.usageLabel}>USAGE:</Text>
          <Text style={S.usageText}>{item.usageInstruction}</Text>
        </View>
      </View>
    </View>
  );
};

const LayerGroup = ({
  title,
  items,
  color,
}: {
  title: string;
  items: AdjunctItem[];
  color: string;
}) => {
  if (items.length === 0) return null;
  return (
    <View>
      <Text style={[S.layerHeading, { color }]}>{title.toUpperCase()}</Text>
      {items.map((item, i) => (
        <AdjunctCard key={`${item.productName}-${i}`} item={item} />
      ))}
    </View>
  );
};

// ─── Main export ──────────────────────────────────────────────────────────────

interface Props {
  adjunctProtocol: AdjunctProtocol | null | undefined;
}

export const AdjunctProtocolSection = ({ adjunctProtocol }: Props) => {
  if (!adjunctProtocol) return null;

  // Defensive: arrays may be missing on old persisted artifacts
  const scalpCorrection    = adjunctProtocol.scalpCorrection        ?? [];
  const follicularSupport  = adjunctProtocol.follicularSupport      ?? [];
  const barrierRepair      = adjunctProtocol.barrierRepair          ?? [];
  const validationWarnings = adjunctProtocol.validationWarnings     ?? [];

  const hasAnyAdjunct =
    scalpCorrection.length > 0 ||
    follicularSupport.length > 0 ||
    barrierRepair.length > 0;

  // Render nothing if no adjuncts were injected (e.g. normal scalp, no treatment history)
  if (!hasAnyAdjunct) return null;

  return (
    <View>
      <Text style={S.sectionEyebrow}>SCALP ENVIRONMENT &amp; ADJUNCT THERAPIES</Text>
      <Text style={S.sectionTitle}>Supportive &amp; Scalp Protocol</Text>
      <Text style={S.sectionDesc}>
        These products work alongside your oral supplement protocol. They address
        scalp microenvironment, follicular hygiene, and shaft integrity — layers
        the oral protocol alone cannot reach.
      </Text>
      <View style={S.divider} />

      <LayerGroup
        title="Scalp Microenvironment Correction"
        items={scalpCorrection}
        color={CATEGORY_CONFIG.SCALP_CORRECTION.color}
      />

      <LayerGroup
        title="Follicular Support"
        items={follicularSupport}
        color={CATEGORY_CONFIG.FOLLICULAR_SUPPORT.color}
      />

      <LayerGroup
        title="Shaft Barrier Repair"
        items={barrierRepair}
        color={CATEGORY_CONFIG.BARRIER_REPAIR.color}
      />

      {/* Clinical validation warnings — shown only in error states */}
      {validationWarnings.length > 0 &&
        validationWarnings.map((w, i) => (
          <View key={i} style={S.warningCard}>
            <Text style={S.warningLabel}>CLINICAL VALIDATION WARNING</Text>
            <Text style={S.warningText}>{w}</Text>
          </View>
        ))}
    </View>
  );
};
