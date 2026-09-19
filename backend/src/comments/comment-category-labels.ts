// Feature 3 (team comment categories, product-backlog/03-team-comment-categories.md §3.0): the
// 13 default category labels are no longer a Prisma enum (`CommentCategory` was removed from
// schema.prisma) — `TeamCommentCategory` is now a real per-team DB table, seeded from this list
// (see teams.service.ts::create for new teams, scripts/backfill-team-comment-categories.js for
// pre-existing ones). This file still mirrors frontend/src/constants/strings.ts's
// `retroBoard.categories` — kept in sync manually, there is no shared package between backend and
// frontend for this — and is also still used by sprint-summary.builder.ts as a fallback label map
// (feature 1's PPTX export tech debt, see that feature's touchpoints note).
export const COMMENT_CATEGORY_LABELS: Record<string, string> = {
  SPRINT_SETUP: 'התארגנות לספרינט',
  PRE_PLANNING: 'פרה-פלנינג',
  PLANNING: 'פלנינג',
  ONGOING_WORK: 'עבודה שוטפת',
  TESTING: 'בדיקות',
  AVAILABILITY: 'זמינות',
  ESTIMATIONS: 'תמחורים',
  SPECIFICATIONS: 'איפיונים',
  TASK_DISTRIBUTION: 'חלוקת משימות',
  PERSONAL: 'אישי',
  FUN: 'הוואי ובידור',
  GENERAL: 'כללי',
  TECHNICAL: 'טכני'
};

export const NO_CATEGORY_LABEL = 'ללא קטגוריה';

// Ordered list of just the 13 default labels (object insertion order, matching the old enum's
// declaration order) — what actually gets seeded as `TeamCommentCategory` rows. Kept separate
// from COMMENT_CATEGORY_LABELS's key->label shape because the DB rows have no use for the old
// enum keys themselves, only the labels.
export const DEFAULT_CATEGORY_LABELS: string[] = Object.values(COMMENT_CATEGORY_LABELS);
