import { describe, expect, it } from 'vitest';
import {
  CLINIC_SLUG_MAX,
  clinicAssessmentUrl,
  isValidClinicSlug,
  normaliseClinicSlugInput,
  slugifyClinicName,
} from '../../apps/patient-portal/src/lib/clinic/slug';

// The rule these tests defend: a Super Admin types a clinic name and gets a
// working patient URL. They never have to know what a slug is, and the URL a
// QR code carries is never something nobody chose.

describe('slugifyClinicName', () => {
  it('derives the documented example', () => {
    expect(slugifyClinicName('Advanced Hair Clinic Mumbai')).toBe(
      'advanced-hair-clinic-mumbai',
    );
  });

  it('collapses punctuation and repeated separators into single hyphens', () => {
    expect(slugifyClinicName('Dr. FACT  —  Hair & Skin, Bandra (West)')).toBe(
      'dr-fact-hair-skin-bandra-west',
    );
  });

  it('never leaves a leading or trailing hyphen', () => {
    expect(slugifyClinicName('  ...Skin Studio!!  ')).toBe('skin-studio');
  });

  it('folds accents onto their base letters rather than dropping the letter', () => {
    expect(slugifyClinicName('Clínica Capilar')).toBe('clinica-capilar');
  });

  it('caps at the column length without ending on a hyphen', () => {
    const slug = slugifyClinicName(`${'a'.repeat(CLINIC_SLUG_MAX - 1)} bcdef`);
    expect(slug.length).toBeLessThanOrEqual(CLINIC_SLUG_MAX);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('returns empty for a name with no Latin characters rather than inventing a transliteration', () => {
    // The form treats "" as "ask the admin to type a URL". Guessing at a
    // romanisation would print a URL onto a QR code that nobody approved.
    expect(slugifyClinicName('केश क्लिनिक')).toBe('');
  });
});

describe('normaliseClinicSlugInput', () => {
  it('keeps a trailing hyphen so a hyphenated URL can actually be typed', () => {
    // slugifyClinicName would strip this and swallow the next keystroke into
    // the previous word.
    expect(normaliseClinicSlugInput('advanced-')).toBe('advanced-');
  });

  it('folds capitals and turns spaces into hyphens as the admin types', () => {
    expect(normaliseClinicSlugInput('Hair Clinic')).toBe('hair-clinic');
  });

  it('drops a leading hyphen', () => {
    expect(normaliseClinicSlugInput('-clinic')).toBe('clinic');
  });
});

describe('isValidClinicSlug', () => {
  it('accepts what the server accepts', () => {
    expect(isValidClinicSlug('advanced-hair-clinic-mumbai')).toBe(true);
    expect(isValidClinicSlug('dr-fact-2')).toBe(true);
  });

  it('rejects what the server rejects', () => {
    expect(isValidClinicSlug('')).toBe(false);
    expect(isValidClinicSlug('a')).toBe(false);
    expect(isValidClinicSlug('Has Capitals')).toBe(false);
    expect(isValidClinicSlug('under_score')).toBe(false);
    expect(isValidClinicSlug('a'.repeat(CLINIC_SLUG_MAX + 1))).toBe(false);
  });
});

describe('clinicAssessmentUrl', () => {
  it('shows the full URL when an origin is known', () => {
    expect(clinicAssessmentUrl('drfact-mumbai', 'https://hairos.app')).toBe(
      'https://hairos.app/q/drfact-mumbai',
    );
  });

  it('tolerates a trailing slash on the origin', () => {
    expect(clinicAssessmentUrl('drfact-mumbai', 'https://hairos.app/')).toBe(
      'https://hairos.app/q/drfact-mumbai',
    );
  });

  it('falls back to the path when there is no origin to be honest about', () => {
    expect(clinicAssessmentUrl('drfact-mumbai', null)).toBe('/q/drfact-mumbai');
  });
});
