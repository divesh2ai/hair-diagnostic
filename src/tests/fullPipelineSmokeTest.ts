import { buildFullRecommendation } from '../packages/ai-engine/recommendation-engine';
import { runQuestionnaireEngine } from '../packages/ai-engine/questionnaire-engine';
import { runClinicalDetection } from '../packages/ai-engine/clinical-engine';
import { runTherapyEngine } from '../packages/ai-engine/therapy-engine';
import { runNarrativeEngine } from '../packages/ai-engine/narrative-engine';
import { generatePdfPayload } from '../packages/ai-engine/pdf-engine';
import { generateWhatsappSummary } from '../packages/ai-engine/whatsapp-engine';
import { generateAvatarScript } from '../packages/ai-engine/avatar-engine';
import type { TherapyNeed, ScalpCondition, SerumTrigger } from '../packages/ai-engine/recommendation-engine';

// Colors
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  red: "\x1b[31m"
};

// Helper
function assertExists(name: string, value: any) {
  if (value === undefined || value === null) {
    throw new Error(`${colors.red}Assertion failed: ${name} is undefined or null${colors.reset}`);
  }
}

async function runSmokeTest() {
  console.log(`\n${colors.magenta}==================================================`);
  console.log('🚀 RUNNING FULL HAIROS PIPELINE SMOKE TEST');
  console.log(`==================================================${colors.reset}\n`);

  console.time(`${colors.green}FullPipelineExecution${colors.reset}`);

  // PATIENT FIXTURE
  const patientAnswers = {
    gender: 'Female',
    age: 31,
    concerns: ['Progressive widening partition', 'Chronic shedding'],
    lifestyle: ['Stress', 'Vegetarian'],
    labMarkers: { ferritin: 'borderline' },
    scalp: ['Mild dandruff'],
    familyHistory: true
  };

  // STEP 1 — QUESTIONNAIRE ENGINE
  console.time('QuestionnaireEngine');
  const questionnaireResult = runQuestionnaireEngine(patientAnswers);
  console.timeEnd('QuestionnaireEngine');
  console.log(`\n${colors.cyan}==================================================`);
  console.log('STEP 1: QUESTIONNAIRE ENGINE');
  console.log(`==================================================${colors.reset}`);
  console.log(`${colors.yellow}Extracted Signals:${colors.reset}`, questionnaireResult.extractedSignals);
  console.log(`${colors.yellow}Scores:${colors.reset}`, questionnaireResult.scores);
  assertExists('questionnaireResult.extractedSignals', questionnaireResult.extractedSignals);

  // STEP 2 — CLINICAL ENGINE
  console.time('ClinicalEngine');
  const clinicalResult = runClinicalDetection(questionnaireResult.extractedSignals);
  console.timeEnd('ClinicalEngine');
  console.log(`\n${colors.cyan}==================================================`);
  console.log('STEP 2: CLINICAL ENGINE');
  console.log(`==================================================${colors.reset}`);
  console.log(`${colors.yellow}Condition:${colors.reset}`, clinicalResult.detectedConditions.join(', '));
  console.log(`${colors.yellow}Severity:${colors.reset}`, clinicalResult.severity);
  console.log(`${colors.yellow}Confidence:${colors.reset}`, clinicalResult.confidence);
  console.log(`${colors.yellow}Contradictions:${colors.reset}`, clinicalResult.contradictions.join(', ') || 'None');
  assertExists('clinicalResult.detectedConditions', clinicalResult.detectedConditions);

  // STEP 3 — THERAPY ENGINE
  console.time('TherapyEngine');
  const therapyResult = runTherapyEngine(clinicalResult);
  console.timeEnd('TherapyEngine');
  console.log(`\n${colors.cyan}==================================================`);
  console.log('STEP 3: THERAPY ENGINE');
  console.log(`==================================================${colors.reset}`);
  console.log(`${colors.yellow}Therapy Needs:${colors.reset}`, therapyResult.therapyNeeds);
  console.log(`${colors.yellow}Protocol Rationale:${colors.reset}`, therapyResult.protocolRationale);
  console.log(`${colors.yellow}Rule Trace:${colors.reset}`, therapyResult.ruleTrace);
  assertExists('therapyResult.therapyNeeds', therapyResult.therapyNeeds);

  // STEP 4 — RECOMMENDATION ENGINE
  console.time('RecommendationEngine');
  const profile = {
    age: 31,
    gender: 'Female' as const,
    severity: 'Severe' as any,
    conditions: clinicalResult.detectedConditions,
    allergies: [],
    currentMedications: [],
    previousTreatments: [],
    isAdvancedGrade: false,
    isSevereGrade: false,
    isChronic: true,
    hasHighDhtBurden: false,
    isAggressiveProgression: true,
    isLowExpectedResponse: false
  };

  const therapyNeeds = therapyResult.therapyNeeds as TherapyNeed[];
  const scalpConditions: ScalpCondition[] = ['dandruff'];
  const serumTriggers: SerumTrigger[] = ['follicular stress', 'miniaturization'];

  const recommendation = buildFullRecommendation(
    profile,
    therapyNeeds,
    scalpConditions,
    serumTriggers
  );
  console.timeEnd('RecommendationEngine');

  console.log(`\n${colors.cyan}==================================================`);
  console.log('STEP 4: RECOMMENDATION ENGINE');
  console.log(`==================================================${colors.reset}`);
  console.log(`${colors.yellow}KITS:${colors.reset}\n*`, recommendation.internalProtocol.primaryProtocol);
  recommendation.internalProtocol.supportProtocols.forEach((p: string) => console.log('*', p));
  console.log(`\n${colors.yellow}TOPICALS:${colors.reset}\n*`, recommendation.internalProtocol.supportTopicals?.selectedTopical || 'None');
  console.log(`\n${colors.yellow}SERUM:${colors.reset}\n*`, recommendation.internalProtocol.serumSupport?.selectedSerum || 'None');
  console.log(`\n${colors.yellow}SHAMPOO:${colors.reset}\n*`, recommendation.internalProtocol.scalpSupport?.selectedShampoo || 'None');
  console.log(`\n${colors.yellow}PROCEDURES:${colors.reset}\n*`, recommendation.internalProtocol.procedures?.selectedProcedures.join(', ') || 'None');
  assertExists('recommendation.internalProtocol', recommendation.internalProtocol);

  // STEP 5 — NARRATIVE ENGINE
  console.time('NarrativeEngine');
  const narrative = runNarrativeEngine(recommendation);
  console.timeEnd('NarrativeEngine');
  console.log(`\n${colors.cyan}==================================================`);
  console.log('STEP 5: NARRATIVE ENGINE');
  console.log(`==================================================${colors.reset}`);
  console.log(`${colors.yellow}Doctor Narrative (Preview):${colors.reset}`, narrative.doctorNarrative.substring(0, 300));
  console.log(`${colors.yellow}Patient Narrative (Preview):${colors.reset}`, narrative.patientNarrative.substring(0, 300));
  console.log(`${colors.yellow}Lengths - Doctor:${colors.reset}`, narrative.doctorNarrative.length, `| ${colors.yellow}Patient:${colors.reset}`, narrative.patientNarrative.length);
  assertExists('narrative.doctorNarrative', narrative.doctorNarrative);

  // STEP 6 — PDF PAYLOAD
  console.time('PdfPayload');
  const pdfPayload = generatePdfPayload(recommendation, narrative);
  console.timeEnd('PdfPayload');
  console.log(`\n${colors.cyan}==================================================`);
  console.log('STEP 6: PDF PAYLOAD');
  console.log(`==================================================${colors.reset}`);
  console.log(`${colors.green}PDF payload validated.${colors.reset}`);
  console.log(`${colors.yellow}Fields present:${colors.reset}`, pdfPayload.fields.join(', '));
  assertExists('pdfPayload.status', pdfPayload.status);

  // STEP 7 — WHATSAPP SUMMARY
  console.time('WhatsappSummary');
  const whatsapp = generateWhatsappSummary(recommendation);
  console.timeEnd('WhatsappSummary');
  console.log(`\n${colors.cyan}==================================================`);
  console.log('STEP 7: WHATSAPP SUMMARY');
  console.log(`==================================================${colors.reset}`);
  console.log(`${colors.yellow}Summary:${colors.reset}`, whatsapp.summary);
  console.log(`${colors.yellow}CTA:${colors.reset}`, whatsapp.cta);
  console.log(`${colors.yellow}Next Steps:${colors.reset}`, whatsapp.nextSteps);
  assertExists('whatsapp.summary', whatsapp.summary);

  // STEP 8 — 3D AVATAR SCRIPT
  console.time('AvatarScript');
  const avatar = generateAvatarScript(recommendation);
  console.timeEnd('AvatarScript');
  console.log(`\n${colors.cyan}==================================================`);
  console.log('STEP 8: 3D AVATAR SCRIPT');
  console.log(`==================================================${colors.reset}`);
  console.log(`${colors.yellow}Script Preview:${colors.reset}`, avatar.script.substring(0, 100));
  console.log(`${colors.yellow}Section Count:${colors.reset}`, avatar.sectionCount);
  console.log(`${colors.yellow}Sections:${colors.reset}`, avatar.sections.join(', '));
  assertExists('avatar.script', avatar.script);

  console.log(`\n${colors.green}==================================================`);
  console.log('HAIROS PIPELINE SUCCESS');
  console.log(`==================================================${colors.reset}`);
  console.log('Questionnaire: OK');
  console.log('Clinical Engine: OK');
  console.log('Therapy Engine: OK');
  console.log('Recommendation Engine: OK');
  console.log('Narrative Engine: OK');
  console.log('PDF Payload: OK');
  console.log('WhatsApp Summary: OK');
  console.log('3D Avatar Script: OK');
  console.log(`${colors.green}==================================================${colors.reset}\n`);
  
  console.timeEnd(`${colors.green}FullPipelineExecution${colors.reset}`);
}

runSmokeTest().catch(console.error);
