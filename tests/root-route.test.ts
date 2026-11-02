import { afterEach, describe, expect, it, vi } from 'vitest';
import RootPage, { dynamic } from '../apps/patient-portal/src/app/page';

// Exercise Next's real redirect control flow, as the post-login tests do.
function destination(): string {
  try {
    RootPage();
  } catch (error) {
    const digest = (error as { digest?: string }).digest;
    if (digest?.startsWith('NEXT_REDIRECT;')) return digest.split(';')[2];
    throw error;
  }
  throw new Error('Root page did not redirect');
}

afterEach(() => vi.unstubAllEnvs());

describe('/ default destination', () => {
  it.each([undefined, '', '   ', 'a', 'a'.repeat(61), '../admin',
    '/q/acube-aesthetics', 'https://example.com', '//example.com', 'acube?next=/admin',
  ])('redirects absent or invalid configuration %j to /login', (slug) => {
    vi.stubEnv('DEFAULT_CLINIC_SLUG', slug);
    expect(destination()).toBe('/login');
  });

  it('preserves the configured Acube QR destination', () => {
    vi.stubEnv('DEFAULT_CLINIC_SLUG', 'acube-aesthetics');
    expect(destination()).toBe('/q/acube-aesthetics');
  });

  it('preserves normalization and reads configuration on each request', () => {
    vi.stubEnv('DEFAULT_CLINIC_SLUG', '  ACUBE-AESTHETICS  ');
    expect(destination()).toBe('/q/acube-aesthetics');
    vi.stubEnv('DEFAULT_CLINIC_SLUG', undefined);
    expect(destination()).toBe('/login');
    expect(dynamic).toBe('force-dynamic');
  });
});
