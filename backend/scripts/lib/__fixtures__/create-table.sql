-- CreateTable
CREATE TABLE "ProbeThing" (
    "id" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "ProbeThing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProbeThing_note_idx" ON "ProbeThing"("note");

