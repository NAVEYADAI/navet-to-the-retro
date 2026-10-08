import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import axios from 'axios';
import { TeamSettingsPanelNative } from '../team-settings-panel';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';

jest.mock('axios');
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedTrackEvent = trackEvent as jest.Mock;

// Feature 3 (team comment categories, product-backlog/03-team-comment-categories.md §3.2) —
// admin/TEAM_LEADER-only panel: fetch-on-expand (not on mount), create a custom category, and
// toggle isEnabled on an existing one, each firing the trackEvent call §3.2 calls for. Also covers
// the team-details (name/office) section unified into this same panel on 2026-09-18 — admin-only,
// separate from the categories section which team leaders can also manage.
describe('TeamSettingsPanelNative', () => {
  const teamId = 1;
  const token = 'mock-token';

  const defaultCategory = {
    id: 10, teamId, label: 'פלנינג', isDefault: true, isEnabled: true, createdById: null, createdAt: '2026-01-01',
  };
  const customCategory = {
    id: 20, teamId, label: 'תיאום בין צוותים', isDefault: false, isEnabled: false, createdById: 5, createdAt: '2026-01-02',
  };

  const defaultProps = {
    teamId,
    token,
    isTeamAdmin: true,
    teamName: 'צוות הליבה',
    teamOffice: 'תל אביב',
    onTeamDetailsUpdated: jest.fn(),
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('fetches and renders categories (with default/custom badges) on mount (the card mounts it when the gear opens), and tracks the open', async () => {
    mockedAxios.get.mockResolvedValue({ data: [defaultCategory, customCategory] });

    const { getByText } = await render(<TeamSettingsPanelNative {...defaultProps} />);

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining(`/teams/${teamId}/categories`),
        expect.objectContaining({ headers: { Authorization: `Bearer ${token}` } })
      );
    });

    expect(mockedTrackEvent).toHaveBeenCalledWith('category_management_opened', { teamId });
    expect(await getByText(defaultCategory.label)).toBeTruthy();
    expect(await getByText(customCategory.label)).toBeTruthy();
    expect(await getByText(Strings.categoryManagement.defaultBadge)).toBeTruthy();
    expect(await getByText(Strings.categoryManagement.customBadge)).toBeTruthy();
  });

  it('shows a validation error and never calls the API when creating with an empty label', async () => {
    mockedAxios.get.mockResolvedValue({ data: [] });

    const { getByText } = await render(<TeamSettingsPanelNative {...defaultProps} />);
    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalled());

    await fireEvent.press(getByText(Strings.categoryManagement.createButton));
    await fireEvent.press(getByText(Strings.categoryManagement.createButton));

    expect(await getByText(Strings.categoryManagement.labelRequiredError)).toBeTruthy();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('creates a custom category, tracks it, and refetches the list', async () => {
    mockedAxios.get.mockResolvedValue({ data: [defaultCategory] });
    mockedAxios.post.mockResolvedValue({ data: { ...customCategory, isEnabled: true } });

    const { getByText, getByPlaceholderText } = await render(<TeamSettingsPanelNative {...defaultProps} />);
    // Expanding now fires two GETs — the sprint list (for the usage-count filter) plus categories.
    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalledTimes(2));

    await fireEvent.press(getByText(Strings.categoryManagement.createButton));
    await fireEvent.changeText(getByPlaceholderText(Strings.categoryManagement.newCategoryPlaceholder), '  תיאום בין צוותים  ');
    await fireEvent.press(getByText(Strings.categoryManagement.createButton));

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining(`/teams/${teamId}/categories`),
        { label: 'תיאום בין צוותים' },
        expect.objectContaining({ headers: { Authorization: `Bearer ${token}` } })
      );
    });
    expect(mockedTrackEvent).toHaveBeenCalledWith('team_category_created', { teamId });
    // Re-fetched after a successful create (fetchCategories() called again) — 2 from the
    // initial expand (sprints + categories) plus 1 more for the post-create refetch.
    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalledTimes(3));
  });

  it('toggles isEnabled via the switch, PATCHes the new value, and tracks it', async () => {
    mockedAxios.get.mockResolvedValue({ data: [defaultCategory] });
    mockedAxios.patch.mockResolvedValue({ data: { ...defaultCategory, isEnabled: false } });

    const { getByText, getAllByRole } = await render(<TeamSettingsPanelNative {...defaultProps} />);
    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalled());

    const [switchEl] = getAllByRole('switch');
    expect(switchEl.props.value).toBe(true);
    await fireEvent(switchEl, 'valueChange', false);

    expect(mockedTrackEvent).toHaveBeenCalledWith('team_category_toggled', { teamId, categoryId: defaultCategory.id, isEnabled: false });
    await waitFor(() => {
      expect(mockedAxios.patch).toHaveBeenCalledWith(
        expect.stringContaining(`/teams/${teamId}/categories/${defaultCategory.id}`),
        { isEnabled: false },
        expect.objectContaining({ headers: { Authorization: `Bearer ${token}` } })
      );
    });
  });

  it('rolls back the optimistic toggle if the PATCH fails', async () => {
    mockedAxios.get.mockResolvedValue({ data: [defaultCategory] });
    mockedAxios.patch.mockRejectedValue(new Error('network error'));

    const { getByText, getAllByRole } = await render(<TeamSettingsPanelNative {...defaultProps} />);
    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalled());

    const [switchEl] = getAllByRole('switch');
    await fireEvent(switchEl, 'valueChange', false);

    await waitFor(() => expect(mockedAxios.patch).toHaveBeenCalled());
    await waitFor(() => {
      const [switchAfter] = getAllByRole('switch');
      expect(switchAfter.props.value).toBe(true);
    });
  });

  it('lets a team admin edit and save the team name/office, and tracks it', async () => {
    mockedAxios.get.mockResolvedValue({ data: [] });
    mockedAxios.patch.mockResolvedValue({ data: {} });

    const onTeamDetailsUpdated = jest.fn();
    const { getByText, getByDisplayValue } = await render(
      <TeamSettingsPanelNative {...defaultProps} onTeamDetailsUpdated={onTeamDetailsUpdated} />
    );
    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalled());

    expect(await getByText(Strings.teamSettingsPanel.teamDetailsSectionTitle)).toBeTruthy();
    await fireEvent.press(getByText(Strings.teamSettingsPanel.editTeamDetailsButton));
    await fireEvent.changeText(getByDisplayValue(defaultProps.teamName), 'צוות חדש');
    await fireEvent.press(getByText(Strings.teamSettingsPanel.saveTeamDetailsButton));

    await waitFor(() => {
      expect(mockedAxios.patch).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`/teams/${teamId}$`)),
        { name: 'צוות חדש', mainOffice: defaultProps.teamOffice },
        expect.objectContaining({ headers: { Authorization: `Bearer ${token}` } })
      );
    });
    expect(mockedTrackEvent).toHaveBeenCalledWith('team_details_updated', { teamId });
    expect(onTeamDetailsUpdated).toHaveBeenCalled();
  });

  it('shows team name/office as read-only text until the admin taps ערוך', async () => {
    mockedAxios.get.mockResolvedValue({ data: [] });

    const { getByText, getByDisplayValue, queryByDisplayValue } = await render(
      <TeamSettingsPanelNative {...defaultProps} />
    );
    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalled());

    expect(await getByText(defaultProps.teamName)).toBeTruthy();
    expect(await getByText(defaultProps.teamOffice)).toBeTruthy();
    expect(queryByDisplayValue(defaultProps.teamName)).toBeNull();

    await fireEvent.press(getByText(Strings.teamSettingsPanel.editTeamDetailsButton));
    expect(await getByDisplayValue(defaultProps.teamName)).toBeTruthy();
  });

  it('does not render the team-details section for a non-admin (team leader)', async () => {
    mockedAxios.get.mockResolvedValue({ data: [] });

    const { getByText, queryByText } = await render(
      <TeamSettingsPanelNative {...defaultProps} isTeamAdmin={false} />
    );
    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalled());

    expect(queryByText(Strings.teamSettingsPanel.teamDetailsSectionTitle)).toBeNull();
  });
});
