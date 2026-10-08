import { useState } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { trackEvent } from '@/lib/analytics';
import { getTeamCreateErrorMessage } from '@/features/teams/team-create-error';
import { notifyTeamsChanged } from '@/features/dashboard/teams-changed-signal';

// The create-team flow for the global /settings page. Editing an EXISTING team's own details
// (name/office) used to live here too via an admin-teams list, but that duplicated the per-team
// "הגדרות צוות" panel on the dashboard (team-settings-panel.tsx) — removed 2026-09-18 per Nave's
// feedback in favor of that single per-team entry point.
export function useTeamsAdmin(token: string | null | undefined) {
  const [teamCreateLoading, setTeamCreateLoading] = useState(false);
  const [teamMessage, setTeamMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const handleCreateTeamSubmit = async (name: string, mainOffice: string, approverEmail: string) => {
    setTeamMessage(null);
    setTeamCreateLoading(true);
    try {
      await axios.post(
        `${getBackendUrl()}/teams`,
        {
          name: name,
          mainOffice: mainOffice,
          approverEmail: approverEmail,
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      setTeamMessage({ text: `הצוות "${name}" ממתין לאישור של ${approverEmail}.`, isError: false });
      trackEvent('team_created');
      // The dashboard stays mounted behind /settings and only fetches on mount — tell it to refetch
      // so the new team shows up without a manual refresh (BUG-29).
      notifyTeamsChanged();
    } catch (err: any) {
      // Not stored in `teamMessage`: CreateTeamForm already shows the thrown message inline, and
      // setting it here too rendered the error twice (BUG-56). Throw a ready Hebrew message.
      throw new Error(getTeamCreateErrorMessage(err));
    } finally {
      setTeamCreateLoading(false);
    }
  };

  return {
    teamCreateLoading,
    teamMessage,
    handleCreateTeamSubmit,
  };
}
