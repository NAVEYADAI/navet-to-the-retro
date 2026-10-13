import { useState } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';
import { getSuccessorOptions, isLastActiveAdmin, isLastActiveLeader, isLastRealMember } from '../membership-rules';

interface UseLeaveTeamArgs {
  teamId: number;
  members: any[];
  me: any;
  token: string;
  onLeft: () => void;
}

/**
 * Feature 11 §11.2 — state + API for "יציאה מהצוות", shared by web and native. The last active
 * admin must pick a successor (decision #2); an admin who is also the last team leader may name
 * the next one (decision #3); the last real member can't leave at all (decision #8).
 */
export function useLeaveTeam({ teamId, members, me, token, onLeft }: UseLeaveTeamArgs) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [successorId, setSuccessorId] = useState<string | null>(null);
  const [newLeaderId, setNewLeaderId] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastRealMember = isLastRealMember(members, me);
  const needsSuccessor = isLastActiveAdmin(members, me);
  const canNameNewLeader = !!me.isAdmin && isLastActiveLeader(members, me);
  const candidates = getSuccessorOptions(members, me);
  const canConfirm = !lastRealMember && (!needsSuccessor || !!successorId) && !isLeaving;

  const open = () => {
    trackEvent('team_leave_clicked', { teamId });
    setError(null);
    setSuccessorId(null);
    setNewLeaderId(null);
    setIsConfirming(true);
  };

  const cancel = () => {
    trackEvent('team_leave_cancelled', { teamId });
    setIsConfirming(false);
  };

  const selectSuccessor = (id: string) => {
    trackEvent('team_leave_successor_selected', { teamId });
    setSuccessorId(id);
  };

  // Tapping the selected option again clears it — naming a new team leader is optional.
  const selectNewLeader = (id: string) => {
    trackEvent('team_leave_new_leader_selected', { teamId, cleared: newLeaderId === id });
    setNewLeaderId(newLeaderId === id ? null : id);
  };

  const confirm = async () => {
    if (!canConfirm) return;
    trackEvent('team_leave_confirmed', { teamId });
    setError(null);
    setIsLeaving(true);
    try {
      await axios.post(`${getBackendUrl()}/teams/${teamId}/leave`, {
        ...(needsSuccessor && successorId ? { successorAdminMemberId: Number(successorId) } : {}),
        ...(canNameNewLeader && newLeaderId ? { newLeaderMemberId: Number(newLeaderId) } : {}),
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setIsConfirming(false);
      onLeft();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || Strings.teamList.leaveFailedError);
    } finally {
      setIsLeaving(false);
    }
  };

  return {
    isConfirming, open, cancel, confirm, canConfirm, isLeaving, error,
    lastRealMember, needsSuccessor, canNameNewLeader, candidates,
    successorId, selectSuccessor, newLeaderId, selectNewLeader,
  };
}

export type LeaveTeamState = ReturnType<typeof useLeaveTeam>;
