import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useFocusEffect } from 'expo-router';
import { getBackendUrl } from '@/api/config';

// Teams this user administers, plus the create/edit-team flows that mutate them.
// Refetches on focus (see [[feedback-frontend-data-freshness]] memory) so changes made
// elsewhere (e.g. accepting a member invite on the Dashboard) show up here too.
export function useTeamsAdmin(token: string | null | undefined, user: any) {
  const [adminTeams, setAdminTeams] = useState<any[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);

  const [teamCreateLoading, setTeamCreateLoading] = useState(false);
  const [teamMessage, setTeamMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const [editTeamId, setEditTeamId] = useState<number | null>(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamOffice, setEditTeamOffice] = useState('');
  const [teamEditLoading, setTeamEditLoading] = useState(false);
  const [teamEditMessage, setTeamEditMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const fetchAdminTeams = useCallback(async () => {
    if (!token || !user) return;
    setLoadingTeams(true);
    try {
      const response = await axios.get(`${getBackendUrl()}/teams/user/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const myAdminTeams = response.data.filter((t: any) =>
        t.members?.some((m: any) => m.userId === user.id && m.isAdmin)
      );
      setAdminTeams(myAdminTeams);
    } catch (err) {
      console.error('Failed to fetch admin teams:', err);
    } finally {
      setLoadingTeams(false);
    }
  }, [token, user]);

  useEffect(() => {
    fetchAdminTeams();
  }, [fetchAdminTeams]);

  useFocusEffect(
    useCallback(() => {
      fetchAdminTeams();
    }, [fetchAdminTeams])
  );

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
      fetchAdminTeams();
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

  const handleSaveTeamEdit = async (teamId: number) => {
    if (!editTeamName.trim()) {
      setTeamEditMessage({ text: 'שם צוות הוא שדה חובה.', isError: true });
      return;
    }
    setTeamEditLoading(true);
    setTeamEditMessage(null);
    try {
      await axios.patch(
        `${getBackendUrl()}/teams/${teamId}`,
        {
          name: editTeamName.trim(),
          mainOffice: editTeamOffice.trim(),
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      setTeamEditMessage({ text: 'פרטי הצוות עודכנו בהצלחה!', isError: false });
      setEditTeamId(null);
      fetchAdminTeams();
    } catch (err: any) {
      setTeamEditMessage({
        text: err.response?.data?.message || err.message || 'שגיאה בעדכון הצוות.',
        isError: true,
      });
    } finally {
      setTeamEditLoading(false);
    }
  };

  return {
    adminTeams,
    loadingTeams,
    teamCreateLoading,
    teamMessage,
    handleCreateTeamSubmit,
    editTeamId, setEditTeamId,
    editTeamName, setEditTeamName,
    editTeamOffice, setEditTeamOffice,
    teamEditLoading,
    teamEditMessage, setTeamEditMessage,
    handleSaveTeamEdit,
  };
}
