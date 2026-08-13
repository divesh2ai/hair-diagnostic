CREATE TABLE "GeneralAssistantConversation" (
    "id" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GeneralAssistantConversation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GeneralAssistantConversation_expiresAt_idx" ON "GeneralAssistantConversation"("expiresAt");
