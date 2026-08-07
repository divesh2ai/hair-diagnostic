import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  emptySkinCommonAnswers,
  loadSkinCommonProfile,
  sanitizeSkinCommonAnswers,
  skinCommonStorageKey,
} from '../../apps/patient-portal/src/lib/skin-fact/skinJourney';

const source = (name: string) => readFileSync(resolve(process.cwd(), `apps/patient-portal/src/components/skin-fact/${name}`), 'utf8');
const memory = (entries: Record<string, string>) => ({
  getItem: (key: string) => entries[key] ?? null,
  setItem: (key: string, value: string) => { entries[key] = value; },
});

describe('versioned Skin FACT common entry and concern selection', () => {
  it('stores only the five approved common-profile values', () => {
    expect(Object.keys(emptySkinCommonAnswers())).toEqual(['name', 'age', 'gender', 'skinType', 'sensitiveSkin']);
  });

  it.each(['phone', 'email', 'country', 'city', 'address', 'primaryConcern'])('discards legacy %s', (field) => {
    const answers = sanitizeSkinCommonAnswers({ name: 'Asha', age: '28', gender: 'Female', skinType: 'Normal', sensitiveSkin: 'No', [field]: 'private' });
    expect(answers).not.toHaveProperty(field);
  });

  it('migrates legacy state without removed contact, location, or primary-concern values', () => {
    const entries: Record<string, string> = {};
    entries['drfact:skin-fact:common-intake:v1:clinic'] = JSON.stringify({
      productType: 'SKIN_FACT', clinicSlug: 'clinic', sessionId: 's', completedAt: 'x',
      answers: { name: 'Asha', age: '28', gender: 'Female', skinType: 'Normal', sensitiveSkin: 'No', phone: 'x', city: 'x', primaryConcern: 'PIGMENTATION' },
    });
    const profile = loadSkinCommonProfile(memory(entries) as Storage, 'clinic');
    expect(profile?.answers).toEqual({ name: 'Asha', age: '28', gender: 'Female', skinType: 'Normal', sensitiveSkin: 'No' });
    expect(entries[skinCommonStorageKey('clinic')]).toBeTruthy();
  });

  it('uses semantic multi-select cards and selectedConcerns as the source of truth', () => {
    const selector = source('SkinConcernMultiSelect.tsx');
    expect(selector).toContain('aria-pressed={isSelected}');
    expect(selector).toContain('SkinConcern[]');
    expect(selector).not.toContain('role="radiogroup"');
    expect(selector).not.toContain('primaryConcern');
  });

  it('does not offer Hair Loss or miscellaneous concerns', () => {
    expect(source('SkinConcernMultiSelect.tsx')).not.toMatch(/HAIR_LOSS|Hair Loss|OTHER|miscellaneous/);
  });
});

describe('revised Pigmentation visuals', () => {
  const css = () => source('pigmentation.module.css');
  it('uses dedicated aqua and cerulean tokens', () => {
    expect(css()).toContain('--pigmentation-crystal-blue:#a8e2fa');
    expect(css()).toContain('--pigmentation-aqua:#37afe5');
    expect(css()).toContain('--pigmentation-cerulean:#148fcf');
  });
  it('contains no previous amber-dominant Pigmentation tokens', () => {
    expect(css()).not.toMatch(/pigmentation-(champagne|amber|warm-gold|soft-sand)/i);
    expect(css()).not.toMatch(/#d8be8a|#cba66f|#d6a15e/i);
  });
  it('has serum bubble motion and a reduced-motion fallback', () => {
    expect(css()).toContain('@keyframes pigmentFloat');
    expect(css()).toContain('@media(prefers-reduced-motion:reduce)');
    expect(css()).toContain('animation:none!important');
  });
  it('keeps common screens neutral rather than blue-dominant', () => {
    expect(css()).toContain('.commonShell,.commonPage');
    expect(css()).toContain('#fbf9f7');
  });
  it('keeps mobile flow bounded and single-column', () => {
    expect(css()).toContain('overflow-x:hidden');
    expect(css()).toContain('@media(max-width:700px)');
  });
});