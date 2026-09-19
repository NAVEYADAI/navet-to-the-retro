import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Icon } from '@/components/ui';
import { getTeamSettingsPanelStyles } from './team-settings-panel.styles';

interface TeamDetailsSectionProps {
  teamName: string;
  teamOffice: string | null | undefined;
  isEditing: boolean;
  nameDraft: string;
  onNameDraftChange: (v: string) => void;
  officeDraft: string;
  onOfficeDraftChange: (v: string) => void;
  isSaving: boolean;
  message: { text: string; isError: boolean } | null;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
}

/** Display-first team-details block: read-only text + "ערוך", editable only on explicit intent. */
export function TeamDetailsSection({
  teamName,
  teamOffice,
  isEditing,
  nameDraft,
  onNameDraftChange,
  officeDraft,
  onOfficeDraftChange,
  isSaving,
  message,
  onStartEdit,
  onCancelEdit,
  onSave,
}: TeamDetailsSectionProps) {
  const t = useTheme();
  const s = getTeamSettingsPanelStyles(t);

  return (
    <View style={s.detailsSection}>
      <Text style={s.sectionLabel}>{Strings.teamSettingsPanel.teamDetailsSectionTitle}</Text>

      {!!message && (
        <View style={s.detailsMessage(message.isError)}>
          <Text style={s.detailsMessageText(message.isError)}>{message.text}</Text>
        </View>
      )}

      {isEditing ? (
        <View style={s.detailsEditCard}>
          <Text style={s.fieldLabel}>{Strings.teamSettingsPanel.teamNameLabel}</Text>
          <TextInput
            style={s.input}
            placeholder={Strings.teamSettingsPanel.teamNamePlaceholder}
            placeholderTextColor={t.color.textSecondary}
            value={nameDraft}
            onChangeText={onNameDraftChange}
          />
          <Text style={s.fieldLabel}>{Strings.teamSettingsPanel.teamOfficeLabel}</Text>
          <TextInput
            style={s.input}
            placeholder={Strings.teamSettingsPanel.teamOfficePlaceholder}
            placeholderTextColor={t.color.textSecondary}
            value={officeDraft}
            onChangeText={onOfficeDraftChange}
          />
          <View style={s.detailsButtonsRow}>
            <TouchableOpacity style={s.primaryButton} onPress={onSave} disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator size="small" color={t.color.accent.onBase} />
              ) : (
                <Text style={s.primaryButtonText}>{Strings.teamSettingsPanel.saveTeamDetailsButton}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={s.secondaryButton} onPress={onCancelEdit} disabled={isSaving}>
              <Text style={s.secondaryButtonText}>{Strings.teamList.cancelButton}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={s.detailsDisplayCard}>
          <View style={s.detailsNameColumn}>
            <Text style={s.detailsName}>{teamName}</Text>
            {!!teamOffice && (
              <View style={s.detailsOfficeRow}>
                <Icon name="map-pin" size="sm" tone="muted" />
                <Text style={s.detailsOfficeText}>{teamOffice}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity style={s.editTrigger} onPress={onStartEdit}>
            <Icon name="edit" size="sm" tone="muted" />
            <Text style={s.editTriggerText}>{Strings.teamSettingsPanel.editTeamDetailsButton}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
