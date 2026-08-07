import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import acne from '../../src/packages/ai-engine/questionnaire-engine/schema/skin-acne.schema.json';
import pigmentation from '../../src/packages/ai-engine/questionnaire-engine/schema/skin-pigmentation.schema.json';
import antiAgeing from '../../src/packages/ai-engine/questionnaire-engine/schema/skin-anti-ageing.schema.json';

describe('Skin FACT optional clinical images', () => {
  it('keeps Acne photos optional', () => {
    const questions = acne.sections.flatMap((section) => section.questions);
    expect(questions.find((question) => question.id === 'acne_photos')?.required).toBe(false);
  });
  it('makes Pigmentation clinical images optional', () => {
    expect(pigmentation.questions.find((question) => question.id === 'PIG_14')?.required).toBe(false);
  });
  it('makes Anti-Ageing clinical images optional', () => {
    expect(antiAgeing.questions.find((question) => question.id === 'AA_10')?.required).toBe(false);
  });
});

describe('Skin FACT microphone coverage', () => {
  const voiceComponent = readFileSync(
    'apps/patient-portal/src/components/skin-fact/VoiceTextField.tsx',
    'utf8',
  );
  const acneUi = readFileSync(
    'apps/patient-portal/src/components/skin-fact/SkinAcneQuestionnaire.tsx',
    'utf8',
  );
  const pigmentationUi = readFileSync(
    'apps/patient-portal/src/components/skin-fact/PigmentationQuestionnaire.tsx',
    'utf8',
  );
  const antiAgeingUi = readFileSync(
    'apps/patient-portal/src/components/skin-fact/AntiAgeingQuestionnaire.tsx',
    'utf8',
  );
  it('provides a reusable microphone control with an unsupported-browser state', () => {
    expect(voiceComponent).toContain('webkitSpeechRecognition');
    expect(voiceComponent).toContain('Answer using microphone');
    expect(voiceComponent).toContain('Voice input is unavailable in this browser');
  });
  it('uses microphone-enabled fields in Acne', () => {
    expect(acneUi).toContain('<VoiceTextField multiline={false}');
    expect(acneUi).toContain('<VoiceTextField className={styles.textarea}');
  });
  it('uses microphone-enabled fields throughout Pigmentation', () => {
    expect(pigmentationUi.match(/<VoiceTextField/g)?.length).toBeGreaterThanOrEqual(5);
  });
  it('uses microphone-enabled fields in Anti-Ageing', () => {
    expect(antiAgeingUi).toContain("question.type==='textarea'&&<VoiceTextField");
  });
  it('shows consistent optional-photo guidance in all three modules', () => {
    const phrase = 'support the best possible outcome';
    expect(acneUi).toContain(phrase);
    expect(pigmentationUi).toContain(phrase);
    expect(antiAgeingUi).toContain(phrase);
  });
});
