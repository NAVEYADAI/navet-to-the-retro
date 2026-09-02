import { CommentCategory } from '@prisma/client';

// Mirrors frontend/src/constants/strings.ts's `retroBoard.categories` — kept in sync manually,
// there is no shared package between backend and frontend for this.
export const COMMENT_CATEGORY_LABELS: Record<CommentCategory, string> = {
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
