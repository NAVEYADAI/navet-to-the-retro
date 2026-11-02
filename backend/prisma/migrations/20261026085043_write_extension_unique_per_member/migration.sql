-- DropIndex
DROP INDEX "SprintWriteExtension_sprintId_userId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "SprintWriteExtension_sprintId_userId_key" ON "SprintWriteExtension"("sprintId", "userId");
