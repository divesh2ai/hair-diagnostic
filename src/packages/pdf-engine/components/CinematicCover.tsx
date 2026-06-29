import React from 'react';
import { Text, View, StyleSheet, Svg, Defs, LinearGradient, Stop, Rect, Circle } from '@react-pdf/renderer';
import { PatientInfo, ClinicInfo, DoctorInfo } from '../types';

/**
 * Patient identity normalisation — applied at every PDF display site.
 *  - Name: strip digits + special characters, collapse whitespace, proper-case.
 *  - Age: clamped to a clinically sensible 10–150 range; out-of-range falls back to "—".
 */
export function formatPatientName(raw: string | undefined | null): string {
  const cleaned = String(raw ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')      // strip combining accents
    .replace(/[^A-Za-z\s'-]/g, ' ')        // drop digits + special chars, keep apostrophes and hyphens
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'Patient';
  return cleaned
    .toLowerCase()
    .split(' ')
    .map((w) =>
      w
        .split('-')
        .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
        .join('-')
    )
    .join(' ');
}

export function formatPatientAge(raw: unknown): string {
  const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n)) return '—';
  if (n < 10 || n > 150) return '—';
  return String(Math.trunc(n));
}

/**
 * Dossier Cover — full-bleed editorial.
 *
 * Premium intelligence-dossier feel:
 *   - dark navy → teal gradient background drawn as SVG
 *   - oversized display title ("Your Hair Story.")
 *   - thin gold rule, eyebrow micro-type
 *   - patient name + meta grid at the bottom
 *   - no boxes, no medical lab vibe
 */

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  ink:       '#0A2540',
  inkDeep:   '#07111F',
  body:      '#E9EFF6',
  bodyDim:   '#A8B5C4',
  faint:     '#5F7488',
  hairline:  '#1B3550',
  teal:      '#00C2A8',
  gold:      '#F4B942',
};

const styles = StyleSheet.create({
  page: {
    padding: 0,
    backgroundColor: C.inkDeep,
    height: '100%',
    fontFamily: 'Helvetica',
    position: 'relative',
  },
  bgSvg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  // Brand strip at top
  brandStrip: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingHorizontal: 44,
    paddingTop: 38,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandMark: { flexDirection: 'row', alignItems: 'center' },
  brandDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: C.teal,
    marginRight: 9,
  },
  brandName: {
    fontSize: 9,
    letterSpacing: 3,
    color: C.body,
    fontFamily: 'Helvetica-Bold',
  },
  brandTag: {
    fontSize: 7.5,
    letterSpacing: 2.4,
    color: C.bodyDim,
    fontFamily: 'Helvetica-Bold',
  },

  // Center editorial block
  hero: {
    position: 'absolute',
    top: 230,
    left: 44,
    right: 44,
  },
  eyebrow: {
    fontSize: 8.5,
    letterSpacing: 3.5,
    color: C.gold,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 18,
  },
  titleLine1: {
    fontSize: 76,
    color: C.body,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: -2,
    lineHeight: 0.96,
  },
  titleLine2: {
    fontSize: 76,
    color: C.teal,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: -2,
    lineHeight: 0.96,
    marginTop: 2,
  },
  accentBar: {
    height: 2,
    width: 64,
    backgroundColor: C.gold,
    marginTop: 24,
    marginBottom: 18,
  },
  lede: {
    fontSize: 12,
    color: C.bodyDim,
    lineHeight: 1.6,
    maxWidth: 360,
  },
  whisper: {
    marginTop: 18,
    fontSize: 11,
    color: C.teal,
    fontFamily: 'Helvetica-Oblique',
    lineHeight: 1.55,
    maxWidth: 380,
  },

  // Bottom meta grid (3 columns)
  metaRow: {
    position: 'absolute',
    left: 44,
    right: 44,
    bottom: 96,
    flexDirection: 'row',
    paddingTop: 18,
    borderTopWidth: 0.5,
    borderTopColor: C.hairline,
  },
  metaCol: { flex: 1 },
  metaLabel: {
    fontSize: 7,
    letterSpacing: 2.2,
    color: C.faint,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
  },
  metaValue: {
    fontSize: 12,
    color: C.body,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: -0.2,
  },
  metaSub: {
    fontSize: 8.5,
    color: C.bodyDim,
    marginTop: 2,
  },

  // Footer note
  footer: {
    position: 'absolute',
    bottom: 32,
    left: 44,
    right: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerLeft: {
    fontSize: 7.5,
    letterSpacing: 2,
    color: C.faint,
    fontFamily: 'Helvetica-Bold',
  },
  footerRight: {
    fontSize: 7.5,
    letterSpacing: 2,
    color: C.faint,
    fontFamily: 'Helvetica-Bold',
  },
});

