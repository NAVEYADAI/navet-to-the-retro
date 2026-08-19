import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import axios from 'axios';
import { CreateTeamForm } from '../create-team-form';
import { Strings } from '../../constants/strings';

jest.mock('@/context/auth-context', () => ({
  useAuth: () => ({ user: { email: 'creator@example.com' }, token: 'mock-token' }),
}));

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockApprovers = [
  { email: 'naveyadai@gmail.com', displayName: 'Nave Yadai' },
  { email: 'lironka13@gmail.com', displayName: null },
];

describe('CreateTeamForm Component', () => {
  const mockTheme = {
    text: '#000',
    background: '#fff',
    backgroundElement: '#eee',
    backgroundSelected: '#ddd',
    textSecondary: '#666',
  };

  beforeEach(() => {
    mockedAxios.get.mockResolvedValue({ data: mockApprovers });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders standard create team form by default', async () => {
    const mockSubmit = jest.fn();
    const { getByText, queryByText } = await render(
      <CreateTeamForm onSubmit={mockSubmit} isLoading={false} theme={mockTheme} />
    );

    expect(getByText(Strings.dashboard.createTeamTitle)).toBeTruthy();
    expect(queryByText(Strings.dashboard.createFirstTeamDesc)).toBeNull();
  });

  it('renders onboarding message when isFirstTeam is true', async () => {
    const mockSubmit = jest.fn();
    const { getByText } = await render(
      <CreateTeamForm onSubmit={mockSubmit} isLoading={false} isFirstTeam={true} theme={mockTheme} />
    );

    expect(getByText(Strings.dashboard.createFirstTeamTitle)).toBeTruthy();
    expect(getByText(Strings.dashboard.createFirstTeamDesc)).toBeTruthy();
  });

  it('calls onCancel when close button is clicked', async () => {
    const mockSubmit = jest.fn();
    const mockCancel = jest.fn();
    const { getByText } = await render(
      <CreateTeamForm onSubmit={mockSubmit} isLoading={false} onCancel={mockCancel} theme={mockTheme} />
    );

    const closeBtn = getByText(Strings.dashboard.closeButton);
    await fireEvent.press(closeBtn);

    expect(mockCancel).toHaveBeenCalledTimes(1);
  });

  it('validates required name field before submitting', async () => {
    const mockSubmit = jest.fn();
    const { getByText, findByText } = await render(
      <CreateTeamForm onSubmit={mockSubmit} isLoading={false} theme={mockTheme} />
    );

    const submitBtn = getByText('צור צוות (ראש צוות)');
    await fireEvent.press(submitBtn);

    expect(mockSubmit).not.toHaveBeenCalled();
    expect(await findByText('שם הצוות שדה חובה.')).toBeTruthy();
  });

  it('validates required approver selection before submitting', async () => {
    const mockSubmit = jest.fn();
    const { getByPlaceholderText, getByText, findByText } = await render(
      <CreateTeamForm onSubmit={mockSubmit} isLoading={false} theme={mockTheme} />
    );

    const nameInput = getByPlaceholderText('שם הצוות (למשל R&D Core)');
    await fireEvent.changeText(nameInput, 'Core Team');
    await waitFor(() => {
      expect(nameInput.props.value).toBe('Core Team');
    });

    // Wait for the approver list to finish loading before submitting without a selection.
    await findByText('Nave Yadai');

    const submitBtn = getByText('צור צוות (ראש צוות)');
    await fireEvent.press(submitBtn);

    expect(mockSubmit).not.toHaveBeenCalled();
    expect(await findByText(Strings.dashboard.approverEmailRequiredError)).toBeTruthy();
  });

  it('fetches the allowed-approvers list and calls onSubmit with the selected approver on submit', async () => {
    const mockSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByPlaceholderText, getByText, findByText } = await render(
      <CreateTeamForm onSubmit={mockSubmit} isLoading={false} theme={mockTheme} />
    );

    // Let the allowed-approvers fetch resolve fully before driving any further interaction,
    // so its state updates don't land concurrently with the fireEvent calls below.
    const approverChip = await findByText('Nave Yadai');

    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('/teams/allowed-approvers'),
      expect.objectContaining({ headers: { Authorization: 'Bearer mock-token' } })
    );

    const nameInput = getByPlaceholderText('שם הצוות (למשל R&D Core)');
    const officeInput = getByPlaceholderText('משרד ראשי / מטה (אופציונלי)');
    const submitBtn = getByText('צור צוות (ראש צוות)');

    await fireEvent.changeText(nameInput, 'Core Team');
    await waitFor(() => {
      expect(nameInput.props.value).toBe('Core Team');
    });

    await fireEvent.changeText(officeInput, 'Haifa Office');
    await waitFor(() => {
      expect(officeInput.props.value).toBe('Haifa Office');
    });

    await fireEvent.press(approverChip);
    await fireEvent.press(submitBtn);

    expect(mockSubmit).toHaveBeenCalledWith('Core Team', 'Haifa Office', 'naveyadai@gmail.com');
    expect(nameInput.props.value).toBe('');
  });

  it('shows a load error if the allowed-approvers request fails', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('network down'));
    const mockSubmit = jest.fn();
    const { findByText } = await render(
      <CreateTeamForm onSubmit={mockSubmit} isLoading={false} theme={mockTheme} />
    );

    expect(await findByText(Strings.dashboard.approverListLoadError)).toBeTruthy();
  });
});
