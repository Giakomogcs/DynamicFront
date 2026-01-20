-- AlterTable
ALTER TABLE "Canvas" ADD COLUMN     "icon" TEXT,
ADD COLUMN     "isHome" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slug" TEXT;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "description" TEXT,
ADD COLUMN     "metadata" JSONB;
