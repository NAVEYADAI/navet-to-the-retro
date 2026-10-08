import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { getBackendUrl } from '@/api/config';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';
import type { TeamCategory, TeamSprintOption } from '@/features/teams/types';

interface Params {
  teamId: number;
  token: string;
  teamName: string;
  teamOffice: string | null | undefined;
  onTeamDetailsUpdated: () => void;
}

/** All state + API calls for the team-settings panel — shared verbatim by both the web (MUI) and
 * native (React Native) panels, since none of this logic is platform-specific; only the two
 * platforms' presentational section components differ. */
export function useTeamSettingsPanel({ teamId, token, teamName, teamOffice, onTeamDetailsUpdated }: Params) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [categories, setCategories] = useState<TeamCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [nameDraft, setNameDraft] = useState(teamName);
  const [officeDraft, setOfficeDraft] = useState(teamOffice || '');
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [detailsMessage, setDetailsMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const [sprints, setSprints] = useState<TeamSprintOption[]>([]);
  // null until sprints have loaded once — then defaults to "all sprint ids", per Nave's spec
  // ("checkbox list of every sprint, all checked by default").
  const [selectedSprintIds, setSelectedSprintIds] = useState<number[] | null>(null);
  const [isSprintFilterOpen, setIsSprintFilterOpen] = useState(false);

  // Mirrors selectedSprintIds so toggle handlers read the latest selection without doing a side
  // effect (a fetch) inside a setState updater — updaters may run twice, which doubled the request.
  const selectedSprintIdsRef = useRef<number[] | null>(null);
  // Monotonic request id: a response is applied only if it belongs to the latest request, so rapid
  // checkbox toggles can't let a slower, older response overwrite a newer one (BUG-55 race).
  const categoriesRequestRef = useRef(0);

  // `sprintIds` null = no sprint scoping (counts span every sprint). An EMPTY array means the user
  // unchecked every sprint: the backend treats an empty `sprintIds` param as "no filter" and would
  // return counts for all sprints, so we ask without the param and zero the counts locally (BUG-55).
  const fetchCategories = useCallback(async (sprintIds: number[] | null) => {
    const requestId = ++categoriesRequestRef.current;
    const noneSelected = sprintIds !== null && sprintIds.length === 0;
    setIsLoading(true);
    setError(null);
    try {
      // No enabledOnly query param — the management panel needs disabled categories too, so an
      // admin/TEAM_LEADER can re-enable them (team-categories.service.ts::listCategories default).
      const response = await axios.get(`${getBackendUrl()}/teams/${teamId}/categories`, {
        params: sprintIds && sprintIds.length > 0 ? { sprintIds: sprintIds.join(',') } : undefined,
        headers: { Authorization: `Bearer ${token}` }
      });
      if (requestId !== categoriesRequestRef.current) return;
      setCategories(noneSelected ? response.data.map((c: TeamCategory) => ({ ...c, commentCount: 0 })) : response.data);
    } catch (err: any) {
      if (requestId !== categoriesRequestRef.current) return;
      setError(err.response?.data?.message || err.message || Strings.categoryManagement.loadErrorText);
    } finally {
      if (requestId === categoriesRequestRef.current) setIsLoading(false);
    }
  }, [teamId, token]);

  useEffect(() => {
    if (!isExpanded) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await axios.get(`${getBackendUrl()}/teams/${teamId}/sprints`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (cancelled) return;
        const options: TeamSprintOption[] = response.data.map((sp: any) => ({ id: sp.id, name: sp.name }));
        setSprints(options);
        const allIds = options.map((sp) => sp.id);
        selectedSprintIdsRef.current = allIds;
        setSelectedSprintIds(allIds);
        await fetchCategories(allIds);
      } catch (err) {
        console.error('Failed to fetch team sprints:', err);
      }
    })();
    return () => { cancelled = true; };
    // Deliberately only on open — re-opening always resets to "all sprints" (matches spec's
    // stated default), not whatever filter was left selected last time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded, teamId, token]);

  const handleToggleExpand = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      if (next) {
        trackEvent('category_management_opened', { teamId });
        // Reset drafts to the latest known team details every time the panel (re)opens, not
        // whatever was left typed last time. Also always re-open in display mode, never mid-edit.
        setNameDraft(teamName);
        setOfficeDraft(teamOffice || '');
        setDetailsMessage(null);
        setIsEditingDetails(false);
      }
      return next;
    });
  };

  const handleStartEditDetails = () => {
    setNameDraft(teamName);
    setOfficeDraft(teamOffice || '');
    setDetailsMessage(null);
    setIsEditingDetails(true);
  };

  const handleCancelEditDetails = () => {
    setNameDraft(teamName);
    setOfficeDraft(teamOffice || '');
    setDetailsMessage(null);
    setIsEditingDetails(false);
  };

  const handleSaveTeamDetails = async () => {
    setDetailsMessage(null);
    if (!nameDraft.trim()) {
      setDetailsMessage({ text: Strings.teamSettingsPanel.teamNameRequiredError, isError: true });
      return;
    }
    setIsSavingDetails(true);
    try {
      await axios.patch(`${getBackendUrl()}/teams/${teamId}`, {
        name: nameDraft.trim(),
        mainOffice: officeDraft.trim(),
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      trackEvent('team_details_updated', { teamId });
      onTeamDetailsUpdated();
      // Back to the display view — the fresh name/office arrive as props once the parent's
      // refetch (onTeamDetailsUpdated) resolves.
      setIsEditingDetails(false);
    } catch (err: any) {
      setDetailsMessage({
        text: err.response?.data?.message || err.message || Strings.teamSettingsPanel.teamDetailsUpdateErrorText,
        isError: true,
      });
    } finally {
      setIsSavingDetails(false);
    }
  };

  const handleCreateCategory = async () => {
    setCreateError(null);
    if (!newLabel.trim()) {
      setCreateError(Strings.categoryManagement.labelRequiredError);
      return;
    }
    setIsCreating(true);
    try {
      await axios.post(`${getBackendUrl()}/teams/${teamId}/categories`, { label: newLabel.trim() }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewLabel('');
      setShowCreateForm(false);
      trackEvent('team_category_created', { teamId });
      fetchCategories(selectedSprintIdsRef.current);
    } catch (err: any) {
      setCreateError(err.response?.data?.message || err.message || Strings.categoryManagement.createErrorText);
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleEnabled = async (category: TeamCategory) => {
    const nextValue = !category.isEnabled;
    setCategories((prev) => prev.map((c) => (c.id === category.id ? { ...c, isEnabled: nextValue } : c)));
    setTogglingId(category.id);
    trackEvent('team_category_toggled', { teamId, categoryId: category.id, isEnabled: nextValue });
    try {
      await axios.patch(`${getBackendUrl()}/teams/${teamId}/categories/${category.id}`, { isEnabled: nextValue }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      console.error('Failed to update category:', err);
      setCategories((prev) => prev.map((c) => (c.id === category.id ? { ...c, isEnabled: !nextValue } : c)));
    } finally {
      setTogglingId(null);
    }
  };

  const handleToggleSprintSelected = (sprintId: number) => {
    const current = selectedSprintIdsRef.current ?? [];
    const next = current.includes(sprintId) ? current.filter((id) => id !== sprintId) : [...current, sprintId];
    selectedSprintIdsRef.current = next;
    setSelectedSprintIds(next);
    fetchCategories(next);
  };

  const sprintFilterLabel = selectedSprintIds === null || selectedSprintIds.length === sprints.length
    ? Strings.categoryManagement.sprintFilterAllLabel
    : Strings.categoryManagement.sprintFilterSelectedLabel(selectedSprintIds.length, sprints.length);

  return {
    isExpanded,
    handleToggleExpand,

    categories,
    isLoading,
    error,
    togglingId,
    handleToggleEnabled,

    isEditingDetails,
    nameDraft,
    setNameDraft,
    officeDraft,
    setOfficeDraft,
    isSavingDetails,
    detailsMessage,
    handleStartEditDetails,
    handleCancelEditDetails,
    handleSaveTeamDetails,

    showCreateForm,
    setShowCreateForm,
    newLabel,
    setNewLabel,
    isCreating,
    createError,
    handleCreateCategory,

    sprints,
    selectedSprintIds,
    sprintFilterLabel,
    isSprintFilterOpen,
    setIsSprintFilterOpen,
    handleToggleSprintSelected,
  };
}
