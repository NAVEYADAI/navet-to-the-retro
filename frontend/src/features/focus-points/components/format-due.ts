/** Task due dates are end-of-day Israel time server-side, so they are always shown in that zone. */
export function formatDueDate(dueDate: string): string {
  return new Date(dueDate).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
}

/** The API's ISO due date -> the "YYYY-MM-DD" a date input expects (Israel time). */
export function dueDateToInput(dueDate: string | null): string {
  return dueDate ? new Date(dueDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }) : '';
}
