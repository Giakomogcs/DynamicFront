/*
  Warnings:

  - You are about to drop the column `conversationId` on the `Canvas` table. All the data in the column will be lost.
  - You are about to drop the column `messages` on the `Canvas` table. All the data in the column will be lost.
  - You are about to drop the `CanvasGroup` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "Canvas" DROP COLUMN "conversationId",
DROP COLUMN "messages",
ADD COLUMN     "route" TEXT,
ADD COLUMN     "sessionId" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'dashboard',
ALTER COLUMN "theme" DROP NOT NULL,
ALTER COLUMN "layoutType" SET DEFAULT 'grid';

-- DropTable
DROP TABLE "CanvasGroup";

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "title" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanvasVersion" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changeLog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanvasVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_conversationId_key" ON "Session"("conversationId");

-- AddForeignKey
ALTER TABLE "Canvas" ADD CONSTRAINT "Canvas_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanvasVersion" ADD CONSTRAINT "CanvasVersion_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "Canvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
