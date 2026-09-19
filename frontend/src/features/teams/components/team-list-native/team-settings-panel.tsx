import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Icon } from '@/components/ui';
import { useTeamSettingsPanel } from '@/features/teams/hooks/use-team-settings-panel';
import { getTeamSettingsPanelStyles } from './team-settings-panel.styles';
import { TeamDetailsSection } from './team-details-section';
import { CategoryListSection } from './category-list-section';

export type { TeamCategory } from '@/features/teams/types';

interface TeamSettingsPanelNativeProps {
  teamId: number;
  token: string;
  isTeamAdmin: boolean;
  teamName: string;
  teamOffice: string | null | undefined;
  onTeamDetailsUpdated: () => void;
}

// Feature 3 (team comment categories, product-backlog/03-team-comment-categories.md §3.2) —
// redesigned per Nave's direct feedback (2026-09-18): moved from a small inline "ניהול קטגוריות"
// row into a proper "הגדרות צוות" (team settings) entry; further unified the same day with the
// team name/office edit flow that used to live in the global /settings page's admin-teams list
// (now removed). Redesigned a second time the same day (mockup-driven) for visual hierarchy:
// display-first team details and a category grid instead of a "wall of boxes" — see
// TeamDetailsSection / CategoryListSection. Split into this orchestrator (pure composition) +
// useTeamSettingsPanel (state/API, shared verbatim with the web panel) + two presentational
// sections + a shared styles file, per Nave's file-size/style-separation request (2026-09-18).
// Rendered by team-card.tsx for canManageCategories (isAdmin || role === 'TEAM_LEADER', §3.0
// decision #2).
export function TeamSettingsPanelNative({ teamId, token, isTeamAdmin, teamName, teamOffice, onTeamDetailsUpdated }: TeamSettingsPanelNativeProps) {
  const t = useTheme();
  const s = getTeamSettingsPanelStyles(t);
  const p = useTeamSettingsPanel({ teamId, token, teamName, teamOffice, onTeamDetailsUpdated });

  return (
    <View style={s.root}>
      <TouchableOpacity style={s.entryButton} onPress={p.handleToggleExpand}>
        <Icon name="settings" size="sm" />
        <Text style={s.entryButtonText}>
          {p.isExpanded ? Strings.teamSettingsPanel.hideButton : Strings.teamSettingsPanel.showButton}
        </Text>
      </TouchableOpacity>

      {p.isExpanded && (
        <View style={s.panel}>
          {isTeamAdmin && (
            <TeamDetailsSection
              teamName={teamName}
              teamOffice={teamOffice}
              isEditing={p.isEditingDetails}
              nameDraft={p.nameDraft}
              onNameDraftChange={p.setNameDraft}
              officeDraft={p.officeDraft}
              onOfficeDraftChange={p.setOfficeDraft}
              isSaving={p.isSavingDetails}
              message={p.detailsMessage}
              onStartEdit={p.handleStartEditDetails}
              onCancelEdit={p.handleCancelEditDetails}
              onSave={p.handleSaveTeamDetails}
            />
          )}

          <CategoryListSection
            teamId={teamId}
            categories={p.categories}
            isLoading={p.isLoading}
            error={p.error}
            onToggleEnabled={p.handleToggleEnabled}
            togglingId={p.togglingId}
            sprints={p.sprints}
            selectedSprintIds={p.selectedSprintIds}
            sprintFilterLabel={p.sprintFilterLabel}
            isSprintFilterOpen={p.isSprintFilterOpen}
            onSetSprintFilterOpen={p.setIsSprintFilterOpen}
            onToggleSprintSelected={p.handleToggleSprintSelected}
            showCreateForm={p.showCreateForm}
            onShowCreateForm={() => p.setShowCreateForm(true)}
            onHideCreateForm={() => p.setShowCreateForm(false)}
            newLabel={p.newLabel}
            onNewLabelChange={p.setNewLabel}
            isCreating={p.isCreating}
            createError={p.createError}
            onCreateCategory={p.handleCreateCategory}
          />
        </View>
      )}
    </View>
  );
}
