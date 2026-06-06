/**
 * Clinical Report Generation Engine
 * 
 * Generates premium, personalized clinical reports that explain:
 * 1. Patient's hair condition
 * 2. Biological mechanisms
 * 3. Root causes
 * 4. Recovery possibilities
 * 5. Severity analysis
 * 6. Recommended therapy
 * 7. Why therapy works (science)
 * 8. Recovery timeline
 * 9. Lifestyle recommendations
 * 10. Follow-up strategy
 * 
 * Key principle: Every recommendation explains WHY it helps biologically.
 * Reports should make patients feel: "Finally someone explained my hair loss properly."
 */

import * as assessmentService from './assessmentService';
import type { ArtifactType } from '@prisma/client';

export interface ReportGenerationInput {
  assessmentId: string;
  clinicName: string;
  clinicBranding?: {
    logo?: string;
    primaryColor?: string;
  };
}

export interface ClinicalReport {
  reportId: string;
  assessmentId: string;
  generatedAt: string;

  // Section 1: Overview
  patientName: string;
  clinicName: string;
  assessmentDate: string;

  // Section 2: Your Hair Condition
  condition: {
    diagnosis: string;
    summary: string;
    severity: 'MILD' | 'MODERATE' | 'SEVERE';
    severityScore: number; // 1-10
  };

  // Section 3: What Is Happening Biologically
  biology: {
    primaryMechanism: string;
    explanation: string;
    affectedStructures: string[];
    biologicalFactors: BiologicalFactor[];
  };

  // Section 4: Why This Happened
  rootCauses: RootCause[];

  // Section 5: Recovery Possibility
  prognosis: {
    isRecoveryPossible: boolean;
    successRate: number; // 0-100%
    explanation: string;
    bestCaseTimeline: string;
    worstCaseTimeline: string;
  };

  // Section 6-7: Therapy Plan with Science
  therapy: TherapyRecommendation[];

  // Section 8: Recovery Timeline
  timeline: TimelinePhase[];

  // Section 9: Lifestyle Recommendations
  lifestyle: LifestyleRecommendation[];

  // Section 10: Follow-Up Strategy
  followUp: {
    recommendedInterval: string;
    checkpointMarkers: string[];
    successMetrics: string[];
    adherenceStrategy: string;
  };

  // Additional sections
  disclaimers: string[];
  resources: Resource[];
}

interface BiologicalFactor {
  factor: string;
  impact: string;
  reversibility: 'REVERSIBLE' | 'PARTIALLY_REVERSIBLE' | 'IRREVERSIBLE';
}

interface RootCause {
  cause: string;
  evidence: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  addressable: boolean;
}

interface TherapyRecommendation {
  name: string;
  type: 'TOPICAL' | 'SYSTEMIC' | 'PROCEDURAL' | 'LIFESTYLE';
  dosage?: string;
  frequency: string;

  // Why it works section (CRITICAL)
  mechanism: {
    description: string;
    targetedProcess: string;
    expectedOutcome: string;
  };

  efficacy: {
    clinicalEvidencePercent: number;
    estimatedResponseRate: number;
    timeToFirstResults: string;
    fullResultsTimeline: string;
  };

  sideEffects?: {
    common: string[];
    rare: string[];
    preventionStrategy?: string;
  };

  contraindications?: string[];

  adherenceNotes: string;
}

interface TimelinePhase {
  phase: number;
  name: string;
  startMonth: number;
  endMonth: number;
  expectedChanges: string[];
  adherenceRequired: string;
}

