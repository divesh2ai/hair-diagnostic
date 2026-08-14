-- BASELINE — the initial schema, reconstructed.
--
-- ── Why this file had to be written ─────────────────────────────────────────
-- Until now `prisma/migrations` did not describe a database. Its earliest
-- migration, 20260521_hairos_platform, opens with
--
--     ALTER TYPE "AssessmentStatus" ADD VALUE IF NOT EXISTS 'COMPLETED_WITH_REPORTS';
--     ALTER TABLE "Assessment" ADD COLUMN IF NOT EXISTS "rawResponses" JSONB;
--
-- on a type and a table that no migration in the folder ever creates. The
-- original schema was pushed with `prisma db push`, and migrations only began
-- being written afterwards. Against the live production database that is
-- invisible — every object already exists. Against an empty one it fails on
-- the first statement.
--
-- Comparing schema.prisma to the whole migration chain, the chain never
-- creates 5 tables (User, Session, Message, Diagnosis, Recommendation),
-- 3 enums (SystemRole, AssessmentSource, DeliveryStatus) or 55 indexes.
-- `prisma migrate deploy` into the empty staging project could not have
-- produced a working schema, and would not have said so clearly.
--
-- ── What this file is ───────────────────────────────────────────────────────
-- The complete current schema, generated with
--
--     prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
--
-- and then made idempotent (see below). Applied to an empty database it
-- produces exactly what schema.prisma describes; the 27 migrations that follow
-- it then run as no-ops, because every one of them is additive and this file
-- already contains their result.
--
-- ── Why every statement is idempotent ───────────────────────────────────────
-- CREATE TABLE / CREATE INDEX carry IF NOT EXISTS; CREATE TYPE and
-- ADD CONSTRAINT (which have no such clause in Postgres) are wrapped in a DO
-- block that swallows duplicate_object.
--
-- That is not decoration. Production already has all of these objects and does
-- NOT have a row for this migration in its _prisma_migrations table. The next
-- `migrate deploy` against production will therefore consider this migration
-- pending and run it. Written naively it would abort the deployment on the
-- first CREATE TYPE; written this way it is a verified no-op.
--
-- Even so, mark it resolved rather than relying on that:
--     PRODUCTION_MIGRATION=yes-apply-to-production --       npx prisma migrate resolve --applied 00000000000000_baseline
--
-- ── Do not edit ─────────────────────────────────────────────────────────────
-- Regenerate it only if it has never been applied anywhere. Once any database
-- records it in _prisma_migrations, its checksum is frozen.

