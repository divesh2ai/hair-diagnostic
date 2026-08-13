import { describe, expect, it } from 'vitest';
import {
  formatForDisplay,
  maskForDisplay,
  normaliseMobile,
  toE164,
} from '../../apps/patient-portal/src/lib/patient/phone';

// The canonical form is the identity key: two writes of the same number must
// produce byte-identical output or a returning patient silently becomes a new
// record. These cases are the input shapes seen on real intake tablets.

describe('normaliseMobile — Indian mobiles', () => {
  const canonical = '+919876543210';

  it.each([
    ['bare national', '9876543210'],
    ['spaced national', '98765 43210'],
    ['trunk prefixed', '09876543210'],
    ['country code, no plus', '919876543210'],
    ['full E.164', '+919876543210'],
    ['spaced E.164', '+91 98765 43210'],
    ['dashed', '+91-98765-43210'],
    ['bracketed', '(+91) 98765.43210'],
    ['padded', '   9876543210   '],
  ])('normalises %s to canonical form', (_label, input) => {
    const result = normaliseMobile(input);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.e164).toBe(canonical);
  });

  it('reports the national number and country code separately', () => {
    const result = normaliseMobile('+91 98765 43210');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.national).toBe('9876543210');
      expect(result.countryCode).toBe('91');
    }
  });
});

describe('normaliseMobile — rejections', () => {
  it('rejects an empty or non-string input', () => {
    expect(normaliseMobile('')).toEqual({ ok: false, reason: 'empty' });
    expect(normaliseMobile('   ')).toEqual({ ok: false, reason: 'empty' });
    expect(normaliseMobile(null)).toEqual({ ok: false, reason: 'empty' });
    expect(normaliseMobile(undefined)).toEqual({ ok: false, reason: 'empty' });
    expect(normaliseMobile(9876543210)).toEqual({ ok: false, reason: 'empty' });
  });

  it('rejects a short number', () => {
    expect(normaliseMobile('98765')).toEqual({ ok: false, reason: 'too_short' });
  });

  it('rejects an over-long number', () => {
    expect(normaliseMobile('98765432101234')).toEqual({ ok: false, reason: 'too_long' });
  });

  // Landlines and service codes can't receive a WhatsApp report, so they must
  // never become an identity key.
  it.each(['1234567890', '5876543210', '0123456789'])(
    'rejects %s as not a mobile series',
    (input) => {
      expect(normaliseMobile(input)).toEqual({ ok: false, reason: 'not_a_mobile' });
    },
  );

  it('rejects free text smuggled into the field', () => {
    expect(normaliseMobile('call me 9876543210')).toEqual({
      ok: false,
      reason: 'malformed',
    });
  });
});

describe('normaliseMobile — non-Indian E.164', () => {
  it('preserves an explicit foreign country code instead of forcing +91', () => {
    const result = normaliseMobile('+971 50 123 4567');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.e164).toBe('+971501234567');
  });

  it('still bounds foreign numbers by E.164 length', () => {
    expect(normaliseMobile('+1234567')).toEqual({ ok: false, reason: 'too_short' });
    expect(normaliseMobile('+1234567890123456')).toEqual({ ok: false, reason: 'too_long' });
  });
});

describe('toE164', () => {
  it('returns the canonical string or null — never a partial value', () => {
    expect(toE164('98765 43210')).toBe('+919876543210');
    expect(toE164('nope')).toBeNull();
    expect(toE164('')).toBeNull();
  });

  it('is idempotent, so re-saving a stored number cannot fork identity', () => {
    const once = toE164('9876543210');
    expect(toE164(once)).toBe(once);
  });
});

describe('display helpers', () => {
  it('formats an Indian number for reading back', () => {
    expect(formatForDisplay('+919876543210')).toBe('+91 98765 43210');
  });

  it('leaves a foreign or malformed value untouched rather than mis-grouping it', () => {
    expect(formatForDisplay('+971501234567')).toBe('+971501234567');
    expect(formatForDisplay(null)).toBe('');
  });

  it('masks all but the last five digits for shared clinic screens', () => {
    expect(maskForDisplay('+919876543210')).toBe('••••• 43210');
    expect(maskForDisplay(null)).toBe('');
  });
});
