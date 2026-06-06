import type { AvatarScript } from '../types';

// ─── Snapshot Fixtures for Avatar Script Tests ────────────────────────────────

export const EXPECTED_AVATAR_SCENE_IDS = [
  'understanding-problem',
  'why-follicles-weakened',
  'what-triggered-shedding',
  'how-therapies-work',
  'how-kits-support',
  'recovery-expectations',
  'compliance-motivation',
] as const;

export function assertAvatarScriptShape(script: AvatarScript): void {
  if (!script.title) throw new Error('Avatar script missing title');
  if (!script.patientName) throw new Error('Avatar script missing patientName');
  if (!script.intro?.text) throw new Error('Avatar script missing intro text');
  if (!script.outro?.text) throw new Error('Avatar script missing outro text');
  if (script.scenes.length === 0) throw new Error('Avatar script has no scenes');
  if (script.totalDurationSeconds <= 0) throw new Error('Avatar script duration must be positive');

  script.scenes.forEach((scene, i) => {
    if (!scene.sceneId) throw new Error(`Scene ${i} missing sceneId`);
    if (!scene.narration) throw new Error(`Scene ${i} missing narration`);
    if (!scene.visualCue) throw new Error(`Scene ${i} missing visualCue`);
    if (scene.durationSeconds <= 0) throw new Error(`Scene ${i} has non-positive duration`);
  });
}

export function assertSceneTextsAreDifferent(scripts: readonly AvatarScript[]): void {
  const narrations = scripts.map(s => s.scenes.map(sc => sc.narration).join(''));
  const uniqueNarrations = new Set(narrations);
  if (uniqueNarrations.size < scripts.length) {
    throw new Error('Two or more avatar scripts have identical narrations — personalisation failure');
  }
}
