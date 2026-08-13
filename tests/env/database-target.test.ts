import { describe, expect, it } from 'vitest';
import {
  OVERRIDE_ENV_VALUE,
  OVERRIDE_ENV_VAR,
  PRODUCTION_SUPABASE_REF,
  STAGING_SUPABASE_REF,
  assertSafeDatabaseTarget,
  assessDatabaseTarget,
  extractSupabaseRef,
  isProductionRuntime,
} from '../../packages/shared/env/databaseTarget';

// The incident this guard exists for: `.env` and `.env.local` both pointed at
// the production Supabase project, so every local dev server and every script
// ran against live patient data with nothing to indicate it.
//
// The rule under test is the inversion that fixes it — production access
// requires positive proof of being the production deployment, rather than
// danger requiring positive proof of itself.

const POOLED_PROD = `postgresql://postgres.${PRODUCTION_SUPABASE_REF}:pw@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true`;
const DIRECT_PROD = `postgresql://postgres.${PRODUCTION_SUPABASE_REF}:pw@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres`;
const API_PROD = `https://${PRODUCTION_SUPABASE_REF}.supabase.co`;

const POOLED_STAGING = `postgresql://postgres.${STAGING_SUPABASE_REF}:pw@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true`;
const DIRECT_STAGING = `postgresql://postgres.${STAGING_SUPABASE_REF}:pw@aws-1-ap-south-1.pooler.supabase.com:5432/postgres`;
const API_STAGING = `https://${STAGING_SUPABASE_REF}.supabase.co`;

const prodEnv = (extra: Record<string, string | undefined> = {}) => ({
  DATABASE_URL: POOLED_PROD,
  DIRECT_URL: DIRECT_PROD,
  NEXT_PUBLIC_SUPABASE_URL: API_PROD,
  ...extra,
});

const stagingEnv = (extra: Record<string, string | undefined> = {}) => ({
  DATABASE_URL: POOLED_STAGING,
  DIRECT_URL: DIRECT_STAGING,
  NEXT_PUBLIC_SUPABASE_URL: API_STAGING,
  ...extra,
});

describe('extractSupabaseRef', () => {
  it('reads the ref from a pooled connection string', () => {
    expect(extractSupabaseRef(POOLED_PROD)).toBe(PRODUCTION_SUPABASE_REF);
  });

  it('reads the ref from a direct db.<ref> host', () => {
    expect(
      extractSupabaseRef(`postgresql://postgres:pw@db.${STAGING_SUPABASE_REF}.supabase.co:5432/postgres`),
    ).toBe(STAGING_SUPABASE_REF);
  });

  it('reads the ref from an API URL', () => {
    expect(extractSupabaseRef(API_STAGING)).toBe(STAGING_SUPABASE_REF);
  });

  it('returns null for a local Postgres URL — not a project we protect', () => {
    expect(extractSupabaseRef('postgresql://postgres:pw@localhost:5432/hairos')).toBeNull();
    expect(extractSupabaseRef(undefined)).toBeNull();
    expect(extractSupabaseRef('')).toBeNull();
  });
});

describe('isProductionRuntime', () => {
  it('accepts only VERCEL_ENV=production as proof', () => {
    expect(isProductionRuntime({ VERCEL_ENV: 'production' })).toBe(true);
  });

  it('does NOT trust NODE_ENV=production', () => {
    // Next sets NODE_ENV=production for preview builds and for a local
    // `next build && next start`. Trusting it reopens the exact hole.
    expect(isProductionRuntime({ NODE_ENV: 'production' })).toBe(false);
    expect(isProductionRuntime({ NODE_ENV: 'production', VERCEL_ENV: 'preview' })).toBe(false);
  });

  it('treats an undefined NODE_ENV as non-production', () => {
    // `npx tsx scripts/seed-demo.ts` sets neither variable. This is what makes
    // the seed scripts safe by default rather than by remembering.
    expect(isProductionRuntime({})).toBe(false);
  });
});

