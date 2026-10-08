import type { TextStyle, ViewStyle } from 'react-native';
import type { AppTheme } from '@/design/tokens';

/** RN doesn't support the web font stack / unitless line-height from tokens.ts — adapt numerically. */
export function rnText(entry: { fontSize: number; fontWeight: number; lineHeight: number }): TextStyle {
  return {
    fontSize: entry.fontSize,
    lineHeight: Math.round(entry.fontSize * entry.lineHeight),
    fontWeight: String(entry.fontWeight) as TextStyle['fontWeight'],
  };
}

// Style factory for the team-settings panel (team-settings-panel.tsx + its two sections).
// Kept in its own file per project convention (see src/features/settings/styles,
// src/features/teams/styles) so the component files stay focused on markup/logic, not style objects.
export function getTeamSettingsPanelStyles(t: AppTheme) {
  const sectionLabel: TextStyle = {
    ...rnText({ ...t.type.overline, fontWeight: 700 }),
    color: t.color.textMuted,
    textAlign: 'right',
  };

  const input: TextStyle = {
    ...rnText(t.type.body),
    height: t.layout.minTouchTarget,
    borderWidth: 1,
    borderRadius: t.radius.field,
    paddingHorizontal: t.space[2],
    textAlign: 'right',
    color: t.color.text,
    borderColor: t.color.border,
    backgroundColor: t.color.surface,
  };

  return {
    // The card supplies the panel's background/padding (team-card.tsx) — this is just the stack.
    panel: { gap: t.space[6] } as ViewStyle,
    sectionLabel,
    input,

    // Team details
    detailsSection: { gap: t.space[3] } as ViewStyle,
    detailsMessage: (isError: boolean): ViewStyle => ({
      backgroundColor: isError ? t.color.status.danger.bg : t.color.status.success.bg,
      borderWidth: 1,
      borderColor: isError ? t.color.status.danger.border : t.color.status.success.border,
      borderRadius: t.radius.field,
      padding: t.space[2],
    }),
    detailsMessageText: (isError: boolean): TextStyle => ({
      ...rnText(t.type.caption),
      color: isError ? t.color.status.danger.fg : t.color.status.success.fg,
      textAlign: 'right',
    }),
    detailsEditCard: {
      gap: t.space[3],
      padding: t.space[4],
      borderRadius: t.radius.card,
      borderWidth: 1,
      borderColor: t.color.border,
      backgroundColor: t.color.surface,
    } as ViewStyle,
    fieldLabel: { ...rnText(t.type.caption), color: t.color.text, textAlign: 'right' } as TextStyle,
    detailsButtonsRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: t.space[2] } as ViewStyle,
    primaryButton: {
      flexDirection: 'row-reverse',
      gap: t.space[1],
      backgroundColor: t.color.accent.base,
      borderRadius: t.radius.field,
      minHeight: t.layout.minTouchTarget,
      paddingHorizontal: t.space[4],
      justifyContent: 'center',
      alignItems: 'center',
    } as ViewStyle,
    primaryButtonText: { ...rnText(t.type.bodyStrong), color: t.color.accent.onBase } as TextStyle,
    secondaryButton: {
      backgroundColor: t.color.surface,
      borderWidth: 1,
      borderColor: t.color.border,
      borderRadius: t.radius.field,
      minHeight: t.layout.minTouchTarget,
      paddingHorizontal: t.space[4],
      justifyContent: 'center',
      alignItems: 'center',
    } as ViewStyle,
    secondaryButtonText: { ...rnText(t.type.bodyStrong), color: t.color.text } as TextStyle,

    detailsDisplayCard: {
      flexDirection: 'row-reverse',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: t.space[3],
      padding: t.space[4],
      borderRadius: t.radius.card,
      borderWidth: 1,
      borderColor: t.color.border,
      backgroundColor: t.color.surface,
    } as ViewStyle,
    detailsNameColumn: { gap: t.space[1] + 2, flexShrink: 1 } as ViewStyle,
    detailsName: { ...rnText(t.type.rowTitle), color: t.color.text, textAlign: 'right' } as TextStyle,
    detailsOfficeRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: t.space[1] } as ViewStyle,
    detailsOfficeText: { ...rnText(t.type.caption), color: t.color.textSecondary } as TextStyle,
    editTrigger: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, paddingHorizontal: t.space[3], paddingVertical: t.space[1] + 2 } as ViewStyle,
    editTriggerText: { ...rnText(t.type.bodyStrong), color: t.color.textSecondary } as TextStyle,

    // Categories
    categoriesSection: { gap: t.space[3] } as ViewStyle,
    categoriesHeaderRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: t.space[2] } as ViewStyle,
    sprintChip: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
      borderColor: t.color.borderStrong,
      borderRadius: t.radius.pill,
      paddingHorizontal: t.space[3],
      paddingVertical: t.space[1] + 2,
      backgroundColor: t.color.surface,
    } as ViewStyle,
    sprintChipText: { ...rnText({ ...t.type.caption, fontWeight: 600 }), color: t.color.text } as TextStyle,
    sprintModalBackdrop: { flex: 1, backgroundColor: t.color.overlay, justifyContent: 'flex-end' } as ViewStyle,
    sprintModalSheet: {
      backgroundColor: t.color.surface,
      borderTopLeftRadius: t.radius.card + 8,
      borderTopRightRadius: t.radius.card + 8,
      maxHeight: '70%',
      paddingVertical: t.space[2],
    } as ViewStyle,
    sprintModalTitle: {
      ...rnText({ ...t.type.overline, fontWeight: 700 }),
      color: t.color.textMuted,
      textAlign: 'right',
      paddingHorizontal: t.space[4],
      paddingVertical: t.space[2],
    } as TextStyle,
    sprintOptionRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: t.space[2], paddingVertical: t.space[3], paddingHorizontal: t.space[5] } as ViewStyle,
    sprintOptionLabel: { ...rnText(t.type.body), color: t.color.text, textAlign: 'right', flexShrink: 1 } as TextStyle,
    sprintCheckbox: (checked: boolean): ViewStyle => ({
      width: 18,
      height: 18,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: checked ? t.color.accent.base : t.color.borderStrong,
      backgroundColor: checked ? t.color.accent.base : 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    }),

    errorBanner: {
      backgroundColor: t.color.status.danger.bg,
      borderWidth: 1,
      borderColor: t.color.status.danger.border,
      borderRadius: t.radius.field,
      padding: t.space[2],
    } as ViewStyle,
    errorBannerText: { ...rnText(t.type.caption), color: t.color.status.danger.fg, textAlign: 'right' } as TextStyle,

    listShellEmptyText: {
      ...rnText(t.type.caption),
      color: t.color.textMuted,
      textAlign: 'right',
      padding: t.space[4],
      borderWidth: 1,
      borderColor: t.color.border,
      borderRadius: t.radius.card,
    } as TextStyle,
    loadingText: {
      ...rnText(t.type.body),
      color: t.color.textSecondary,
      textAlign: 'right',
      padding: t.space[4],
      borderWidth: 1,
      borderColor: t.color.border,
      borderRadius: t.radius.card,
    } as TextStyle,

    categoriesGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: t.space[2] } as ViewStyle,
    categoryCell: (isEnabled: boolean): ViewStyle => ({
      flexBasis: '48%',
      flexGrow: 1,
      gap: t.space[1] + 2,
      borderRadius: t.radius.card,
      borderWidth: 1,
      borderColor: t.color.border,
      backgroundColor: t.color.surface,
      paddingHorizontal: t.space[3],
      paddingVertical: t.space[3],
      opacity: isEnabled ? 1 : 0.55,
    }),
    categoryCellTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: t.space[2], flexWrap: 'wrap' } as ViewStyle,
    categoryLabel: { ...rnText(t.type.bodyStrong), color: t.color.text, textAlign: 'right', flexShrink: 1 } as TextStyle,
    categoryBadge: (isDefault: boolean): ViewStyle => ({
      backgroundColor: isDefault ? t.color.surfaceSubtle : t.color.accent.subtle,
      borderWidth: 1,
      borderColor: isDefault ? t.color.border : t.color.accent.border,
      borderRadius: t.radius.badge,
      paddingHorizontal: t.space[2],
      paddingVertical: 2,
    }),
    categoryBadgeText: (isDefault: boolean): TextStyle => ({
      ...rnText({ ...t.type.caption, fontWeight: 700 }),
      color: isDefault ? t.color.textSecondary : t.color.accent.base,
    }),
    categoryCellBottom: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: t.space[2] } as ViewStyle,
    categoryUsageText: { ...rnText(t.type.caption), color: t.color.textMuted } as TextStyle,

    createForm: { gap: t.space[2], padding: t.space[4], borderRadius: t.radius.card, borderWidth: 1, borderColor: t.color.border, backgroundColor: t.color.surfaceSubtle } as ViewStyle,
    addCategoryButton: {
      flexDirection: 'row-reverse',
      gap: t.space[1],
      paddingVertical: t.space[3],
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: t.radius.card,
      borderWidth: 1,
      borderColor: t.color.borderStrong,
      borderStyle: 'dashed',
    } as ViewStyle,
    addCategoryButtonText: { ...rnText(t.type.bodyStrong), color: t.color.accent.base } as TextStyle,
  };
}

export type TeamSettingsPanelStyles = ReturnType<typeof getTeamSettingsPanelStyles>;
