// Mirrors SPRINT_SUMMARY_TEMPLATES in backend/src/sprints/sprint-summary.builder.ts — kept in
// sync manually (same pattern as comment-category-labels.ts: no shared package between
// frontend and backend). Only a representative swatch color is needed here, not the full palette.
export const SPRINT_SUMMARY_TEMPLATES = [
  { id: 'classic', label: 'קלאסי', swatch: '#2E7D32' },
  { id: 'dark', label: 'כהה', swatch: '#1B1B2F' },
  { id: 'vibrant', label: 'צבעוני', swatch: '#00897B' },
] as const;

export type SprintSummaryTemplateId = (typeof SPRINT_SUMMARY_TEMPLATES)[number]['id'];
