/*
  Warnings:

  - A unique constraint covering the columns `[sessionId,slug]` on the table `Canvas` will be added. If there are existing duplicate values, this will fail.
  - Made the column `sessionId` on table `Canvas` required. This step will fail if there are existing NULL values in that column.
  - Made the column `slug` on table `Canvas` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Canvas" ADD COLUMN     "thumbnail" TEXT,
ALTER COLUMN "sessionId" SET NOT NULL,
ALTER COLUMN "slug" SET NOT NULL;

-- AlterTable
ALTER TABLE "CanvasVersion" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lastActiveCanvasId" TEXT,
ADD COLUMN     "thumbnail" TEXT,
ALTER COLUMN "title" SET DEFAULT 'New Project';

-- CreateIndex
CREATE UNIQUE INDEX "Canvas_sessionId_slug_key" ON "Canvas"("sessionId", "slug");