describe('assessDatabaseTarget — the incident case', () => {
  it('refuses production from a local dev server', () => {
    const verdict = assessDatabaseTarget(prodEnv({ NODE_ENV: 'development' }));
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) {
      expect(verdict.reason).toBe('production_from_non_production_runtime');
      expect(verdict.message).toContain(STAGING_SUPABASE_REF);
    }
  });

  it('refuses production from a bare script with no NODE_ENV', () => {
    expect(assessDatabaseTarget(prodEnv()).allowed).toBe(false);
  });

  it('refuses production from a Vercel preview deployment', () => {
    // Preview builds run with NODE_ENV=production, so this is the case a
    // NODE_ENV-only check would wave through.
    const verdict = assessDatabaseTarget(
      prodEnv({ NODE_ENV: 'production', VERCEL_ENV: 'preview' }),
    );
    expect(verdict.allowed).toBe(false);
  });

  it('allows production from the production deployment', () => {
    const verdict = assessDatabaseTarget(
      prodEnv({ NODE_ENV: 'production', VERCEL_ENV: 'production' }),
    );
    expect(verdict.allowed).toBe(true);
  });
});

describe('assessDatabaseTarget — staging and local', () => {
  it('allows staging from local development', () => {
    expect(assessDatabaseTarget(stagingEnv({ NODE_ENV: 'development' })).allowed).toBe(true);
  });

  it('allows a purely local Postgres', () => {
    const local = {
      DATABASE_URL: 'postgresql://postgres:pw@localhost:5432/hairos',
      DIRECT_URL: 'postgresql://postgres:pw@localhost:5432/hairos',
      NODE_ENV: 'development',
    };
    expect(assessDatabaseTarget(local).allowed).toBe(true);
  });
});

describe('assessDatabaseTarget — split configuration', () => {
  it('refuses a database on one project and storage on another', () => {
    // Rows would be written to staging while clinical images upload to
    // production storage, producing assessments whose photos do not exist.
    const verdict = assessDatabaseTarget({
      DATABASE_URL: POOLED_STAGING,
      DIRECT_URL: DIRECT_STAGING,
      NEXT_PUBLIC_SUPABASE_URL: API_PROD,
      NODE_ENV: 'development',
    });
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) expect(verdict.reason).toBe('split_configuration');
  });

  it('refuses the split even on the production runtime', () => {
    const verdict = assessDatabaseTarget({
      DATABASE_URL: POOLED_PROD,
      NEXT_PUBLIC_SUPABASE_URL: API_STAGING,
      VERCEL_ENV: 'production',
    });
    expect(verdict.allowed).toBe(false);
  });
});

describe('the override', () => {
  it('unlocks production only for the exact phrase', () => {
    expect(
      assessDatabaseTarget(
        prodEnv({ NODE_ENV: 'development', [OVERRIDE_ENV_VAR]: OVERRIDE_ENV_VALUE }),
      ).allowed,
    ).toBe(true);
  });

  it('is not satisfied by the usual truthy values', () => {
    for (const value of ['1', 'true', 'yes', 'YES-I-UNDERSTAND']) {
      expect(
        assessDatabaseTarget(prodEnv({ NODE_ENV: 'development', [OVERRIDE_ENV_VAR]: value }))
          .allowed,
      ).toBe(false);
    }
  });

  it('does not unlock a split configuration', () => {
    const verdict = assessDatabaseTarget({
      DATABASE_URL: POOLED_STAGING,
      NEXT_PUBLIC_SUPABASE_URL: API_PROD,
      NODE_ENV: 'development',
      [OVERRIDE_ENV_VAR]: OVERRIDE_ENV_VALUE,
    });
    expect(verdict.allowed).toBe(false);
  });
});

describe('assertSafeDatabaseTarget', () => {
  it('throws with the context and the remedy', () => {
    expect(() => assertSafeDatabaseTarget(prodEnv({ NODE_ENV: 'development' }), 'seed-demo'))
      .toThrow(/seed-demo/);
    expect(() => assertSafeDatabaseTarget(prodEnv({ NODE_ENV: 'development' }), 'seed-demo'))
      .toThrow(/staging-environment-plan/);
  });

  it('stays silent when the target is safe', () => {
    expect(() =>
      assertSafeDatabaseTarget(stagingEnv({ NODE_ENV: 'development' }), 'patient-portal'),
    ).not.toThrow();
  });
});