interface Props {
  patient: PatientInfo;
  clinic: ClinicInfo;
  doctor: DoctorInfo;
  date: Date;
}

export const CinematicCover = ({ patient, clinic, doctor, date }: Props) => {
  const dateStr = new Date(date).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
  const displayName = formatPatientName(patient.name);
  const displayAge = formatPatientAge(patient.age);

  return (
    <View style={styles.page}>
      {/* Editorial gradient background */}
      <Svg style={styles.bgSvg} viewBox="0 0 595 842" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="coverBg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#07111F" />
            <Stop offset="0.55" stopColor="#0A2540" />
            <Stop offset="1" stopColor="#0F2E4A" />
          </LinearGradient>
          <LinearGradient id="coverGlow" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#00C2A8" stopOpacity="0.22" />
            <Stop offset="1" stopColor="#00C2A8" stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="coverGold" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor="#F4B942" stopOpacity="0.16" />
            <Stop offset="1" stopColor="#F4B942" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="595" height="842" fill="url(#coverBg)" />
        <Circle cx="480" cy="170" r="220" fill="url(#coverGlow)" />
        <Circle cx="80"  cy="640" r="240" fill="url(#coverGold)" />
        {/* Hairline rule near top */}
        <Rect x="44" y="86" width="507" height="0.5" fill="#1B3550" />
      </Svg>

      {/* Brand strip */}
      <View style={styles.brandStrip}>
        <View style={styles.brandMark}>
          <View style={styles.brandDot} />
          <Text style={styles.brandName}>{clinic.name.toUpperCase()}</Text>
        </View>
        <Text style={styles.brandTag}>HAIROS · INTELLIGENCE DOSSIER</Text>
      </View>

      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>VOLUME 01 · PREPARED FOR {displayName.toUpperCase()}</Text>
        <Text style={styles.titleLine1}>Your Hair</Text>
        <Text style={styles.titleLine2}>Story.</Text>
        <View style={styles.accentBar} />
        <Text style={styles.lede}>
          A personalized explanation of the biological factors influencing
          your hair today — generated by HairOS Intelligence.
        </Text>
        <Text style={styles.whisper}>
          {displayName}, this is what your hair has been trying to tell you.
        </Text>
      </View>

      {/* Meta grid */}
      <View style={styles.metaRow}>
        <View style={styles.metaCol}>
          <Text style={styles.metaLabel}>PREPARED FOR</Text>
          <Text style={styles.metaValue}>{displayName}</Text>
          <Text style={styles.metaSub}>{displayAge} · {patient.gender}</Text>
        </View>
        <View style={styles.metaCol}>
          <Text style={styles.metaLabel}>CLINICIAN</Text>
          <Text style={styles.metaValue}>{doctor.name}</Text>
          <Text style={styles.metaSub}>{clinic.name}</Text>
        </View>
        <View style={styles.metaCol}>
          <Text style={styles.metaLabel}>ASSESSMENT DATE</Text>
          <Text style={styles.metaValue}>{dateStr}</Text>
          <Text style={styles.metaSub}>Confidential</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerLeft}>HAIROS · DOSSIER</Text>
        <Text style={styles.footerRight}>COVER</Text>
      </View>
    </View>
  );
};
