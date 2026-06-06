import type { AvatarScript, ValidationResult } from '../types';

export function validateAvatarScript(script: AvatarScript): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!script.title) errors.push('script.title is required');
  if (!script.patientName) errors.push('script.patientName is required');
  if (!script.intro?.text) errors.push('script.intro.text is required');
  if (!script.outro?.text) errors.push('script.outro.text is required');
  if (!script.generatedAt) errors.push('script.generatedAt is required');

  if (!script.scenes || script.scenes.length === 0) {
    errors.push('script.scenes must not be empty');
  }

  if (script.totalDurationSeconds <= 0) {
    errors.push('script.totalDurationSeconds must be positive');
  }
  if (script.totalDurationSeconds > 600) {
    warnings.push('Total avatar script duration exceeds 10 minutes — consider trimming for patient engagement');
  }

  script.scenes?.forEach((scene, i) => {
    if (!scene.sceneId) errors.push(`scenes[${i}].sceneId is required`);
    if (!scene.title) errors.push(`scenes[${i}].title is required`);
    if (!scene.narration) errors.push(`scenes[${i}].narration is required`);
    if (!scene.visualCue) warnings.push(`scenes[${i}].visualCue is missing`);
    if (scene.durationSeconds <= 0) {
      errors.push(`scenes[${i}].durationSeconds must be positive`);
    }
    if (scene.durationSeconds > 120) {
      warnings.push(`scenes[${i}] is longer than 2 minutes — may lose patient attention`);
    }

    scene.segments?.forEach((seg, j) => {
      if (!seg.text) errors.push(`scenes[${i}].segments[${j}].text is required`);
      if (!seg.emotion) errors.push(`scenes[${i}].segments[${j}].emotion is required`);
    });
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
