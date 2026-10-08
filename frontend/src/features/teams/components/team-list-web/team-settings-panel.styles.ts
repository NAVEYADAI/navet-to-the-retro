import type { SxProps, Theme } from '@mui/material';
import type { AppTheme } from '@/design/tokens';

// Style factory for the team-settings panel (team-settings-panel.tsx + its two sections).
// Kept in its own file per project convention (see src/features/settings/styles,
// src/features/teams/styles) so the component files stay focused on markup/logic, not sx blocks.
export function getTeamSettingsPanelStyles(t: AppTheme) {
  const sectionLabel: SxProps<Theme> = {
    ...t.type.overline,
    color: t.color.textMuted,
    textTransform: 'uppercase',
  };

  return {
    // The card supplies the panel's background/padding (team-card.tsx) — this is just the stack.
    panel: { display: 'flex', flexDirection: 'column', gap: `${t.space[6]}px` } as SxProps<Theme>,

    sectionLabel,

    // Team details section
    detailsSection: { display: 'flex', flexDirection: 'column', gap: `${t.space[3]}px` } as SxProps<Theme>,
    detailsDisplayCard: {
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: `${t.space[3]}px`,
      backgroundColor: t.color.surface,
      border: `1px solid ${t.color.border}`,
      borderRadius: `${t.radius.card}px`,
      padding: `${t.space[4]}px`,
    } as SxProps<Theme>,
    detailsNameColumn: { display: 'flex', flexDirection: 'column', gap: `${t.space[1] + 2}px`, minWidth: 0 } as SxProps<Theme>,
    detailsName: { ...t.type.rowTitle, color: t.color.text, minWidth: 0 } as SxProps<Theme>,
    detailsOfficeRow: { display: 'flex', alignItems: 'center', gap: `${t.space[1]}px` } as SxProps<Theme>,
    detailsOfficeText: { ...t.type.caption, color: t.color.textSecondary } as SxProps<Theme>,
    detailsEditCard: {
      display: 'flex',
      flexDirection: 'column',
      gap: `${t.space[3]}px`,
      padding: `${t.space[4]}px`,
      backgroundColor: t.color.surface,
      border: `1px solid ${t.color.border}`,
      borderRadius: `${t.radius.card}px`,
    } as SxProps<Theme>,
    detailsButtonsRow: { display: 'flex', flexWrap: 'wrap', gap: `${t.space[3]}px` } as SxProps<Theme>,

    // Categories section
    categoriesSection: { display: 'flex', flexDirection: 'column', gap: `${t.space[3]}px` } as SxProps<Theme>,
    categoriesHeaderRow: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: `${t.space[2]}px`,
    } as SxProps<Theme>,

    sprintFilterWrap: { position: 'relative' } as SxProps<Theme>,
    sprintChip: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: `${t.space[1]}px`,
      ...t.type.caption,
      fontWeight: 600,
      color: t.color.text,
      backgroundColor: t.color.surface,
      border: `1px solid ${t.color.borderStrong}`,
      borderRadius: `${t.radius.pill}px`,
      paddingBlock: '5px',
      paddingInline: `${t.space[3]}px`,
      cursor: 'pointer',
      transition: `border-color ${t.motion.fast}, background-color ${t.motion.fast}`,
      '&:hover': { borderColor: t.color.textMuted },
    } as SxProps<Theme>,
    sprintDropdownBackdrop: { position: 'fixed', inset: 0, zIndex: 10 } as SxProps<Theme>,
    sprintDropdownMenu: {
      position: 'absolute',
      top: '100%',
      insetInlineEnd: 0,
      marginTop: '6px',
      zIndex: 11,
      width: 240,
      maxHeight: 280,
      overflowY: 'auto',
      backgroundColor: t.color.surface,
      border: `1px solid ${t.color.border}`,
      borderRadius: `${t.radius.field}px`,
      boxShadow: t.shadow.md,
      padding: '4px',
    } as SxProps<Theme>,
    sprintDropdownTitle: { ...t.type.overline, color: t.color.textMuted, padding: '8px 10px' } as SxProps<Theme>,
    sprintOptionRow: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: `${t.space[2]}px`,
      padding: '8px 10px',
      borderRadius: `${t.radius.badge}px`,
      cursor: 'pointer',
      '&:hover': { backgroundColor: t.color.surfaceHover },
    } as SxProps<Theme>,
    sprintOptionLabel: { ...t.type.body, color: t.color.text, minWidth: 0 } as SxProps<Theme>,
    sprintCheckbox: (checked: boolean): SxProps<Theme> => ({
      width: 16,
      height: 16,
      flexShrink: 0,
      borderRadius: '4px',
      border: `1.5px solid ${checked ? t.color.accent.base : t.color.borderStrong}`,
      backgroundColor: checked ? t.color.accent.base : 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),

    categoriesGrid: {
      display: 'grid',
      gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
      gap: `${t.space[2]}px`,
    } as SxProps<Theme>,
    categoryCell: (isEnabled: boolean): SxProps<Theme> => ({
      display: 'flex',
      flexDirection: 'column',
      gap: `${t.space[1] + 2}px`,
      minWidth: 0,
      backgroundColor: t.color.surface,
      border: `1px solid ${t.color.border}`,
      borderRadius: `${t.radius.card}px`,
      padding: `${t.space[3]}px`,
      opacity: isEnabled ? 1 : 0.55,
      transition: `opacity ${t.motion.fast}`,
    }),
    categoryCellTop: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: `${t.space[2]}px`, minWidth: 0 } as SxProps<Theme>,
    categoryLabel: { ...t.type.bodyStrong, color: t.color.text, minWidth: 0 } as SxProps<Theme>,
    categoryCellBottom: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: `${t.space[2]}px` } as SxProps<Theme>,
    categoryUsageText: { ...t.type.caption, color: t.color.textMuted } as SxProps<Theme>,

    listShellEmpty: { padding: `${t.space[4]}px`, border: `1px solid ${t.color.border}`, borderRadius: `${t.radius.card}px` } as SxProps<Theme>,

    createForm: {
      display: 'flex',
      flexDirection: 'column',
      gap: `${t.space[3]}px`,
      padding: `${t.space[4]}px`,
      backgroundColor: t.color.surfaceSubtle,
      border: `1px solid ${t.color.border}`,
      borderRadius: `${t.radius.card}px`,
    } as SxProps<Theme>,
    createFormButtonsRow: { display: 'flex', flexWrap: 'wrap', flexDirection: 'row', gap: `${t.space[3]}px` } as SxProps<Theme>,
    addCategoryButton: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: `${t.space[1]}px`,
      padding: `${t.space[3]}px`,
      backgroundColor: 'transparent',
      border: `1px dashed ${t.color.borderStrong}`,
      borderRadius: `${t.radius.card}px`,
      cursor: 'pointer',
      color: t.color.accent.base,
      ...t.type.bodyStrong,
      transition: `background-color ${t.motion.fast}`,
      '&:hover': { backgroundColor: t.color.surfaceSubtle },
    } as SxProps<Theme>,
  };
}

export type TeamSettingsPanelStyles = ReturnType<typeof getTeamSettingsPanelStyles>;
