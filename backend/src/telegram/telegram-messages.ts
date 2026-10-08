// Bot-facing Hebrew wording — reasonable-default copy per product-backlog/10-telegram-comment-
// ingestion.md §10.0 "שאלות פתוחות" #1 ("ניסוח מדויק/ליטוש של הודעות הבוט בעברית... לא סוכם, סיכון
// נמוך... אפשר להתחיל עם ניסוח סביר ולעדכן"). Centralized here, not inlined across the telegram
// module's services, specifically so a later wording pass touches only this file.
//
// Style rules (Nave's explicit feedback, live testing): short and to the point, no filler
// sentences, use Telegram's bold for emphasis instead of long explanations.
//
// All bot messages are sent with parse_mode HTML (see TelegramApiService.sendMessage) — BUG-26:
// legacy Markdown has no working way to escape special characters inside `*...*`, so a team/sprint/
// category name like `dev_ops` or `a*b` made Telegram reject the whole message with a 400. Every
// dynamic (user-entered) value must go through `escapeHtml()` before being interpolated below.

import { TelegramReplyKeyboard } from './telegram-api.service';

export const SWITCH_TEAM_COMMAND = '🔙 החלף צוות';
export const SKIP_CATEGORY_COMMAND = '⏭️ דלג';
// Explicitly says "delete" on the button itself, not just in a follow-up message — the button
// label "❌ ביטול" wasn't clear enough that it actually discards the in-progress note.
export const CANCEL_COMMAND = '🗑️ מחק הערה';
// Steps back ONE stage (category → Keep/Improve; Keep/Improve → re-type the note) instead of
// discarding everything like CANCEL_COMMAND — available at every step of entering a comment.
export const BACK_COMMAND = '↩️ חזור';

/** Escapes the three characters Telegram's HTML parse mode treats as special (`&`, `<`, `>`) in
 *  dynamic (user-entered) text, so a team/sprint/category name can never break Telegram's parser
 *  or inject formatting/tags. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const START_MESSAGE =
  '👋 <b>הבוט של Navet Retro</b>\nשלחו הודעת טקסט ואוסיף אותה כתגובת רטרו לספרינט הפתוח שלכם.\n' +
  'לא מקושרים? התחברו ב-Settings באפליקציה.';

export const NOT_LINKED_MESSAGE = '🔒 עדיין לא מקושר. התחברו ב-Settings באפליקציה.';

export const NO_OPEN_TEAM_MESSAGE = '😕 אין לך צוות עם ספרינט פתוח כרגע.';

export const GROUP_CHAT_NOT_SUPPORTED_MESSAGE = '🙅 עובד רק בצ׳אט פרטי.';

export const TEXT_ONLY_MESSAGE = '📝 טקסט בלבד כרגע.';

export const ASK_KEEP_OR_IMPROVE_MESSAGE = '<b>שימור</b> או <b>שיפור</b>?';

export const ASK_KEEP_OR_IMPROVE_RETRY_MESSAGE = '🤔 לא הבנתי, בחר/י למטה.';

export const CREATE_FAILED_MESSAGE = '😕 <b>לא נשמר</b> - נסה/י שוב.';

export const CANCELLED_MESSAGE = '🗑️ <b>ההערה נמחקה.</b>';
export const NOTHING_TO_CANCEL_MESSAGE = 'אין מה למחוק.';

// BUG-48: the in-progress draft was dropped because the team/sprint context expired (sprint closed,
// membership lost, or sticky-hours elapsed) before the user finished answering — the user's latest
// message was a reply to the dropped flow, NOT a new comment, so it is deliberately not saved.
export const DRAFT_EXPIRED_MESSAGE = '⌛ <b>ההערה לא נשמרה</b> - ההקשר פג. שלח/י אותה שוב.';

export const BACK_TO_CONTENT_MESSAGE = '↩️ <b>חזרה אחורה</b> - שלח/י את ההערה שוב.';
export const NOTHING_TO_GO_BACK_MESSAGE = 'אין שלב קודם.';

export function teamSelectedMessage(teamName: string): string {
  return `✅ <b>${escapeHtml(teamName)}</b>`;
}

export function buildTeamListMessage(candidates: { teamName: string }[]): string {
  const lines = candidates.map((c, i) => `${i + 1}. ${escapeHtml(c.teamName)}`);
  return ['<b>לאיזו קבוצה?</b>', ...lines].join('\n');
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
  const lines = sprints.map((s, i) => `${i + 1}. ${escapeHtml(s.sprintName)}`);
  return ['<b>איזה ספרינט?</b>', ...lines].join('\n');
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
  return `✅ ספרינט <b>${escapeHtml(sprintName)}</b>`;
}

/** Recap (team + sprint) shown once, right as we transition into the Keep/Improve question —
 *  Nave's explicit ask for "a mention at the start of which team and sprint" this note goes to. */
export function askTypeMessage(teamName: string, sprintName: string): string {
  return `🏷️ <b>${escapeHtml(teamName)}</b> · ספרינט <b>${escapeHtml(sprintName)}</b>\n\n${ASK_KEEP_OR_IMPROVE_MESSAGE}`;
}

export function buildCategoryListMessage(categories: { label: string }[]): string {
  const lines = categories.map((c, i) => `${i + 1}. ${escapeHtml(c.label)}`);
  return ['<b>קטגוריה?</b>', ...lines].join('\n');
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
  return `<b>נשמר!</b> ${typeLabel} · ${escapeHtml(sprintName)}`;
}
