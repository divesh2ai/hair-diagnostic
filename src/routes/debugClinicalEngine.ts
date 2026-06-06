import express from 'express';

import { evaluateClinicalProfile } from '../packages/ai-engine/clinical-engine/evaluateClinicalProfile';
import { mapTherapyNeeds } from '../packages/ai-engine/therapy-engine/mapTherapyNeeds';
import { scoreKits } from '../packages/ai-engine/kit-scorer/scoreKits';
import questionnaire from '../packages/ai-engine/questionnaire-engine/schema/questionnaire.schema.json';

// QUESTIONNAIRE ENGINE
import {
  getNextQuestion,
  extractSignals,
} from '../packages/ai-engine/questionnaire-engine/questionnaireEngine';

import {
  shouldShowQuestion
} from '../packages/ai-engine/questionnaire-engine/helpers';

const router = express.Router();

/**
 * ============================================================================
 * DEBUG CLINICAL ENGINE
 * ============================================================================
 *
 * FULL PIPELINE:
 *
 * Questionnaire
 * → Clinical Engine
 * → Therapy Engine
 * → Kit Scorer
 * → Rule Trace
 * → UI Payload
 *
 * This route becomes the foundation for:
 *
 * - Sandbox debugger
 * - Doctor dashboard
 * - Conversational AI
 * - Explainability layer
 * - Narrative engine
 * - 3D AI Doctor
 *
 * ============================================================================
 */

router.post('/debug-clinical-engine', async (req, res) => {
  try {
    const answers = req.body || {};

    const startedAt = performance.now();

    /**
     * ========================================================================
     * STEP 1 — QUESTION FLOW
     * ========================================================================
     */

   const allQuestions =
  questionnaire.sections.flatMap(
    (section: any) => section.questions || []
  );

const visibleQuestions = allQuestions.filter((q: any) =>
  shouldShowQuestion(q, answers)
);

const nextQuestion = allQuestions.find((q: any) => {
  return (
    shouldShowQuestion(q, answers) &&
    answers[q.id] === undefined
  );
});

    const extractedSignals = extractSignals(answers);

    /**
     * ========================================================================
     * STEP 2 — CLINICAL PROFILE
     * ========================================================================
     */

    const clinicalProfile = evaluateClinicalProfile(answers);

    /**
     * ========================================================================
     * STEP 3 — THERAPY NEEDS
     * ========================================================================
     */

    const therapyNeeds = mapTherapyNeeds(clinicalProfile);

    /**
     * ========================================================================
     * STEP 4 — KIT SCORING
     * ========================================================================
     */

    const kitRecommendation = scoreKits(
      clinicalProfile,
      therapyNeeds,
      answers,
      {
        clinicId: 'debug-clinic',

        availableKits: [
          'HAIR FACT TE GOLD',
          'HAIR FACT TE GOLD VEG',
          'PRO IMMUNE GOLD',
          'PRO IMMUNE VEG',
          'MPHL',
          'MPHL PLUS',
          'FPHL',
          'FPHL PLUS',
          'PRO FACT META B',
          'PRO FACT META B PCOS',
          'PRO FACT META B HYPOTHYROID',
          'F-PCOS -1',
          'F-PCOS VEG -1',
          'IRON UP GOLD',
          'RAPID WEIGHT LOSS SHIELD',
          'PHENOTYPE INFLAMATION',
          'EARLY GREYING CARE GOLD',
          'EARLY GREYING CARE VEG',
          'HAIR FACT HAIR BREAKAGE REPAIR(HBR)',
          'HEALTHY - 9'
        ],

        substitutions: {}
      }
    );

    const completedAt = performance.now();

    /**
     * ========================================================================
     * RESPONSE
     * ========================================================================
     */

    return res.json({
      success: true,

      executionMs: Number(
        (completedAt - startedAt).toFixed(2)
      ),

      questionnaire: {
        totalVisibleQuestions: visibleQuestions.length,
        nextQuestion,
      },

      extractedSignals,

      clinicalProfile,

      therapyNeeds,

      kitRecommendation,

      debug: {
        primaryDiagnosis:
          clinicalProfile.primaryDiagnosis,

        severity:
          clinicalProfile.severity,

        protocol:
          kitRecommendation.protocolLabel,

        appliedRules:
          kitRecommendation.appliedRules,

        ruleTrace:
          kitRecommendation.ruleTrace || [],

        rankedKits:
          kitRecommendation.rankedKits.map((k) => ({
            phase: k.phase,
            kitId: k.kitId,
            score: k.score,
          })),
      },
    });

  } catch (err: any) {

    console.error(
      'DEBUG_CLINICAL_ENGINE_ERROR:',
      err
    );

    return res.status(500).json({
      success: false,

      error:
        err?.message || 'unknown_error',

      stack:
        process.env.NODE_ENV === 'development'
          ? err?.stack
          : undefined,
    });
  }
});

export default router;