-- Add missing AssessmentStatus enum values used by the orchestrator
-- (orchestrator references GENERATING_NARRATIVE, GENERATING_VIDEO_SCRIPT,
-- RENDERING_VIDEO, but they were never added to the DB enum, causing
-- setStatus() to crash with "Cannot read properties of undefined (reading 'toLowerCase')").

ALTER TYPE "AssessmentStatus" ADD VALUE IF NOT EXISTS 'GENERATING_NARRATIVE' BEFORE 'GENERATING_REPORT';
ALTER TYPE "AssessmentStatus" ADD VALUE IF NOT EXISTS 'GENERATING_VIDEO_SCRIPT' BEFORE 'GENERATING_REPORT';
ALTER TYPE "AssessmentStatus" ADD VALUE IF NOT EXISTS 'RENDERING_VIDEO' BEFORE 'GENERATING_REPORT';
