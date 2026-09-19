import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Modal, FlatList } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Icon } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import type { TeamCategory, TeamSprintOption } from '@/features/teams/types';
import { getTeamSettingsPanelStyles } from './team-settings-panel.styles';
import { CategoryCell } from './category-cell';

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
  onSetSprintFilterOpen: (open: boolean) => void;
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

/** Categories section: sprint-usage filter (bottom-sheet), a 2-column grid of category cells, and
 * the create-category flow. Split out of team-settings-panel.tsx to keep that file to orchestration. */
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
  onSetSprintFilterOpen,
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
    <View style={s.categoriesSection}>
      <View style={s.categoriesHeaderRow}>
        <Text style={s.sectionLabel}>{Strings.categoryManagement.categorySectionTitle}</Text>
        <TouchableOpacity style={s.sprintChip} onPress={() => onSetSprintFilterOpen(true)}>
          <Icon name="chevron-down" size="sm" tone="muted" />
          <Text style={s.sprintChipText}>{sprintFilterLabel}</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={isSprintFilterOpen} transparent animationType="fade" onRequestClose={() => onSetSprintFilterOpen(false)}>
        <TouchableOpacity style={s.sprintModalBackdrop} activeOpacity={1} onPress={() => onSetSprintFilterOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={s.sprintModalSheet}>
            <Text style={s.sprintModalTitle}>{Strings.categoryManagement.sprintFilterTitle}</Text>
            <FlatList
              data={sprints}
              keyExtractor={(sp) => String(sp.id)}
              renderItem={({ item }) => {
                const checked = (selectedSprintIds ?? []).includes(item.id);
                return (
                  <TouchableOpacity onPress={() => onToggleSprintSelected(item.id)} style={s.sprintOptionRow}>
                    <View style={s.sprintCheckbox(checked)}>
                      {checked && <Icon name="check" size="sm" tone="inverse" />}
                    </View>
                    <Text style={s.sprintOptionLabel}>{item.name}</Text>
                  </TouchableOpacity>
                );
              }}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {!!error && (
        <View style={s.errorBanner}>
          <Text style={s.errorBannerText}>{error}</Text>
        </View>
      )}

      {isLoading ? (
        <Text style={s.loadingText}>{Strings.categoryManagement.loadingText}</Text>
      ) : categories.length === 0 ? (
        <Text style={s.listShellEmptyText}>{Strings.categoryManagement.emptyText}</Text>
      ) : (
        <View style={s.categoriesGrid}>
          {categories.map((category) => (
            <CategoryCell
              key={category.id}
              category={category}
              onToggleEnabled={onToggleEnabled}
              isToggling={togglingId === category.id}
            />
          ))}
        </View>
      )}

      {showCreateForm ? (
        <View style={s.createForm}>
          {!!createError && (
            <View style={s.errorBanner}>
              <Text style={s.errorBannerText}>{createError}</Text>
            </View>
          )}
          <Text style={s.fieldLabel}>{Strings.categoryManagement.newCategoryLabel}</Text>
          <TextInput
            style={s.input}
            placeholder={Strings.categoryManagement.newCategoryPlaceholder}
            placeholderTextColor={t.color.textSecondary}
            value={newLabel}
            onChangeText={onNewLabelChange}
          />
          <View style={s.detailsButtonsRow}>
            <TouchableOpacity style={s.primaryButton} onPress={onCreateCategory} disabled={isCreating}>
              {isCreating ? (
                <ActivityIndicator size="small" color={t.color.accent.onBase} />
              ) : (
                <>
                  <Icon name="plus" size="sm" tone="inverse" />
                  <Text style={s.primaryButtonText}>{Strings.categoryManagement.createButton}</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={s.secondaryButton} onPress={onHideCreateForm}>
              <Text style={s.secondaryButtonText}>{Strings.teamList.cancelButton}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={s.addCategoryButton}
          onPress={() => { onShowCreateForm(); trackEvent('team_category_create_form_opened', { teamId }); }}
        >
          <Icon name="plus" size="sm" tone="accent" />
          <Text style={s.addCategoryButtonText}>{Strings.categoryManagement.createButton}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
