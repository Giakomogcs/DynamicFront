-- CreateTable
CREATE TABLE "CanvasGroup" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvasGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "queryPatterns" TEXT[],
    "toolSequence" TEXT[],
    "processingLogic" TEXT NOT NULL,
    "widgetTypes" TEXT[],
    "authRequired" BOOLEAN NOT NULL DEFAULT false,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "avgExecutionTimeMs" INTEGER NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionLog" (
    "id" TEXT NOT NULL,
    "templateId" TEXT,
    "userMessage" TEXT NOT NULL,
    "toolsCalled" TEXT[],
    "success" BOOLEAN NOT NULL,
    "executionTimeMs" INTEGER NOT NULL,
    "dataQuality" DOUBLE PRECISION,
    "errorType" TEXT,
    "adaptationUsed" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceSemantics" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "subDomains" TEXT[],
    "entities" JSONB NOT NULL,
    "workflows" JSONB NOT NULL,
    "relationships" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceSemantics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityRelation" (
    "id" TEXT NOT NULL,
    "fromEntity" TEXT NOT NULL,
    "toEntity" TEXT NOT NULL,
    "relationType" TEXT NOT NULL,
    "viaParam" TEXT,
    "strength" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntityRelation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CanvasGroup_conversationId_idx" ON "CanvasGroup"("conversationId");

-- CreateIndex
CREATE INDEX "ExecutionTemplate_successRate_idx" ON "ExecutionTemplate"("successRate");

-- CreateIndex
CREATE INDEX "ExecutionTemplate_name_idx" ON "ExecutionTemplate"("name");

-- CreateIndex
CREATE INDEX "ExecutionLog_templateId_idx" ON "ExecutionLog"("templateId");

-- CreateIndex
CREATE INDEX "ExecutionLog_success_idx" ON "ExecutionLog"("success");

-- CreateIndex
CREATE INDEX "ExecutionLog_createdAt_idx" ON "ExecutionLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceSemantics_resourceId_key" ON "ResourceSemantics"("resourceId");

-- CreateIndex
CREATE INDEX "ResourceSemantics_domain_idx" ON "ResourceSemantics"("domain");

-- CreateIndex
CREATE INDEX "ResourceSemantics_resourceId_idx" ON "ResourceSemantics"("resourceId");

-- CreateIndex
CREATE INDEX "EntityRelation_fromEntity_idx" ON "EntityRelation"("fromEntity");

-- CreateIndex
CREATE INDEX "EntityRelation_toEntity_idx" ON "EntityRelation"("toEntity");

-- AddForeignKey
ALTER TABLE "ExecutionLog" ADD CONSTRAINT "ExecutionLog_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ExecutionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
