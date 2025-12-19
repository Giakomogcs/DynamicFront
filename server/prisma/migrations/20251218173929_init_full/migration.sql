-- CreateTable
CREATE TABLE "VerifiedApi" (
    "idString" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "specUrl" TEXT,
    "authConfig" TEXT,
    "toolConfig" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerifiedApi_pkey" PRIMARY KEY ("idString")
);

-- CreateTable
CREATE TABLE "VerifiedDb" (
    "idString" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "connectionString" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerifiedDb_pkey" PRIMARY KEY ("idString")
);
