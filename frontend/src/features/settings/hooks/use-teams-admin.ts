import { useState } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { trackEvent } from '@/lib/analytics';

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
    } catch (err: any) {
      setTeamMessage({
        text: err.response?.data?.message || err.message || 'שגיאה ביצירת הצוות.',
        isError: true,
      });
      throw err;
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
