-- Add VIDEO_SCRIPT and AVATAR_VIDEO to ArtifactType enum.
-- These values exist in schema.prisma but were never added to the DB enum,
-- causing aIArtifact.findUnique() to crash with
-- "invalid input value for enum ArtifactType: VIDEO_SCRIPT".

ALTER TYPE "ArtifactType" ADD VALUE IF NOT EXISTS 'VIDEO_SCRIPT';
ALTER TYPE "ArtifactType" ADD VALUE IF NOT EXISTS 'AVATAR_VIDEO';
