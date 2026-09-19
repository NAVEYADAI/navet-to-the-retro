import React from 'react';
import { Box, Typography, Alert } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Button, Field, Badge, Switch, Icon } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import type { TeamCategory, TeamSprintOption } from '@/features/teams/types';
import { getTeamSettingsPanelStyles } from './team-settings-panel.styles';

interface CategoryListSectionProps {
  teamId: number;
  categories: TeamCategory[];
  isLoading: boolean;
  error: string | null;
  onToggleEnabled: (category: TeamCategory) => void;
  togglingId: number | null;

  sprints: TeamSprintOption[];
  selectedSprintIds: number[] | null;
  sprintFilterLabel: string;
  isSprintFilterOpen: boolean;
  onToggleSprintFilterOpen: () => void;
  onToggleSprintSelected: (sprintId: number) => void;

  showCreateForm: boolean;
  onShowCreateForm: () => void;
  onHideCreateForm: () => void;
  newLabel: string;
  onNewLabelChange: (v: string) => void;
  isCreating: boolean;
  createError: string | null;
  onCreateCategory: () => void;
}

/** Categories section: sprint-usage filter chip, a 2-column grid of category cells, and the
 * create-category flow. Split out of team-settings-panel.tsx to keep that file to orchestration. */
export function CategoryListSection({
  teamId,
  categories,
  isLoading,
  error,
  onToggleEnabled,
  togglingId,
  sprints,
  selectedSprintIds,
  sprintFilterLabel,
  isSprintFilterOpen,
  onToggleSprintFilterOpen,
  onToggleSprintSelected,
  showCreateForm,
  onShowCreateForm,
  onHideCreateForm,
  newLabel,
  onNewLabelChange,
  isCreating,
  createError,
  onCreateCategory,
}: CategoryListSectionProps) {
  const t = useTheme();
  const s = getTeamSettingsPanelStyles(t);

  return (
    <Box sx={s.categoriesSection}>
      <Box sx={s.categoriesHeaderRow}>
        <Typography sx={s.sectionLabel}>{Strings.categoryManagement.categorySectionTitle}</Typography>

        <Box sx={s.sprintFilterWrap}>
          <Box component="button" type="button" onClick={onToggleSprintFilterOpen} sx={s.sprintChip}>
            {sprintFilterLabel}
            <Icon name="chevron-down" size="sm" tone="muted" />
          </Box>

          {isSprintFilterOpen && (
            <>
              <Box onClick={onToggleSprintFilterOpen} sx={s.sprintDropdownBackdrop} />
              <Box sx={s.sprintDropdownMenu}>
                <Typography sx={s.sprintDropdownTitle}>{Strings.categoryManagement.sprintFilterTitle}</Typography>
                {sprints.map((sprint) => {
                  const checked = (selectedSprintIds ?? []).includes(sprint.id);
                  return (
                    <Box key={sprint.id} onClick={() => onToggleSprintSelected(sprint.id)} sx={s.sprintOptionRow}>
                      <Box sx={s.sprintCheckbox(checked)}>
                        {checked && <Icon name="check" size="sm" tone="inverse" />}
                      </Box>
                      <Typography sx={s.sprintOptionLabel}>{sprint.name}</Typography>
                    </Box>
                  );
                })}
              </Box>
            </>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ ...t.type.body }}>
          {error}
        </Alert>
      )}

      {isLoading ? (
        <Box sx={s.listShellEmpty}>
          <Typography sx={{ ...t.type.body, color: t.color.textSecondary }}>
            {Strings.categoryManagement.loadingText}
          </Typography>
        </Box>
      ) : categories.length === 0 ? (
        <Box sx={s.listShellEmpty}>
          <Typography sx={{ ...t.type.caption, color: t.color.textMuted }}>
            {Strings.categoryManagement.emptyText}
          </Typography>
        </Box>
      ) : (
        <Box sx={s.categoriesGrid}>
          {categories.map((category) => (
            <Box key={category.id} sx={s.categoryCell(category.isEnabled)}>
              <Box sx={s.categoryCellTop}>
                <Typography sx={s.categoryLabel}>{category.label}</Typography>
                <Badge tone={category.isDefault ? 'neutral' : 'accent'}>
                  {category.isDefault ? Strings.categoryManagement.defaultBadge : Strings.categoryManagement.customBadge}
                </Badge>
              </Box>
              <Box sx={s.categoryCellBottom}>
                <Typography sx={s.categoryUsageText}>
                  {Strings.categoryManagement.usageCountLabel(category.commentCount)}
                </Typography>
                <Switch
                  checked={category.isEnabled}
                  onChange={() => onToggleEnabled(category)}
                  disabled={togglingId === category.id}
                />
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {showCreateForm ? (
        <Box sx={s.createForm}>
          {createError && (
            <Alert severity="error" sx={{ ...t.type.body }}>
              {createError}
            </Alert>
          )}
          <Field
            label={Strings.categoryManagement.newCategoryLabel}
            placeholder={Strings.categoryManagement.newCategoryPlaceholder}
            value={newLabel}
            onChangeText={onNewLabelChange}
          />
          <Box sx={s.createFormButtonsRow}>
            <Button variant="primary" size="sm" icon="plus" onPress={onCreateCategory} disabled={isCreating} loading={isCreating}>
              {Strings.categoryManagement.createButton}
            </Button>
            <Button variant="secondary" size="sm" onPress={onHideCreateForm}>
              {Strings.teamList.cancelButton}
            </Button>
          </Box>
        </Box>
      ) : (
        <Box
          component="button"
          type="button"
          onClick={() => { onShowCreateForm(); trackEvent('team_category_create_form_opened', { teamId }); }}
          sx={s.addCategoryButton}
        >
          <Icon name="plus" size="sm" tone="accent" />
          {Strings.categoryManagement.createButton}
        </Box>
      )}
    </Box>
  );
}
