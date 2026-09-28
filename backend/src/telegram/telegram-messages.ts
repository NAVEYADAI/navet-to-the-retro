// Bot-facing Hebrew wording — reasonable-default copy per product-backlog/10-telegram-comment-
// ingestion.md §10.0 "שאלות פתוחות" #1 ("ניסוח מדויק/ליטוש של הודעות הבוט בעברית... לא סוכם, סיכון
// נמוך... אפשר להתחיל עם ניסוח סביר ולעדכן"). Centralized here, not inlined across the telegram
// module's services, specifically so a later wording pass touches only this file.
//
// Style rules (Nave's explicit feedback, live testing): short and to the point, no filler
// sentences, use Telegram's Markdown bold for emphasis instead of long explanations.

import { TelegramReplyKeyboard } from './telegram-api.service';

export const SWITCH_TEAM_COMMAND = '🔙 החלף צוות';
export const SKIP_CATEGORY_COMMAND = '⏭️ דלג';
// Explicitly says "delete" on the button itself, not just in a follow-up message — the button
// label "❌ ביטול" wasn't clear enough that it actually discards the in-progress note.
export const CANCEL_COMMAND = '🗑️ מחק הערה';
// Steps back ONE stage (category → Keep/Improve; Keep/Improve → re-type the note) instead of
// discarding everything like CANCEL_COMMAND — available at every step of entering a comment.
export const BACK_COMMAND = '↩️ חזור';

/** Escapes legacy-Markdown special characters in dynamic (user-entered) text before interpolating
 *  it into a bold/italic message, so a team/sprint/category name containing `*`, `_`, `` ` `` or
 *  `[` can never break Telegram's parser or accidentally toggle formatting. */
export function escapeMarkdown(text: string): string {
  return text.replace(/([_*`[])/g, '\\$1');
}

export const START_MESSAGE =
  '👋 *הבוט של Navet Retro*\nשלחו הודעת טקסט ואוסיף אותה כתגובת רטרו לספרינט הפתוח שלכם.\n' +
  'לא מקושרים? התחברו ב-Settings באפליקציה.';

export const NOT_LINKED_MESSAGE = '🔒 עדיין לא מקושר. התחברו ב-Settings באפליקציה.';

export const NO_OPEN_TEAM_MESSAGE = '😕 אין לך צוות עם ספרינט פתוח כרגע.';

export const GROUP_CHAT_NOT_SUPPORTED_MESSAGE = '🙅 עובד רק בצ׳אט פרטי.';

export const TEXT_ONLY_MESSAGE = '📝 טקסט בלבד כרגע.';

export const ASK_KEEP_OR_IMPROVE_MESSAGE = '*שימור* או *שיפור*?';

export const ASK_KEEP_OR_IMPROVE_RETRY_MESSAGE = '🤔 לא הבנתי, בחר/י למטה.';

export const CREATE_FAILED_MESSAGE = '😕 *לא נשמר* - נסה/י שוב.';

export const CANCELLED_MESSAGE = '🗑️ *ההערה נמחקה.*';
export const NOTHING_TO_CANCEL_MESSAGE = 'אין מה למחוק.';

export const BACK_TO_CONTENT_MESSAGE = '↩️ *חזרה אחורה* - שלח/י את ההערה שוב.';
export const NOTHING_TO_GO_BACK_MESSAGE = 'אין שלב קודם.';

export function teamSelectedMessage(teamName: string): string {
  return `✅ *${escapeMarkdown(teamName)}*`;
}

export function buildTeamListMessage(candidates: { teamName: string }[]): string {
  const lines = candidates.map((c, i) => `${i + 1}. ${c.teamName}`);
  return ['*לאיזו קבוצה?*', ...lines].join('\n');
}

/** Tap-to-select buttons for the team list — same options as buildTeamListMessage, numbered text,
 *  plus delete/cancel (relevant when this is showing because of a held draft — a single team
 *  re-confirmed after "↩️ חזור" included). */
export function teamListKeyboard(candidates: { teamName: string }[]): TelegramReplyKeyboard {
  return {
    keyboard: [...candidates.map((c) => [c.teamName]), [CANCEL_COMMAND]],
    resize_keyboard: true,
    one_time_keyboard: true
  };
}

export function buildSprintListMessage(sprints: { sprintName: string }[]): string {
  const lines = sprints.map((s, i) => `${i + 1}. ${s.sprintName}`);
  return ['*איזה ספרינט?*', ...lines].join('\n');
}

/** Tap-to-select buttons for the sprint list — same mechanism as teamListKeyboard, Nave's ask. */
export function sprintListKeyboard(sprints: { sprintName: string }[]): TelegramReplyKeyboard {
  return {
    keyboard: [...sprints.map((s) => [s.sprintName]), [CANCEL_COMMAND]],
    resize_keyboard: true,
    one_time_keyboard: true
  };
}

export function sprintSelectedMessage(sprintName: string): string {
  return `✅ ספרינט *${escapeMarkdown(sprintName)}*`;
}

/** Recap (team + sprint) shown once, right as we transition into the Keep/Improve question —
 *  Nave's explicit ask for "a mention at the start of which team and sprint" this note goes to. */
export function askTypeMessage(teamName: string, sprintName: string): string {
  return `🏷️ *${escapeMarkdown(teamName)}* · ספרינט *${escapeMarkdown(sprintName)}*\n\n${ASK_KEEP_OR_IMPROVE_MESSAGE}`;
}

export function buildCategoryListMessage(categories: { label: string }[]): string {
  const lines = categories.map((c, i) => `${i + 1}. ${c.label}`);
  return ['*קטגוריה?*', ...lines].join('\n');
}

// Same icons the frontend retro board uses for these two columns (sprint-retro-board-web.tsx:
// Icon name="check" for KEEP, Icon name="wrench" for IMPROVE) so the bot stays visually
// consistent with the app. "שיפור" listed first / "שימור" second so שימור renders on the right
// side of the row (per Nave's explicit ask — opposite of the initial left-to-right order).
export const KEEP_LABEL = '✅ שימור';
export const IMPROVE_LABEL = '🔧 שיפור';

/** Tap-to-select buttons for שימור/שיפור — always paired with back + delete/cancel. */
export function keepImproveKeyboard(): TelegramReplyKeyboard {
  return {
    keyboard: [[IMPROVE_LABEL, KEEP_LABEL], [BACK_COMMAND, CANCEL_COMMAND]],
    resize_keyboard: true,
    one_time_keyboard: true
  };
}

/** Tap-to-select buttons for the category list, plus skip, back and delete/cancel. */
export function categoryKeyboard(categories: { label: string }[]): TelegramReplyKeyboard {
  return {
    keyboard: [...categories.map((c) => [c.label]), [SKIP_CATEGORY_COMMAND], [BACK_COMMAND, CANCEL_COMMAND]],
    resize_keyboard: true,
    one_time_keyboard: true
  };
}

export function confirmationMessage(sprintName: string, type: 'KEEP' | 'IMPROVE'): string {
  const typeLabel = type === 'KEEP' ? KEEP_LABEL : IMPROVE_LABEL;
  return `*נשמר!* ${typeLabel} · ${escapeMarkdown(sprintName)}`;
}
