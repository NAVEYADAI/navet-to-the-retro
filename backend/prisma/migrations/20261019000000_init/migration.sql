-- CreateEnum
CREATE TYPE "MessagingChannel" AS ENUM ('TELEGRAM');

-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('TEAM_LEADER', 'PRODUCT_MANAGER', 'TESTER', 'DEVELOPER', 'DEVOPS');

-- CreateEnum
CREATE TYPE "TeamStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE');

-- CreateEnum
CREATE TYPE "TeamMemberStatus" AS ENUM ('PENDING', 'ACTIVE');

-- CreateEnum
CREATE TYPE "CommentType" AS ENUM ('KEEP', 'IMPROVE');

-- CreateEnum
CREATE TYPE "FocusPointKind" AS ENUM ('IMPROVE', 'KEEP');

-- CreateEnum
CREATE TYPE "FocusPointStatus" AS ENUM ('ACTIVE', 'CLOSED', 'ARCHIVED', 'MERGED');

-- CreateEnum
CREATE TYPE "FocusPointProposalStatus" AS ENUM ('PENDING', 'MERGED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "FocusPointTaskStatus" AS ENUM ('OPEN', 'DONE', 'DROPPED');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "googleId" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "firstName" TEXT,
    "lastName" TEXT,
    "role" TEXT NOT NULL DEFAULT 'DEVELOPER',
    "isPhantom" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserOnboardingState" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "checklistDismissedAt" TIMESTAMP(3),
    "seenFeatureKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserOnboardingState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMessagingLink" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "channel" "MessagingChannel" NOT NULL,
    "externalId" TEXT NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "activeTeamId" INTEGER,
    "activeSprintId" INTEGER,
    "pendingCommentContent" TEXT,
    "pendingCommentType" "CommentType",
    "lastProcessedUpdateId" INTEGER,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contextSetAt" TIMESTAMP(3),
    "contextStickyHours" INTEGER DEFAULT 24,
    "awaitingContextConfirm" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UserMessagingLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "mainOffice" TEXT,
    "status" "TeamStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creatorId" INTEGER NOT NULL,
    "pendingApproverId" INTEGER,
    "focusPointQuota" INTEGER NOT NULL DEFAULT 3,
    "logoUpdatedAt" TIMESTAMP(3),
    "accentHue" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "deletedById" INTEGER,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamLogo" (
    "id" SERIAL NOT NULL,
    "teamId" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "contentType" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamLogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamCommentCategory" (
    "id" SERIAL NOT NULL,
    "teamId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamCommentCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamInvite" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "role" "TeamRole" NOT NULL DEFAULT 'DEVELOPER',
    "createdById" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "maxUses" INTEGER,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "convertsMemberId" INTEGER,

    CONSTRAINT "TeamInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleCalendarConnection" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "googleAccountEmail" TEXT NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoogleCalendarConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleCalendarTeamCalendar" (
    "id" SERIAL NOT NULL,
    "connectionId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "calendarId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoogleCalendarTeamCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SprintGoogleEvent" (
    "id" SERIAL NOT NULL,
    "sprintId" INTEGER NOT NULL,
    "connectionId" INTEGER NOT NULL,
    "googleEventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SprintGoogleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'DEVELOPER',
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "status" "TeamMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sprint" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "teamId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deletedById" INTEGER,

    CONSTRAINT "Sprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SprintLengthChange" (
    "id" SERIAL NOT NULL,
    "sprintId" INTEGER NOT NULL,
    "changedById" INTEGER NOT NULL,
    "previousStartDate" TIMESTAMP(3),
    "previousEndDate" TIMESTAMP(3),
    "newStartDate" TIMESTAMP(3) NOT NULL,
    "newEndDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SprintLengthChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "type" "CommentType" NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "isHighlighted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "sprintId" INTEGER NOT NULL,
    "postedByAdminId" INTEGER,
    "categoryId" INTEGER,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FocusPoint" (
    "id" SERIAL NOT NULL,
    "teamId" INTEGER NOT NULL,
    "kind" "FocusPointKind" NOT NULL,
    "text" TEXT NOT NULL,
    "status" "FocusPointStatus" NOT NULL DEFAULT 'ACTIVE',
    "initialScore" INTEGER,
    "watchSprintsLeft" INTEGER,
    "mergedIntoId" INTEGER,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "FocusPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FocusPointTextVersion" (
    "id" SERIAL NOT NULL,
    "focusPointId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "changedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FocusPointTextVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FocusPointSource" (
    "id" SERIAL NOT NULL,
    "focusPointId" INTEGER NOT NULL,
    "commentId" INTEGER NOT NULL,

    CONSTRAINT "FocusPointSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FocusPointProposal" (
    "id" SERIAL NOT NULL,
    "commentId" INTEGER NOT NULL,
    "userId" INTEGER,
    "focusPointId" INTEGER,
    "status" "FocusPointProposalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FocusPointProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FocusPointSprint" (
    "id" SERIAL NOT NULL,
    "focusPointId" INTEGER NOT NULL,
    "sprintId" INTEGER NOT NULL,
    "selectedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FocusPointSprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FocusPointRating" (
    "id" SERIAL NOT NULL,
    "focusPointId" INTEGER NOT NULL,
    "sprintId" INTEGER,
    "sprintEndedAt" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER,
    "score" INTEGER NOT NULL,
    "reason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FocusPointRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SprintRatingClose" (
    "id" SERIAL NOT NULL,
    "sprintId" INTEGER NOT NULL,
    "closedById" INTEGER,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SprintRatingClose_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FocusPointTask" (
    "id" SERIAL NOT NULL,
    "focusPointId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "assigneeId" INTEGER,
    "status" "FocusPointTaskStatus" NOT NULL DEFAULT 'OPEN',
    "dueDate" TIMESTAMP(3),
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "FocusPointTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserOnboardingState_userId_key" ON "UserOnboardingState"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserMessagingLink_channel_externalId_key" ON "UserMessagingLink"("channel", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamLogo_teamId_key" ON "TeamLogo"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamInvite_token_key" ON "TeamInvite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleCalendarTeamCalendar_connectionId_teamId_key" ON "GoogleCalendarTeamCalendar"("connectionId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "SprintGoogleEvent_sprintId_connectionId_key" ON "SprintGoogleEvent"("sprintId", "connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_userId_teamId_key" ON "TeamMember"("userId", "teamId");

-- CreateIndex
CREATE INDEX "FocusPoint_teamId_status_idx" ON "FocusPoint"("teamId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FocusPointSource_focusPointId_commentId_key" ON "FocusPointSource"("focusPointId", "commentId");

-- CreateIndex
CREATE UNIQUE INDEX "FocusPointProposal_commentId_userId_key" ON "FocusPointProposal"("commentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "FocusPointSprint_focusPointId_sprintId_key" ON "FocusPointSprint"("focusPointId", "sprintId");

-- CreateIndex
CREATE INDEX "FocusPointRating_focusPointId_sprintId_idx" ON "FocusPointRating"("focusPointId", "sprintId");

-- CreateIndex
CREATE UNIQUE INDEX "SprintRatingClose_sprintId_key" ON "SprintRatingClose"("sprintId");

-- AddForeignKey
ALTER TABLE "UserOnboardingState" ADD CONSTRAINT "UserOnboardingState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMessagingLink" ADD CONSTRAINT "UserMessagingLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_pendingApproverId_fkey" FOREIGN KEY ("pendingApproverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamLogo" ADD CONSTRAINT "TeamLogo_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamCommentCategory" ADD CONSTRAINT "TeamCommentCategory_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamCommentCategory" ADD CONSTRAINT "TeamCommentCategory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvite" ADD CONSTRAINT "TeamInvite_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvite" ADD CONSTRAINT "TeamInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvite" ADD CONSTRAINT "TeamInvite_convertsMemberId_fkey" FOREIGN KEY ("convertsMemberId") REFERENCES "TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleCalendarConnection" ADD CONSTRAINT "GoogleCalendarConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleCalendarTeamCalendar" ADD CONSTRAINT "GoogleCalendarTeamCalendar_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "GoogleCalendarConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleCalendarTeamCalendar" ADD CONSTRAINT "GoogleCalendarTeamCalendar_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintGoogleEvent" ADD CONSTRAINT "SprintGoogleEvent_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintGoogleEvent" ADD CONSTRAINT "SprintGoogleEvent_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "GoogleCalendarConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sprint" ADD CONSTRAINT "Sprint_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sprint" ADD CONSTRAINT "Sprint_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintLengthChange" ADD CONSTRAINT "SprintLengthChange_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintLengthChange" ADD CONSTRAINT "SprintLengthChange_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_postedByAdminId_fkey" FOREIGN KEY ("postedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TeamCommentCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusPoint" ADD CONSTRAINT "FocusPoint_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusPoint" ADD CONSTRAINT "FocusPoint_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusPoint" ADD CONSTRAINT "FocusPoint_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "FocusPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusPointTextVersion" ADD CONSTRAINT "FocusPointTextVersion_focusPointId_fkey" FOREIGN KEY ("focusPointId") REFERENCES "FocusPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusPointTextVersion" ADD CONSTRAINT "FocusPointTextVersion_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusPointSource" ADD CONSTRAINT "FocusPointSource_focusPointId_fkey" FOREIGN KEY ("focusPointId") REFERENCES "FocusPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusPointSource" ADD CONSTRAINT "FocusPointSource_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusPointProposal" ADD CONSTRAINT "FocusPointProposal_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusPointProposal" ADD CONSTRAINT "FocusPointProposal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusPointProposal" ADD CONSTRAINT "FocusPointProposal_focusPointId_fkey" FOREIGN KEY ("focusPointId") REFERENCES "FocusPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusPointSprint" ADD CONSTRAINT "FocusPointSprint_focusPointId_fkey" FOREIGN KEY ("focusPointId") REFERENCES "FocusPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusPointSprint" ADD CONSTRAINT "FocusPointSprint_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusPointSprint" ADD CONSTRAINT "FocusPointSprint_selectedById_fkey" FOREIGN KEY ("selectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusPointRating" ADD CONSTRAINT "FocusPointRating_focusPointId_fkey" FOREIGN KEY ("focusPointId") REFERENCES "FocusPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusPointRating" ADD CONSTRAINT "FocusPointRating_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusPointRating" ADD CONSTRAINT "FocusPointRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintRatingClose" ADD CONSTRAINT "SprintRatingClose_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintRatingClose" ADD CONSTRAINT "SprintRatingClose_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusPointTask" ADD CONSTRAINT "FocusPointTask_focusPointId_fkey" FOREIGN KEY ("focusPointId") REFERENCES "FocusPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusPointTask" ADD CONSTRAINT "FocusPointTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusPointTask" ADD CONSTRAINT "FocusPointTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
