import React from 'react';
import { Box, Typography, Alert } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Button, Field, Icon } from '@/components/ui';
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
    <Box sx={s.detailsSection}>
      <Typography sx={s.sectionLabel}>{Strings.teamSettingsPanel.teamDetailsSectionTitle}</Typography>

      {message && (
        <Alert severity={message.isError ? 'error' : 'success'} sx={{ ...t.type.body }}>
          {message.text}
        </Alert>
      )}

      {isEditing ? (
        <Box sx={s.detailsEditCard}>
          <Field
            label={Strings.teamSettingsPanel.teamNameLabel}
            placeholder={Strings.teamSettingsPanel.teamNamePlaceholder}
            value={nameDraft}
            onChangeText={onNameDraftChange}
          />
          <Field
            label={Strings.teamSettingsPanel.teamOfficeLabel}
            placeholder={Strings.teamSettingsPanel.teamOfficePlaceholder}
            value={officeDraft}
            onChangeText={onOfficeDraftChange}
          />
          <Box sx={s.detailsButtonsRow}>
            <Button variant="primary" size="sm" onPress={onSave} disabled={isSaving} loading={isSaving}>
              {Strings.teamSettingsPanel.saveTeamDetailsButton}
            </Button>
            <Button variant="secondary" size="sm" onPress={onCancelEdit} disabled={isSaving}>
              {Strings.teamList.cancelButton}
            </Button>
          </Box>
        </Box>
      ) : (
        <Box sx={s.detailsDisplayCard}>
          <Box sx={s.detailsNameColumn}>
            <Typography sx={s.detailsName}>{teamName}</Typography>
            {!!teamOffice && (
              <Box sx={s.detailsOfficeRow}>
                <Icon name="map-pin" size="sm" tone="muted" />
                <Typography sx={s.detailsOfficeText}>{teamOffice}</Typography>
              </Box>
            )}
          </Box>
          <Button variant="ghost" size="sm" icon="edit" onPress={onStartEdit}>
            {Strings.teamSettingsPanel.editTeamDetailsButton}
          </Button>
        </Box>
      )}
    </Box>
  );
}
