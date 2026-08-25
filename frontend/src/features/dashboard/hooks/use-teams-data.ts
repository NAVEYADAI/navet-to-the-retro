import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useFocusEffect } from 'expo-router';
import { getBackendUrl } from '@/api/config';

// Shared between the web and native Dashboard variants: fetches the current user's teams,
// refetching on mount and whenever the screen regains focus (see [[feedback-frontend-data-freshness]]
// memory — other screens like Settings can mutate this same data).
export function useTeamsData(token: string | null | undefined) {
  const [teams, setTeams] = useState<any[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);

  const fetchMyTeams = useCallback(async (authToken: string) => {
    setIsLoadingTeams(true);
    try {
      const response = await axios.get(`${getBackendUrl()}/teams/user/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      const data = response.data;
      setTeams(data);

      setSelectedTeam((prev: any) => {
        if (!prev) return prev;
        const updated = data.find((t: any) => t.id === prev.id);
        return updated || prev;
      });
    } catch (err) {
      console.error('Failed to fetch teams:', err);
    } finally {
      setIsLoadingTeams(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchMyTeams(token);
    }
  }, [token, fetchMyTeams]);

  useFocusEffect(
    useCallback(() => {
      if (token) {
        fetchMyTeams(token);
      }
    }, [token, fetchMyTeams])
  );

  return { teams, isLoadingTeams, selectedTeam, setSelectedTeam, fetchMyTeams };
}
