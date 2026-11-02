-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" INTEGER,
ADD COLUMN     "updatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SprintWriteExtension" (
    "id" SERIAL NOT NULL,
    "sprintId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "grantedById" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SprintWriteExtension_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SprintWriteExtension_sprintId_userId_idx" ON "SprintWriteExtension"("sprintId", "userId");

-- CreateIndex
CREATE INDEX "Comment_sprintId_deletedAt_idx" ON "Comment"("sprintId", "deletedAt");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintWriteExtension" ADD CONSTRAINT "SprintWriteExtension_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintWriteExtension" ADD CONSTRAINT "SprintWriteExtension_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintWriteExtension" ADD CONSTRAINT "SprintWriteExtension_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