DO $$ BEGIN
    CREATE TYPE "SystemRole" AS ENUM ('SUPER_ADMIN', 'ORG_ADMIN', 'CLINIC_ADMIN', 'DOCTOR', 'STAFF', 'PATIENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "AssessmentStatus" AS ENUM ('PENDING', 'QUEUED', 'NORMALIZING', 'RUNNING_CLINICAL_ENGINE', 'GENERATING_RECOMMENDATIONS', 'GENERATING_NARRATIVE', 'GENERATING_VIDEO_SCRIPT', 'RENDERING_VIDEO', 'GENERATING_REPORT', 'CLINICAL_READY', 'REPORT_GENERATING', 'COMPLETED', 'FAILED', 'PARTIAL_FAILURE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "AssessmentSource" AS ENUM ('QR', 'MANUAL', 'WEB', 'WHATSAPP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "ReviewDecision" AS ENUM ('PENDING', 'APPROVED', 'EDITS_REQUESTED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "ReviewPathway" AS ENUM ('ROUTINE_REVIEW', 'FOCUSED_REVIEW', 'EXAMINATION_REQUIRED', 'RESOLUTION_REQUIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "ArtifactType" AS ENUM ('CLINICAL_REASONING', 'SEVERITY_ANALYSIS', 'RECOMMENDATIONS', 'NARRATIVES', 'REPORT', 'THERAPY_PLAN', 'VISUAL_JOURNEY', 'PIPELINE_RUNTIME', 'VIDEO_SCRIPT', 'AVATAR_VIDEO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "NotificationChannel" AS ENUM ('WHATSAPP', 'SMS', 'EMAIL', 'IN_APP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "SubscriptionPlan" AS ENUM ('TRIAL', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "SupportedLanguage" AS ENUM ('EN', 'HI', 'MR', 'GU', 'PA', 'TA', 'TE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "ClinicStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "ClinicLocationStatus" AS ENUM ('ONBOARDING', 'ACTIVE', 'INACTIVE', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "IdentityResolutionStatus" AS ENUM ('RESOLVED', 'AMBIGUOUS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "VisitType" AS ENUM ('INITIAL', 'FOLLOW_UP', 'KIT_FULFILMENT', 'REASSESSMENT', 'NEW_CONCERN', 'CONDITION_CHANGED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "PatientRelationshipState" AS ENUM ('NEW', 'RETURNING', 'AMBIGUOUS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "LocationGeoStatus" AS ENUM ('UNSET', 'PINNED', 'GEOCODED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "ConsultationStatus" AS ENUM ('DRAFT', 'AWAITING_DOCTOR_REVIEW', 'REVISED', 'APPROVED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "ConsultationEventType" AS ENUM ('CONSULTATION_CREATED', 'CONSULTATION_UPDATED', 'CONSULTATION_APPROVED', 'DOCTOR_REVIEW_COMPLETED', 'REPORT_GENERATED', 'PDF_GENERATED', 'VIDEO_GENERATION_REQUESTED', 'VIDEO_GENERATED', 'RAG_INDEX_REQUESTED', 'PATIENT_NOTIFICATION_REQUESTED', 'PATIENT_NOTIFIED', 'FOLLOWUP_CREATED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "ConsultationApprovalStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REVISION_REQUESTED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "ConsultationEventStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "KitOrderStatus" AS ENUM ('READY_FOR_FULFILMENT', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "FeedbackVerdict" AS ENUM ('CORRECT', 'PARTLY_CORRECT', 'INCORRECT', 'SAFETY_CONCERN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "FeedbackIssueType" AS ENUM ('WRONG_KIT_INCLUDED', 'WRONG_KIT_EXCLUDED', 'WRONG_ORDER', 'MISSING_KIT', 'SAFETY_ISSUE', 'CONDITION_INTERPRETATION', 'NARRATIVE_ONLY', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "FeedbackSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "KnowledgePublicationStatus" AS ENUM ('DRAFT', 'MEDICAL_REVIEW', 'MEDICAL_APPROVED', 'COMMERCIAL_APPROVED', 'PUBLISHED_INTERNAL', 'PUBLISHED_PATIENT', 'RETIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "country" TEXT NOT NULL DEFAULT 'IN',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OrganizationMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supabaseUserId" TEXT NOT NULL,
    "role" "SystemRole" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Clinic" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "logoUrl" TEXT,
    "tagline" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "accentColor" TEXT,
    "footerText" TEXT,
    "website" TEXT,
    "whatsappNumber" TEXT,
    "pdfBranding" JSONB,
    "reportBranding" JSONB,
    "supportedLanguages" "SupportedLanguage"[] DEFAULT ARRAY[]::"SupportedLanguage"[],
    "settings" JSONB,
    "whatsappSettings" JSONB,
    "status" "ClinicStatus" NOT NULL DEFAULT 'ACTIVE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Clinic_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClinicLocation" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "district" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'IN',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "geoStatus" "LocationGeoStatus" NOT NULL DEFAULT 'UNSET',
    "geocodedAt" TIMESTAMP(3),
    "status" "ClinicLocationStatus" NOT NULL DEFAULT 'ONBOARDING',
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ClinicLocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClinicVisit" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "intakeSessionId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assessmentId" TEXT,

    CONSTRAINT "ClinicVisit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClinicMember" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "supabaseUserId" TEXT NOT NULL,
    "role" "SystemRole" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ClinicMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClinicInvitation" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT,
    "organizationId" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "name" TEXT,
    "role" "SystemRole" NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'WHATSAPP',
    "sentAt" TIMESTAMP(3),
    "sendError" TEXT,
    "tokenHash" TEXT NOT NULL,
    "invitedBySupabaseUserId" TEXT,
    "invitedByEmail" TEXT,
    "invitedByPhone" TEXT,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedBySupabaseUserId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "resendCount" INTEGER NOT NULL DEFAULT 0,
    "lastResentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicInvitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Subscription" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'TRIAL',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "monthlyAssessmentLimit" INTEGER,
    "doctorSeatLimit" INTEGER,
    "storageMbLimit" INTEGER,
    "assessmentsThisPeriod" INTEGER NOT NULL DEFAULT 0,
    "storageMbUsed" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodEnd" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Doctor" (
    "id" TEXT NOT NULL,
    "supabaseUserId" TEXT,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "specialization" TEXT,
    "photoUrl" TEXT,
    "credentials" TEXT,
    "bio" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "avatarUrl" TEXT,
    "signatureUrl" TEXT,
    "preferredLanguage" "SupportedLanguage" NOT NULL DEFAULT 'EN',
    "badgeTheme" TEXT,
    "qualification" TEXT,
    "registrationNumber" TEXT,
    "biography" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Doctor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Patient" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "doctorId" TEXT,
    "supabaseUserId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "phoneNormalized" TEXT,
    "email" TEXT,
    "age" INTEGER,
    "gender" TEXT,
    "identityResolutionStatus" "IdentityResolutionStatus" NOT NULL DEFAULT 'RESOLVED',
    "identityFlaggedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PatientIdentifier" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientIdentifier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Assessment" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "reviewingDoctorId" TEXT,
    "reviewDecision" "ReviewDecision" NOT NULL DEFAULT 'PENDING',
    "reviewerName" TEXT,
    "reviewerEmail" TEXT,
    "reviewNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewPathway" "ReviewPathway",
    "reviewPathwayReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reviewPathwayVersion" TEXT,
    "reviewPathwayEvaluatedAt" TIMESTAMP(3),
    "reviewPathwaySource" JSONB,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'PENDING',
    "source" "AssessmentSource" NOT NULL DEFAULT 'QR',
    "visitType" "VisitType",
    "patientRelationship" "PatientRelationshipState",
    "orchestrationStage" TEXT,
    "orchestrationMeta" JSONB,
    "executionId" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lastCompletedStage" TEXT,
    "phaseAExecutionId" TEXT,
    "phaseALeaseExpiresAt" TIMESTAMP(3),
    "phaseAAttempt" INTEGER NOT NULL DEFAULT 0,
    "rawResponses" JSONB,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "queuedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AssessmentResponse" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answer" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentResponse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AIArtifact" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "type" "ArtifactType" NOT NULL,
    "engineVersion" TEXT,
    "schemaVersion" TEXT,
    "content" JSONB NOT NULL,
    "generationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIArtifact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OrchestrationLog" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "durationMs" INTEGER,
    "confidence" DOUBLE PRECISION,
    "uncertainty" JSONB,
    "metadata" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrchestrationLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AssessmentEvent" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "stage" TEXT,
    "message" TEXT,
    "metadata" JSONB,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT,
    "assessmentId" TEXT,
    "eventType" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WhatsappDelivery" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "patientPhone" TEXT NOT NULL,
    "templateId" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "messageId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" "SystemRole",
    "actorType" TEXT,
    "assessmentId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PlatformSettings" (
    "id" TEXT NOT NULL,
    "singletonKey" TEXT NOT NULL DEFAULT 'singleton',
    "platformName" TEXT NOT NULL DEFAULT 'HairOS',
    "defaultTheme" TEXT NOT NULL DEFAULT 'system',
    "defaultLanguage" "SupportedLanguage" NOT NULL DEFAULT 'EN',
    "defaultWhatsappTemplate" TEXT,
    "aiModelDefault" TEXT,
    "aiNotes" TEXT,
    "versionInfo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RateLimitCounter" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitCounter_pkey" PRIMARY KEY ("key")
);

CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "state" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WhatsappSession" (
    "id" TEXT NOT NULL,
    "waId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Message" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "text" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Diagnosis" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "rootCauses" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Diagnosis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Recommendation" (
    "id" TEXT NOT NULL,
    "diagnosisId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "productId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Consultation" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "status" "ConsultationStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersionId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consultation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ConsultationVersion" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "contentVersion" INTEGER NOT NULL,
    "schemaVersion" TEXT NOT NULL DEFAULT 'v1',
    "content" JSONB NOT NULL,
    "engineVersions" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "llmModel" TEXT,
    "promptVersion" TEXT,
    "knowledgeBaseVersion" TEXT,
    "approvalStatus" "ConsultationApprovalStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNotes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultationVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ConsultationEvent" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "type" "ConsultationEventType" NOT NULL,
    "status" "ConsultationEventStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "consultationVersionId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultationEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "KitOrderIntent" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "consultationVersionId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "kitIds" TEXT[],
    "quantities" JSONB,
    "status" "KitOrderStatus" NOT NULL DEFAULT 'READY_FOR_FULFILMENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KitOrderIntent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RecommendationFeedback" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "consultationVersionId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "verdict" "FeedbackVerdict" NOT NULL,
    "issueType" "FeedbackIssueType" NOT NULL,
    "severity" "FeedbackSeverity" NOT NULL,
    "expectedKitOrder" TEXT[],
    "affectedKitIds" TEXT[],
    "clinicalRationale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationFeedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Product" (
    "id" TEXT NOT NULL,
    "canonicalId" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "clinicId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductAlias" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "clinicId" TEXT,
    "alias" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "sourceName" TEXT,
    "matchMethod" TEXT NOT NULL DEFAULT 'UNMATCHED',
    "matchConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "provenance" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAlias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductPriceVersion" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT,
    "version" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "sourceFile" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductPriceVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductPrice" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "clinicId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "mrp" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveUntil" TIMESTAMP(3),
    "provenance" JSONB,
    "conflictStatus" TEXT NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductPrice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Ingredient" (
    "id" TEXT NOT NULL,
    "canonicalId" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductIngredient" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DECIMAL(12,4),
    "unit" TEXT,
    "formulationText" TEXT,
    "sourceId" TEXT,
    "route" TEXT,
    "provenance" JSONB,
    "conflictStatus" TEXT NOT NULL DEFAULT 'NONE',
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductIngredient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Kit" (
    "id" TEXT NOT NULL,
    "canonicalId" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "family" TEXT,
    "clinicId" TEXT,
    "status" TEXT NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "medicalVersion" INTEGER NOT NULL DEFAULT 1,
    "commercialVersion" INTEGER NOT NULL DEFAULT 1,
    "sourceId" TEXT,
    "approvalStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "KitAlias" (
    "id" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "clinicId" TEXT,
    "alias" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "sourceName" TEXT,
    "matchMethod" TEXT NOT NULL DEFAULT 'UNMATCHED',
    "matchConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "provenance" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KitAlias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "KitVersion" (
    "id" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "sourceId" TEXT,
    "status" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KitVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "KitProduct" (
    "id" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "kitVersionId" TEXT NOT NULL,
    "componentOrder" INTEGER NOT NULL,
    "sourceRow" INTEGER,
    "quantity" DECIMAL(12,4),
    "unit" TEXT,
    "provenance" JSONB,
    "conflictStatus" TEXT NOT NULL DEFAULT 'NONE',
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KitProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "KitPrice" (
    "id" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "clinicId" TEXT,
    "version" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "mrp" DECIMAL(12,2) NOT NULL,
    "sourceFile" TEXT NOT NULL,
    "sourceSheet" TEXT,
    "sourceRows" TEXT,
    "gstPercent" DECIMAL(7,4),
    "doctorPrice" DECIMAL(12,2),
    "provenance" JSONB,
    "conflictStatus" TEXT NOT NULL DEFAULT 'NONE',
    "status" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KitPrice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "KitSchedule" (
    "id" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "kitVersionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "componentOrder" INTEGER NOT NULL,
    "scheduleText" TEXT NOT NULL,
    "sourceRow" INTEGER,
    "prescriptionDays" INTEGER,
    "provenance" JSONB,
    "conflictStatus" TEXT NOT NULL DEFAULT 'NONE',
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KitSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "clinicId" TEXT,
    "title" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT 'HAIR',
    "sourceType" TEXT NOT NULL,
    "sourceStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "authorityScore" INTEGER NOT NULL,
    "status" "KnowledgePublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "KnowledgeDocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "sourceFile" TEXT NOT NULL,
    "sourceStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "status" "KnowledgePublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3),
    "effectiveUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeDocumentVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "clinicId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "domain" TEXT NOT NULL,
    "topic" TEXT NOT NULL DEFAULT 'GENERAL',
    "knowledgeSystem" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "sectionType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "approvalStatus" "KnowledgePublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "authorityScore" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveUntil" TIMESTAMP(3),
    "embedding" vector,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "KnowledgeApproval" (
    "id" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "chunkId" TEXT,
    "approvalType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "approvedBy" TEXT,
    "notes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "KnowledgeConflict" (
    "id" TEXT NOT NULL,
    "documentId" TEXT,
    "clinicId" TEXT,
    "entity" TEXT NOT NULL,
    "issue" TEXT NOT NULL,
    "conflictType" TEXT NOT NULL DEFAULT 'UNSPECIFIED',
    "fieldOrClaim" TEXT,
    "sourceA" JSONB,
    "sourceB" JSONB,
    "valueA" JSONB,
    "valueB" JSONB,
    "authorityA" INTEGER,
    "authorityB" INTEGER,
    "proposedCanonicalValue" JSONB,
    "automaticResolutionAllowed" BOOLEAN NOT NULL DEFAULT false,
    "reviewRequired" BOOLEAN NOT NULL DEFAULT true,
    "publicationBlocked" BOOLEAN NOT NULL DEFAULT true,
    "severity" TEXT NOT NULL,
    "owner" TEXT,
    "requiredAction" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeConflict_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "IngestionRun" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT,
    "sourceFile" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "configVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "counts" JSONB,
    "errors" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "KnowledgeSourceFile" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "logicalDocumentKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL,
    "supersedesSourceId" TEXT,
    "extractionMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeSourceFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "KnowledgeIngestionStage" (
    "id" TEXT NOT NULL,
    "sourceFileId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "outputHash" TEXT,
    "status" TEXT NOT NULL,
    "details" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeIngestionStage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "KnowledgeClaim" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT,
    "claimType" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "authorityScore" INTEGER NOT NULL,
    "evidenceStatus" TEXT NOT NULL,
    "approvalStatus" "KnowledgePublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "audience" TEXT NOT NULL,
    "patientVisible" BOOLEAN NOT NULL DEFAULT false,
    "medicalReviewStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "commercialReviewStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "sourceLocation" JSONB,
    "supersessionStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" TIMESTAMP(3),
    "effectiveUntil" TIMESTAMP(3),
    "contradictionGroup" TEXT,
    "supersededByClaimId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeClaim_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClaimEvidence" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "sourceFileId" TEXT,
    "evidenceType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNASSESSED',
    "sourceLocation" JSONB NOT NULL,
    "excerptHash" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClaimEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StructuredFactRecord" (
    "id" TEXT NOT NULL,
    "sourceFileId" TEXT NOT NULL,
    "clinicId" TEXT,
    "domain" TEXT NOT NULL DEFAULT 'HAIR',
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "rawValue" JSONB,
    "normalizedValue" JSONB,
    "provenance" JSONB NOT NULL,
    "formula" TEXT,
    "formulaResult" JSONB,
    "formulaError" TEXT,
    "approvalStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "conflictStatus" TEXT NOT NULL DEFAULT 'NONE',
    "requiresReview" BOOLEAN NOT NULL DEFAULT true,
    "publicationStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3),
    "effectiveUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StructuredFactRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "KnowledgeReviewAction" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeReviewAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AssistantThread" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT,
    "assessmentId" TEXT,
    "createdBy" TEXT NOT NULL,
    "role" "SystemRole" NOT NULL,
    "language" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GeneralAssistantConversation" (
    "id" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneralAssistantConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AssistantMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "intent" TEXT,
    "action" TEXT,
    "language" TEXT NOT NULL,
    "graphPath" TEXT[],
    "authorities" TEXT[],
    "supportedClaims" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AssistantToolCall" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "redactedOutput" JSONB,
    "status" TEXT NOT NULL,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantToolCall_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AssistantCitation" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "claimIndex" INTEGER NOT NULL,
    "claimText" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceField" TEXT,
    "sourceLabel" TEXT NOT NULL,
    "sourceVersion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantCitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AssistantSafetyEvent" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "messageId" TEXT,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT,
    "assessmentId" TEXT,
    "flags" TEXT[],
    "action" TEXT NOT NULL,
    "redactedSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantSafetyEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AssistantFeedback" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "messageId" TEXT,
    "clinicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER,
    "helpful" BOOLEAN,
    "category" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantFeedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AssistantEscalation" (
    "id" TEXT NOT NULL,
    "threadId" TEXT,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT,
    "assessmentId" TEXT,
    "messageId" TEXT,
    "reason" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "assignedDoctorId" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantEscalation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AdverseEvent" (
    "id" TEXT NOT NULL,
    "threadId" TEXT,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT,
    "assessmentId" TEXT,
    "productIds" TEXT[],
    "symptoms" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdverseEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Organization_slug_key" ON "Organization"("slug");

CREATE INDEX IF NOT EXISTS "Organization_slug_idx" ON "Organization"("slug");

CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationMember_supabaseUserId_key" ON "OrganizationMember"("supabaseUserId");

CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationMember_email_key" ON "OrganizationMember"("email");

CREATE INDEX IF NOT EXISTS "OrganizationMember_organizationId_idx" ON "OrganizationMember"("organizationId");

CREATE INDEX IF NOT EXISTS "OrganizationMember_supabaseUserId_idx" ON "OrganizationMember"("supabaseUserId");

CREATE UNIQUE INDEX IF NOT EXISTS "Clinic_slug_key" ON "Clinic"("slug");

CREATE INDEX IF NOT EXISTS "Clinic_organizationId_idx" ON "Clinic"("organizationId");

CREATE INDEX IF NOT EXISTS "Clinic_slug_idx" ON "Clinic"("slug");

CREATE INDEX IF NOT EXISTS "ClinicLocation_clinicId_idx" ON "ClinicLocation"("clinicId");

CREATE INDEX IF NOT EXISTS "ClinicLocation_clinicId_status_idx" ON "ClinicLocation"("clinicId", "status");

CREATE INDEX IF NOT EXISTS "ClinicLocation_country_state_city_idx" ON "ClinicLocation"("country", "state", "city");

CREATE INDEX IF NOT EXISTS "ClinicLocation_latitude_longitude_idx" ON "ClinicLocation"("latitude", "longitude");

CREATE INDEX IF NOT EXISTS "ClinicLocation_geoStatus_idx" ON "ClinicLocation"("geoStatus");

CREATE UNIQUE INDEX IF NOT EXISTS "ClinicVisit_intakeSessionId_key" ON "ClinicVisit"("intakeSessionId");

CREATE UNIQUE INDEX IF NOT EXISTS "ClinicVisit_assessmentId_key" ON "ClinicVisit"("assessmentId");

CREATE INDEX IF NOT EXISTS "ClinicVisit_clinicId_assessmentId_startedAt_idx" ON "ClinicVisit"("clinicId", "assessmentId", "startedAt");

CREATE INDEX IF NOT EXISTS "ClinicMember_clinicId_idx" ON "ClinicMember"("clinicId");

CREATE INDEX IF NOT EXISTS "ClinicMember_supabaseUserId_idx" ON "ClinicMember"("supabaseUserId");

CREATE UNIQUE INDEX IF NOT EXISTS "ClinicMember_clinicId_supabaseUserId_key" ON "ClinicMember"("clinicId", "supabaseUserId");

CREATE UNIQUE INDEX IF NOT EXISTS "ClinicMember_clinicId_email_key" ON "ClinicMember"("clinicId", "email");

CREATE UNIQUE INDEX IF NOT EXISTS "ClinicMember_clinicId_phone_key" ON "ClinicMember"("clinicId", "phone");

CREATE UNIQUE INDEX IF NOT EXISTS "ClinicInvitation_tokenHash_key" ON "ClinicInvitation"("tokenHash");

CREATE INDEX IF NOT EXISTS "ClinicInvitation_clinicId_idx" ON "ClinicInvitation"("clinicId");

CREATE INDEX IF NOT EXISTS "ClinicInvitation_organizationId_idx" ON "ClinicInvitation"("organizationId");

CREATE INDEX IF NOT EXISTS "ClinicInvitation_email_idx" ON "ClinicInvitation"("email");

CREATE INDEX IF NOT EXISTS "ClinicInvitation_phone_idx" ON "ClinicInvitation"("phone");

CREATE INDEX IF NOT EXISTS "ClinicInvitation_status_idx" ON "ClinicInvitation"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_clinicId_key" ON "Subscription"("clinicId");

CREATE INDEX IF NOT EXISTS "Subscription_status_idx" ON "Subscription"("status");

CREATE INDEX IF NOT EXISTS "Subscription_plan_idx" ON "Subscription"("plan");

CREATE UNIQUE INDEX IF NOT EXISTS "Doctor_supabaseUserId_key" ON "Doctor"("supabaseUserId");

CREATE UNIQUE INDEX IF NOT EXISTS "Doctor_email_key" ON "Doctor"("email");

CREATE INDEX IF NOT EXISTS "Doctor_clinicId_idx" ON "Doctor"("clinicId");

CREATE UNIQUE INDEX IF NOT EXISTS "Patient_supabaseUserId_key" ON "Patient"("supabaseUserId");

CREATE INDEX IF NOT EXISTS "Patient_clinicId_idx" ON "Patient"("clinicId");

CREATE INDEX IF NOT EXISTS "Patient_clinicId_doctorId_idx" ON "Patient"("clinicId", "doctorId");

CREATE INDEX IF NOT EXISTS "Patient_phone_idx" ON "Patient"("phone");

CREATE INDEX IF NOT EXISTS "Patient_clinicId_phoneNormalized_idx" ON "Patient"("clinicId", "phoneNormalized");

CREATE INDEX IF NOT EXISTS "Patient_clinicId_identityResolutionStatus_idx" ON "Patient"("clinicId", "identityResolutionStatus");

CREATE INDEX IF NOT EXISTS "PatientIdentifier_patientId_idx" ON "PatientIdentifier"("patientId");

CREATE INDEX IF NOT EXISTS "PatientIdentifier_externalId_idx" ON "PatientIdentifier"("externalId");

CREATE UNIQUE INDEX IF NOT EXISTS "PatientIdentifier_source_externalId_key" ON "PatientIdentifier"("source", "externalId");

CREATE INDEX IF NOT EXISTS "Assessment_clinicId_idx" ON "Assessment"("clinicId");

CREATE INDEX IF NOT EXISTS "Assessment_patientId_idx" ON "Assessment"("patientId");

CREATE INDEX IF NOT EXISTS "Assessment_reviewingDoctorId_idx" ON "Assessment"("reviewingDoctorId");

CREATE INDEX IF NOT EXISTS "Assessment_clinicId_status_idx" ON "Assessment"("clinicId", "status");

CREATE INDEX IF NOT EXISTS "Assessment_status_phaseALeaseExpiresAt_idx" ON "Assessment"("status", "phaseALeaseExpiresAt");

CREATE INDEX IF NOT EXISTS "Assessment_clinicId_visitType_idx" ON "Assessment"("clinicId", "visitType");

CREATE INDEX IF NOT EXISTS "AssessmentResponse_assessmentId_idx" ON "AssessmentResponse"("assessmentId");

CREATE INDEX IF NOT EXISTS "AssessmentResponse_questionId_idx" ON "AssessmentResponse"("questionId");

CREATE INDEX IF NOT EXISTS "AIArtifact_assessmentId_idx" ON "AIArtifact"("assessmentId");

CREATE INDEX IF NOT EXISTS "AIArtifact_assessmentId_type_idx" ON "AIArtifact"("assessmentId", "type");

CREATE UNIQUE INDEX IF NOT EXISTS "AIArtifact_assessmentId_type_key" ON "AIArtifact"("assessmentId", "type");

CREATE INDEX IF NOT EXISTS "OrchestrationLog_assessmentId_idx" ON "OrchestrationLog"("assessmentId");

CREATE INDEX IF NOT EXISTS "OrchestrationLog_assessmentId_stage_idx" ON "OrchestrationLog"("assessmentId", "stage");

CREATE INDEX IF NOT EXISTS "AssessmentEvent_assessmentId_idx" ON "AssessmentEvent"("assessmentId");

CREATE INDEX IF NOT EXISTS "AssessmentEvent_type_idx" ON "AssessmentEvent"("type");

CREATE INDEX IF NOT EXISTS "AssessmentEvent_assessmentId_createdAt_idx" ON "AssessmentEvent"("assessmentId", "createdAt");

CREATE INDEX IF NOT EXISTS "AnalyticsEvent_clinicId_idx" ON "AnalyticsEvent"("clinicId");

CREATE INDEX IF NOT EXISTS "AnalyticsEvent_eventType_idx" ON "AnalyticsEvent"("eventType");

CREATE INDEX IF NOT EXISTS "AnalyticsEvent_clinicId_eventType_idx" ON "AnalyticsEvent"("clinicId", "eventType");

CREATE INDEX IF NOT EXISTS "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");

CREATE INDEX IF NOT EXISTS "WhatsappDelivery_assessmentId_idx" ON "WhatsappDelivery"("assessmentId");

CREATE INDEX IF NOT EXISTS "WhatsappDelivery_status_idx" ON "WhatsappDelivery"("status");

CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

CREATE INDEX IF NOT EXISTS "AuditLog_actorId_idx" ON "AuditLog"("actorId");

CREATE INDEX IF NOT EXISTS "AuditLog_assessmentId_idx" ON "AuditLog"("assessmentId");

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformSettings_singletonKey_key" ON "PlatformSettings"("singletonKey");

CREATE INDEX IF NOT EXISTS "RateLimitCounter_expiresAt_idx" ON "RateLimitCounter"("expiresAt");

CREATE INDEX IF NOT EXISTS "User_phone_idx" ON "User"("phone");

CREATE UNIQUE INDEX IF NOT EXISTS "WhatsappSession_waId_key" ON "WhatsappSession"("waId");

CREATE UNIQUE INDEX IF NOT EXISTS "Diagnosis_sessionId_key" ON "Diagnosis"("sessionId");

CREATE UNIQUE INDEX IF NOT EXISTS "Consultation_currentVersionId_key" ON "Consultation"("currentVersionId");

CREATE INDEX IF NOT EXISTS "Consultation_clinicId_idx" ON "Consultation"("clinicId");

CREATE INDEX IF NOT EXISTS "Consultation_patientId_idx" ON "Consultation"("patientId");

CREATE INDEX IF NOT EXISTS "Consultation_clinicId_status_idx" ON "Consultation"("clinicId", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "Consultation_assessmentId_key" ON "Consultation"("assessmentId");

CREATE INDEX IF NOT EXISTS "ConsultationVersion_consultationId_idx" ON "ConsultationVersion"("consultationId");

CREATE INDEX IF NOT EXISTS "ConsultationVersion_contentHash_idx" ON "ConsultationVersion"("contentHash");

CREATE UNIQUE INDEX IF NOT EXISTS "ConsultationVersion_consultationId_contentVersion_key" ON "ConsultationVersion"("consultationId", "contentVersion");

CREATE INDEX IF NOT EXISTS "ConsultationEvent_consultationId_idx" ON "ConsultationEvent"("consultationId");

CREATE INDEX IF NOT EXISTS "ConsultationEvent_status_createdAt_idx" ON "ConsultationEvent"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "ConsultationEvent_type_status_idx" ON "ConsultationEvent"("type", "status");

CREATE INDEX IF NOT EXISTS "KitOrderIntent_clinicId_createdAt_idx" ON "KitOrderIntent"("clinicId", "createdAt");

CREATE INDEX IF NOT EXISTS "KitOrderIntent_doctorId_idx" ON "KitOrderIntent"("doctorId");

CREATE INDEX IF NOT EXISTS "KitOrderIntent_assessmentId_idx" ON "KitOrderIntent"("assessmentId");

CREATE UNIQUE INDEX IF NOT EXISTS "KitOrderIntent_consultationId_consultationVersionId_key" ON "KitOrderIntent"("consultationId", "consultationVersionId");

CREATE INDEX IF NOT EXISTS "RecommendationFeedback_consultationId_idx" ON "RecommendationFeedback"("consultationId");

CREATE INDEX IF NOT EXISTS "RecommendationFeedback_clinicId_createdAt_idx" ON "RecommendationFeedback"("clinicId", "createdAt");

CREATE INDEX IF NOT EXISTS "RecommendationFeedback_doctorId_idx" ON "RecommendationFeedback"("doctorId");

CREATE UNIQUE INDEX IF NOT EXISTS "Product_canonicalId_key" ON "Product"("canonicalId");

CREATE INDEX IF NOT EXISTS "Product_clinicId_status_idx" ON "Product"("clinicId", "status");

CREATE INDEX IF NOT EXISTS "ProductAlias_clinicId_normalizedAlias_idx" ON "ProductAlias"("clinicId", "normalizedAlias");

CREATE UNIQUE INDEX IF NOT EXISTS "ProductAlias_productId_normalizedAlias_key" ON "ProductAlias"("productId", "normalizedAlias");

CREATE UNIQUE INDEX IF NOT EXISTS "ProductPriceVersion_clinicId_checksum_key" ON "ProductPriceVersion"("clinicId", "checksum");

CREATE UNIQUE INDEX IF NOT EXISTS "ProductPrice_productId_versionId_clinicId_key" ON "ProductPrice"("productId", "versionId", "clinicId");

CREATE UNIQUE INDEX IF NOT EXISTS "Ingredient_canonicalId_key" ON "Ingredient"("canonicalId");

CREATE UNIQUE INDEX IF NOT EXISTS "Ingredient_normalizedName_key" ON "Ingredient"("normalizedName");

CREATE UNIQUE INDEX IF NOT EXISTS "ProductIngredient_productId_ingredientId_sourceId_key" ON "ProductIngredient"("productId", "ingredientId", "sourceId");

CREATE UNIQUE INDEX IF NOT EXISTS "Kit_canonicalId_key" ON "Kit"("canonicalId");

CREATE INDEX IF NOT EXISTS "Kit_clinicId_status_idx" ON "Kit"("clinicId", "status");

CREATE INDEX IF NOT EXISTS "KitAlias_clinicId_normalizedAlias_idx" ON "KitAlias"("clinicId", "normalizedAlias");

CREATE UNIQUE INDEX IF NOT EXISTS "KitAlias_kitId_normalizedAlias_key" ON "KitAlias"("kitId", "normalizedAlias");

CREATE UNIQUE INDEX IF NOT EXISTS "KitVersion_kitId_version_key" ON "KitVersion"("kitId", "version");

CREATE UNIQUE INDEX IF NOT EXISTS "KitVersion_kitId_checksum_key" ON "KitVersion"("kitId", "checksum");

CREATE INDEX IF NOT EXISTS "KitProduct_kitId_kitVersionId_idx" ON "KitProduct"("kitId", "kitVersionId");

CREATE UNIQUE INDEX IF NOT EXISTS "KitProduct_kitVersionId_componentOrder_key" ON "KitProduct"("kitVersionId", "componentOrder");

CREATE INDEX IF NOT EXISTS "KitPrice_clinicId_kitId_status_effectiveFrom_idx" ON "KitPrice"("clinicId", "kitId", "status", "effectiveFrom");

CREATE UNIQUE INDEX IF NOT EXISTS "KitPrice_kitId_clinicId_version_key" ON "KitPrice"("kitId", "clinicId", "version");

CREATE UNIQUE INDEX IF NOT EXISTS "KitSchedule_kitVersionId_componentOrder_key" ON "KitSchedule"("kitVersionId", "componentOrder");

CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeDocument_sourceId_key" ON "KnowledgeDocument"("sourceId");

CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeDocumentVersion_documentId_version_key" ON "KnowledgeDocumentVersion"("documentId", "version");

CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeDocumentVersion_documentId_checksum_key" ON "KnowledgeDocumentVersion"("documentId", "checksum");

CREATE INDEX IF NOT EXISTS "KnowledgeChunk_clinicId_approvalStatus_language_domain_idx" ON "KnowledgeChunk"("clinicId", "approvalStatus", "language", "domain");

CREATE INDEX IF NOT EXISTS "KnowledgeConflict_clinicId_status_severity_idx" ON "KnowledgeConflict"("clinicId", "status", "severity");

CREATE UNIQUE INDEX IF NOT EXISTS "IngestionRun_clinicId_checksum_configVersion_key" ON "IngestionRun"("clinicId", "checksum", "configVersion");

CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeSourceFile_fingerprint_key" ON "KnowledgeSourceFile"("fingerprint");

CREATE INDEX IF NOT EXISTS "KnowledgeSourceFile_domain_sourceStatus_sourceType_idx" ON "KnowledgeSourceFile"("domain", "sourceStatus", "sourceType");

CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeSourceFile_logicalDocumentKey_version_key" ON "KnowledgeSourceFile"("logicalDocumentKey", "version");

CREATE INDEX IF NOT EXISTS "KnowledgeIngestionStage_sourceFileId_status_idx" ON "KnowledgeIngestionStage"("sourceFileId", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeIngestionStage_sourceFileId_stage_inputHash_key" ON "KnowledgeIngestionStage"("sourceFileId", "stage", "inputHash");

CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeClaim_claimId_key" ON "KnowledgeClaim"("claimId");

CREATE INDEX IF NOT EXISTS "KnowledgeClaim_domain_approvalStatus_audience_effectiveFrom_idx" ON "KnowledgeClaim"("domain", "approvalStatus", "audience", "effectiveFrom");

CREATE INDEX IF NOT EXISTS "KnowledgeClaim_subjectType_subjectId_claimType_idx" ON "KnowledgeClaim"("subjectType", "subjectId", "claimType");

CREATE INDEX IF NOT EXISTS "KnowledgeClaim_contradictionGroup_idx" ON "KnowledgeClaim"("contradictionGroup");

CREATE INDEX IF NOT EXISTS "ClaimEvidence_claimId_status_idx" ON "ClaimEvidence"("claimId", "status");

CREATE INDEX IF NOT EXISTS "ClaimEvidence_sourceFileId_idx" ON "ClaimEvidence"("sourceFileId");

CREATE INDEX IF NOT EXISTS "StructuredFactRecord_entityType_entityId_field_approvalStat_idx" ON "StructuredFactRecord"("entityType", "entityId", "field", "approvalStatus");

CREATE INDEX IF NOT EXISTS "StructuredFactRecord_clinicId_publicationStatus_idx" ON "StructuredFactRecord"("clinicId", "publicationStatus");

CREATE INDEX IF NOT EXISTS "KnowledgeReviewAction_entityType_entityId_createdAt_idx" ON "KnowledgeReviewAction"("entityType", "entityId", "createdAt");

CREATE INDEX IF NOT EXISTS "KnowledgeReviewAction_actorId_createdAt_idx" ON "KnowledgeReviewAction"("actorId", "createdAt");

CREATE INDEX IF NOT EXISTS "AssistantThread_clinicId_createdBy_updatedAt_idx" ON "AssistantThread"("clinicId", "createdBy", "updatedAt");

CREATE INDEX IF NOT EXISTS "GeneralAssistantConversation_expiresAt_idx" ON "GeneralAssistantConversation"("expiresAt");

CREATE INDEX IF NOT EXISTS "AssistantMessage_threadId_createdAt_idx" ON "AssistantMessage"("threadId", "createdAt");

CREATE INDEX IF NOT EXISTS "AssistantCitation_messageId_claimIndex_idx" ON "AssistantCitation"("messageId", "claimIndex");

CREATE INDEX IF NOT EXISTS "AssistantEscalation_clinicId_status_priority_createdAt_idx" ON "AssistantEscalation"("clinicId", "status", "priority", "createdAt");

CREATE INDEX IF NOT EXISTS "AdverseEvent_clinicId_status_createdAt_idx" ON "AdverseEvent"("clinicId", "status", "createdAt");

DO $$ BEGIN
    ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Clinic" ADD CONSTRAINT "Clinic_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "ClinicLocation" ADD CONSTRAINT "ClinicLocation_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "ClinicVisit" ADD CONSTRAINT "ClinicVisit_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "ClinicVisit" ADD CONSTRAINT "ClinicVisit_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "ClinicMember" ADD CONSTRAINT "ClinicMember_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "ClinicInvitation" ADD CONSTRAINT "ClinicInvitation_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "ClinicInvitation" ADD CONSTRAINT "ClinicInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Patient" ADD CONSTRAINT "Patient_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Patient" ADD CONSTRAINT "Patient_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "PatientIdentifier" ADD CONSTRAINT "PatientIdentifier_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_reviewingDoctorId_fkey" FOREIGN KEY ("reviewingDoctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "AssessmentResponse" ADD CONSTRAINT "AssessmentResponse_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "AIArtifact" ADD CONSTRAINT "AIArtifact_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "OrchestrationLog" ADD CONSTRAINT "OrchestrationLog_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "AssessmentEvent" ADD CONSTRAINT "AssessmentEvent_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "WhatsappDelivery" ADD CONSTRAINT "WhatsappDelivery_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "WhatsappSession" ADD CONSTRAINT "WhatsappSession_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Message" ADD CONSTRAINT "Message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Diagnosis" ADD CONSTRAINT "Diagnosis_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_diagnosisId_fkey" FOREIGN KEY ("diagnosisId") REFERENCES "Diagnosis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "ConsultationVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "ConsultationVersion" ADD CONSTRAINT "ConsultationVersion_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "ConsultationEvent" ADD CONSTRAINT "ConsultationEvent_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "KitOrderIntent" ADD CONSTRAINT "KitOrderIntent_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "KitOrderIntent" ADD CONSTRAINT "KitOrderIntent_consultationVersionId_fkey" FOREIGN KEY ("consultationVersionId") REFERENCES "ConsultationVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "KitOrderIntent" ADD CONSTRAINT "KitOrderIntent_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "KitOrderIntent" ADD CONSTRAINT "KitOrderIntent_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "KitOrderIntent" ADD CONSTRAINT "KitOrderIntent_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RecommendationFeedback" ADD CONSTRAINT "RecommendationFeedback_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RecommendationFeedback" ADD CONSTRAINT "RecommendationFeedback_consultationVersionId_fkey" FOREIGN KEY ("consultationVersionId") REFERENCES "ConsultationVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RecommendationFeedback" ADD CONSTRAINT "RecommendationFeedback_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RecommendationFeedback" ADD CONSTRAINT "RecommendationFeedback_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RecommendationFeedback" ADD CONSTRAINT "RecommendationFeedback_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