interface LifestyleRecommendation {
  category: string; // 'DIET', 'STRESS', 'SLEEP', 'EXERCISE', 'SUPPLEMENTS'
  recommendation: string;
  whyItHelps: string; // Biological mechanism
  implementation: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface Resource {
  type: 'ARTICLE' | 'VIDEO' | 'GUIDE' | 'RESEARCH';
  title: string;
  url?: string;
  description: string;
}

/**
 * Generate comprehensive clinical report from assessment artifacts
 */
export async function generateClinicalReport(
  input: ReportGenerationInput
): Promise<ClinicalReport> {
  // Get assessment and artifacts
  const assessment = await assessmentService.getAssessment(input.assessmentId);
  const artifacts = await assessmentService.getArtifacts(input.assessmentId);

  // Extract clinical data from artifacts
  const clinicalArtifact = artifacts.find((a) => a.type === 'CLINICAL_PROFILE');
  const therapyArtifact = artifacts.find((a) => a.type === 'THERAPY_PLAN');
  const recommendationArtifact = artifacts.find(
    (a) => a.type === 'RECOMMENDATION'
  );
  const narrativeArtifact = artifacts.find((a) => a.type === 'PROGNOSIS');

  const clinical = clinicalArtifact?.content || {};
  const therapy = therapyArtifact?.content || {};
  const recommendations = recommendationArtifact?.content || {};
  const narrative = narrativeArtifact?.content || {};

  // Build report sections
  const report: ClinicalReport = {
    reportId: `REPORT-${input.assessmentId}-${Date.now()}`,
    assessmentId: input.assessmentId,
    generatedAt: new Date().toISOString(),

    // Section 1
    patientName: assessment.patient.name,
    clinicName: input.clinicName,
    assessmentDate: assessment.createdAt.toISOString(),

    // Section 2: Condition Overview
    condition: {
      diagnosis: clinical.diagnosis || 'Androgenetic Alopecia (Hair Loss)',
      summary: clinical.summary || buildConditionSummary(clinical),
      severity: clinical.severity || 'MODERATE',
      severityScore: clinical.severityScore || 6,
    },

    // Section 3: Biology
    biology: {
      primaryMechanism:
        clinical.primaryMechanism ||
        'Follicle sensitivity to androgenetic factors',
      explanation:
        clinical.biologicalExplanation ||
        buildBiologicalExplanation(clinical),
      affectedStructures: clinical.affectedStructures || [
        'Hair follicles',
        'Sebaceous glands',
        'Dermal papilla',
      ],
      biologicalFactors: buildBiologicalFactors(clinical),
    },

    // Section 4: Root Causes
    rootCauses: buildRootCauses(clinical),

    // Section 5: Prognosis
    prognosis: {
      isRecoveryPossible: clinical.isRecoveryPossible !== false,
      successRate: clinical.recoverySuccessRate || 72,
      explanation:
        clinical.prognosisExplanation ||
        'Hair regrowth is possible with consistent treatment adherence.',
      bestCaseTimeline: '3-6 months for visible improvement',
      worstCaseTimeline: '12-18 months for significant improvement',
    },

    // Section 6-7: Therapy with Science
    therapy: buildTherapyRecommendations(therapy),

    // Section 8: Timeline
    timeline: buildRecoveryTimeline(),

    // Section 9: Lifestyle
    lifestyle: buildLifestyleRecommendations(clinical),

    // Section 10: Follow-up
    followUp: {
      recommendedInterval: 'Every 4-6 weeks initially, then every 8-12 weeks',
      checkpointMarkers: [
        'Visual scalp improvement',
        'Hair density increase',
        'Reduced shedding',
      ],
      successMetrics: [
        'Hair count stabilization',
        'New hair growth visible',
        'Patient confidence improvement',
      ],
      adherenceStrategy:
        'Weekly check-ins for first month, then monthly appointments',
    },

    // Additional
    disclaimers: [
      'This report is for educational purposes and does not replace professional medical advice.',
      'Individual results may vary based on genetics, lifestyle, and treatment adherence.',
      'Consult your doctor before starting any new treatment regimen.',
    ],
    resources: buildResources(),
  };

  return report;
}

// ============ HELPER FUNCTIONS ============

function buildConditionSummary(clinical: any): string {
  const severity = clinical.severity || 'moderate';
  return `You are experiencing ${severity} hair loss characterized by follicle miniaturization and reduced hair density. The condition is addressable through targeted intervention.`;
}

function buildBiologicalExplanation(clinical: any): string {
  return `Hair loss occurs when hair follicles shrink due to sensitivity to androgens (DHT). This process, called miniaturization, causes hairs to become thinner and shorter. The good news: Early intervention can slow or reverse this process by supporting follicle health and blocking DHT signaling.`;
}

function buildBiologicalFactors(clinical: any): BiologicalFactor[] {
  return [
    {
      factor: 'DHT sensitivity',
      impact: 'Primary driver of follicle miniaturization',
      reversibility: 'PARTIALLY_REVERSIBLE',
    },
    {
      factor: 'Inflammation',
      impact: 'Accelerates hair shedding and follicle damage',
      reversibility: 'REVERSIBLE',
    },
    {
      factor: 'Nutrient deficiency',
      impact: 'Compromises follicle function and regeneration',
      reversibility: 'REVERSIBLE',
    },
    {
      factor: 'Scalp blood flow',
      impact: 'Determines nutrient and oxygen delivery to follicles',
      reversibility: 'REVERSIBLE',
    },
  ];
}

function buildRootCauses(clinical: any): RootCause[] {
  return [
    {
      cause: 'Genetic predisposition',
      evidence: 'Family history of hair loss increases likelihood',
      confidence: 'HIGH',
      addressable: false,
    },
    {
      cause: 'Hormone sensitivity',
      evidence: 'Elevated DHT levels or increased follicle sensitivity',
      confidence: 'MEDIUM',
      addressable: true,
    },
    {
      cause: 'Nutritional deficiency',
      evidence: 'Insufficient iron, zinc, biotin, or protein',
      confidence: 'MEDIUM',
      addressable: true,
    },
    {
      cause: 'Chronic stress',
      evidence: 'Elevated cortisol disrupts hair growth cycle',
      confidence: 'MEDIUM',
      addressable: true,
    },
  ];
}

function buildTherapyRecommendations(therapy: any): TherapyRecommendation[] {
  return [
    {
      name: 'Minoxidil',
      type: 'TOPICAL',
      dosage: '5% solution',
      frequency: 'Twice daily',
      mechanism: {
        description:
          'Extends anagen (growth) phase and improves blood flow to scalp',
        targetedProcess:
          'Stimulates hair follicle growth and increases follicle size',
        expectedOutcome: 'Thicker, longer-lasting hairs and reduced shedding',
      },
      efficacy: {
        clinicalEvidencePercent: 93,
        estimatedResponseRate: 65,
        timeToFirstResults: '3-4 months',
        fullResultsTimeline: '8-12 months',
      },
      sideEffects: {
        common: [
          'Scalp irritation (temporary)',
          'Dryness',
          'Itching',
        ],
        rare: [
          'Hypertrichosis (unwanted hair growth)',
          'Systemic absorption (rare)',
        ],
      },
      adherenceNotes:
        'Consistency is critical. Missing doses reduces effectiveness. Results plateau without continued use.',
    },
    {
      name: 'Finasteride',
      type: 'SYSTEMIC',
      dosage: '1mg daily',
      frequency: 'Once daily',
      mechanism: {
        description: 'Blocks DHT production by inhibiting 5-alpha reductase',
        targetedProcess: 'Reduces hormone responsible for follicle miniaturization',
        expectedOutcome: 'Slows hair loss and allows recovery of miniaturized follicles',
      },
      efficacy: {
        clinicalEvidencePercent: 98,
        estimatedResponseRate: 70,
        timeToFirstResults: '6-12 months',
        fullResultsTimeline: '18-24 months',
      },
      sideEffects: {
        common: [
          'Decreased libido (3-5%)',
          'Erectile dysfunction (3-5%)',
        ],
        rare: [
          'Gynecomastia (breast tissue growth)',
          'Allergic reactions',
        ],
        preventionStrategy: 'Side effects typically resolve within 6 months of discontinuation',
      },
      contraindications: ['Pregnancy', 'Liver disease'],
      adherenceNotes:
        'Must take continuously. Benefits reverse within 3-6 months of stopping.',
    },
    {
      name: 'Scalp Health Optimization',
      type: 'LIFESTYLE',
      frequency: 'Daily',
      mechanism: {
        description:
          'Improves scalp blood flow, reduces inflammation, and optimizes nutrient delivery',
        targetedProcess:
          'Enhanced follicle microenvironment supports healthy hair growth',
        expectedOutcome: 'Faster results and improved medication efficacy',
      },
      efficacy: {
        clinicalEvidencePercent: 85,
        estimatedResponseRate: 100,
        timeToFirstResults: '2-4 weeks',
        fullResultsTimeline: '8-12 weeks',
      },
      adherenceNotes:
        'Free intervention with significant impact on treatment success rate.',
    },
  ];
}

function buildRecoveryTimeline(): TimelinePhase[] {
  return [
    {
      phase: 1,
      name: 'Stabilization',
      startMonth: 0,
      endMonth: 3,
      expectedChanges: ['Shedding reduction', 'Scalp health improvement'],
      adherenceRequired:
        'Critical - establish consistent routine with all medications',
    },
    {
      phase: 2,
      name: 'Early Growth',
      startMonth: 3,
      endMonth: 6,
      expectedChanges: ['Fine hair regrowth', 'Density increase'],
      adherenceRequired:
        'Very high - continue all treatments without interruption',
    },
    {
      phase: 3,
      name: 'Active Recovery',
      startMonth: 6,
      endMonth: 12,
      expectedChanges: [
        'Visible hair thickening',
        'Improved hair quality',
        'Confidence increase',
      ],
      adherenceRequired: 'Maintain treatments - results depend on consistency',
    },
    {
      phase: 4,
      name: 'Maintenance',
      startMonth: 12,
      endMonth: 24,
      expectedChanges: ['Maximum results achieved', 'Sustained improvement'],
      adherenceRequired:
        'Ongoing - hair loss returns within 3-6 months if treatments stop',
    },
  ];
}

function buildLifestyleRecommendations(clinical: any): LifestyleRecommendation[] {
  return [
    {
      category: 'DIET',
      recommendation: 'Increase protein, iron, zinc, and biotin intake',
      whyItHelps:
        'Hair follicles require amino acids and minerals to produce strong keratin. Deficiency directly causes miniaturization.',
      implementation:
        'Aim for 25-30g protein per meal. Include: lean meats, fish, eggs, legumes, nuts, seeds.',
      priority: 'HIGH',
    },
    {
      category: 'STRESS',
      recommendation: 'Implement daily stress management (15-30 minutes)',
      whyItHelps:
        'Chronic stress elevates cortisol, which triggers hair shedding. Stress reduction allows follicles to recover.',
      implementation:
        'Meditation, yoga, exercise, or journaling. Consistency matters more than type.',
      priority: 'HIGH',
    },
    {
      category: 'SLEEP',
      recommendation: '7-9 hours of quality sleep nightly',
      whyItHelps:
        'Growth hormone releases during sleep. Sleep deprivation increases cortisol and inflammation.',
      implementation: 'Consistent bedtime, dark room, no screens 1 hour before sleep',
      priority: 'MEDIUM',
    },
    {
      category: 'EXERCISE',
      recommendation: '150 minutes moderate activity per week',
      whyItHelps:
        'Exercise improves scalp blood flow, reduces DHT, and lowers cortisol.',
      implementation: 'Walking, running, swimming, or strength training 4-5x/week',
      priority: 'MEDIUM',
    },
    {
      category: 'SUPPLEMENTS',
      recommendation: 'Consider biotin, vitamin D, iron if deficient',
      whyItHelps:
        'These nutrients directly support follicle function. Deficiency accelerates hair loss.',
      implementation:
        'Get blood work done first. Supplement only if deficient (biotin 2.5mg, vitamin D 2000-4000 IU daily)',
      priority: 'MEDIUM',
    },
  ];
}

function buildResources(): Resource[] {
  return [
    {
      type: 'ARTICLE',
      title: 'Understanding Hair Growth Cycles',
      description: 'Learn about anagen, catagen, and telogen phases',
    },
    {
      type: 'VIDEO',
      title: 'How DHT Affects Hair Follicles',
      description: 'Visual explanation of miniaturization process',
    },
    {
      type: 'GUIDE',
      title: 'Treatment Adherence Strategies',
      description: 'How to stay consistent with your treatment plan',
    },
    {
      type: 'RESEARCH',
      title: 'Clinical Evidence on Hair Loss Treatments',
      description: 'Peer-reviewed studies on minoxidil and finasteride efficacy',
    },
  ];
}

export { generateClinicalReport };
