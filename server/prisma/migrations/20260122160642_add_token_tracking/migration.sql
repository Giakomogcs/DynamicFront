-- CreateTable
CREATE TABLE "TokenUsage" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "estimatedCost" DOUBLE PRECISION,
    "requestType" TEXT NOT NULL,
    "sessionId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderQuota" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "rpmLimit" INTEGER,
    "tokensPerMinuteLimit" INTEGER,
    "dailyTokenLimit" INTEGER,
    "currentRpm" INTEGER NOT NULL DEFAULT 0,
    "currentTPM" INTEGER NOT NULL DEFAULT 0,
    "dailyTokens" INTEGER NOT NULL DEFAULT 0,
    "lastRpmReset" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastTPMReset" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastDailyReset" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderQuota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TokenUsage_providerId_timestamp_idx" ON "TokenUsage"("providerId", "timestamp");

-- CreateIndex
CREATE INDEX "TokenUsage_modelId_timestamp_idx" ON "TokenUsage"("modelId", "timestamp");

-- CreateIndex
CREATE INDEX "TokenUsage_sessionId_idx" ON "TokenUsage"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderQuota_providerId_key" ON "ProviderQuota"("providerId");
