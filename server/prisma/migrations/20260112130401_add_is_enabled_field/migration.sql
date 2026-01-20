-- AlterTable
ALTER TABLE "VerifiedApi" ADD COLUMN     "isEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "VerifiedDb" ADD COLUMN     "isEnabled" BOOLEAN NOT NULL DEFAULT true;
