import { describe, expect, it } from 'vitest';
import {
  createLocationSchema,
  geoStatusForCoordinates,
  isMappable,
  locationSetupState,
  seedFromLegacyClinic,
  updateLocationSchema,
} from '../../apps/patient-portal/src/lib/clinic/location';

// The rule these tests defend: HairOS never invents a clinic's position. A
// coordinate exists because a human put it there, or it does not exist.

describe('createLocationSchema', () => {
  const minimal = { branchName: 'Bandra West' };

  it('accepts a branch with nothing but a name — an unknown address is storable', () => {
    const parsed = createLocationSchema.safeParse(minimal);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.country).toBe('IN');
      expect(parsed.data.status).toBe('ONBOARDING');
      expect(parsed.data.isPrimary).toBe(false);
    }
  });

  it('rejects a branch name too short to identify anything', () => {
    expect(createLocationSchema.safeParse({ branchName: 'B' }).success).toBe(false);
  });

  it('normalises blank address fields to null rather than empty strings', () => {
    const parsed = createLocationSchema.safeParse({
      ...minimal,
      city: '  ',
      addressLine1: '  Linking Road  ',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.city).toBeNull();
      expect(parsed.data.addressLine1).toBe('Linking Road');
    }
  });

  it('accepts a valid Indian PIN code', () => {
    expect(
      createLocationSchema.safeParse({ ...minimal, pincode: '400050' }).success,
    ).toBe(true);
  });

  it.each(['040050', '40005', '4000501', 'ABC123'])(
    'rejects %s as an Indian PIN code',
    (pincode) => {
      expect(createLocationSchema.safeParse({ ...minimal, pincode }).success).toBe(false);
    },
  );

  it('does not apply the Indian PIN rule to other countries', () => {
    const parsed = createLocationSchema.safeParse({
      ...minimal,
      country: 'AE',
      pincode: '00000',
    });
    expect(parsed.success).toBe(true);
  });

  it('uppercases the country code so IN and in are one value', () => {
    const parsed = createLocationSchema.safeParse({ ...minimal, country: 'ae' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.country).toBe('AE');
  });

  // A lone latitude passes a null check and then silently disappears from
  // every bounding-box query — worse than no pin, because it looks set.
  it('rejects a half-supplied coordinate pair', () => {
    expect(
      createLocationSchema.safeParse({ ...minimal, latitude: 19.0596 }).success,
    ).toBe(false);
    expect(
      createLocationSchema.safeParse({ ...minimal, longitude: 72.8295 }).success,
    ).toBe(false);
  });

  it('accepts a complete pair and rejects out-of-range values', () => {
    expect(
      createLocationSchema.safeParse({ ...minimal, latitude: 19.0596, longitude: 72.8295 })
        .success,
    ).toBe(true);
    expect(
      createLocationSchema.safeParse({ ...minimal, latitude: 91, longitude: 0 }).success,
    ).toBe(false);
    expect(
      createLocationSchema.safeParse({ ...minimal, latitude: 0, longitude: 181 }).success,
    ).toBe(false);
  });
});

describe('updateLocationSchema', () => {
  it('accepts an empty patch', () => {
    expect(updateLocationSchema.safeParse({}).success).toBe(true);
  });

  // A default here would rewrite a UAE branch back to India on any patch that
  // only moved a pin.
  it('does not default country, so an unmentioned country is left alone', () => {
    const parsed = updateLocationSchema.safeParse({ city: 'Pune' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.country).toBeUndefined();
  });

  it('still refuses a half-supplied coordinate pair', () => {
    expect(updateLocationSchema.safeParse({ latitude: 19.05 }).success).toBe(false);
  });

  it('allows clearing a pin by sending both as null', () => {
    expect(
      updateLocationSchema.safeParse({ latitude: null, longitude: null }).success,
    ).toBe(true);
  });
});

describe('geoStatusForCoordinates', () => {
  it('marks a human-supplied pair as PINNED, never GEOCODED', () => {
    expect(geoStatusForCoordinates(19.0596, 72.8295)).toBe('PINNED');
  });

  it('reports UNSET when either half is missing', () => {
    expect(geoStatusForCoordinates(null, null)).toBe('UNSET');
    expect(geoStatusForCoordinates(19.0596, null)).toBe('UNSET');
    expect(geoStatusForCoordinates(undefined, undefined)).toBe('UNSET');
  });
});

describe('locationSetupState', () => {
  it('reports NONE for a clinic with no branches — every pre-S2 clinic', () => {
    expect(locationSetupState([])).toBe('NONE');
  });

  it('reports INCOMPLETE when branches exist but none can be plotted', () => {
    expect(locationSetupState([{ geoStatus: 'UNSET' }, { geoStatus: 'UNSET' }])).toBe(
      'INCOMPLETE',
    );
  });

  it('reports COMPLETE as soon as one branch is plottable', () => {
    expect(locationSetupState([{ geoStatus: 'UNSET' }, { geoStatus: 'PINNED' }])).toBe(
      'COMPLETE',
    );
  });
});

describe('isMappable', () => {
  const pinned = { latitude: 19.0596, longitude: 72.8295, status: 'ACTIVE', deletedAt: null };

  it('plots an active pinned branch', () => {
    expect(isMappable(pinned)).toBe(true);
  });

  it('plots an onboarding branch — the map must show clinics coming online', () => {
    expect(isMappable({ ...pinned, status: 'ONBOARDING' })).toBe(true);
  });

  it('excludes closed and retired branches so the national count stays honest', () => {
    expect(isMappable({ ...pinned, status: 'CLOSED' })).toBe(false);
    expect(isMappable({ ...pinned, deletedAt: new Date() })).toBe(false);
  });

  it('excludes an unpinned branch', () => {
    expect(isMappable({ ...pinned, latitude: null, longitude: null })).toBe(false);
  });
});

describe('seedFromLegacyClinic', () => {
  // Splitting an Indian address on commas produces plausible-looking wrong
  // answers, so the legacy text is carried across whole for a human to split.
  it('carries the free-text address into line 1 without parsing it', () => {
    const seed = seedFromLegacyClinic({
      name: 'Dr ABC Hair Clinic',
      address: '12 Linking Road, Bandra West, Mumbai 400050',
      phone: '+912212345678',
    });
    expect(seed.addressLine1).toBe('12 Linking Road, Bandra West, Mumbai 400050');
    expect(seed.branchName).toBe('Main branch');
    expect(seed).not.toHaveProperty('city');
    expect(seed).not.toHaveProperty('pincode');
  });

  it('returns null rather than a placeholder when the clinic has no address', () => {
    const seed = seedFromLegacyClinic({ name: 'X', address: '   ', phone: null });
    expect(seed.addressLine1).toBeNull();
    expect(seed.phone).toBeNull();
  });
});
