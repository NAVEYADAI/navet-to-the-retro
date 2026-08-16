import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { act } from 'react-test-renderer';
import { CreateTeamForm } from '../create-team-form';
import { Strings } from '../../constants/strings';

describe('CreateTeamForm Component', () => {
  const mockTheme = {
    text: '#000',
    background: '#fff',
    backgroundElement: '#eee',
    backgroundSelected: '#ddd',
    textSecondary: '#666',
  };

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
    fireEvent.press(closeBtn);

    expect(mockCancel).toHaveBeenCalledTimes(1);
  });

  it('validates required name field before submitting', async () => {
    const mockSubmit = jest.fn();
    const { getByText, findByText } = await render(
      <CreateTeamForm onSubmit={mockSubmit} isLoading={false} theme={mockTheme} />
    );

    const submitBtn = getByText('צור צוות (ראש צוות)');
    fireEvent.press(submitBtn);

    expect(mockSubmit).not.toHaveBeenCalled();
    expect(await findByText('שם הצוות שדה חובה.')).toBeTruthy();
  });

  it('calls onSubmit with typed values on submit', async () => {
    const mockSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByPlaceholderText, getByText } = await render(
      <CreateTeamForm onSubmit={mockSubmit} isLoading={false} theme={mockTheme} />
    );

    const nameInput = getByPlaceholderText('שם הצוות (למשל R&D Core)');
    const officeInput = getByPlaceholderText('משרד ראשי / מטה (אופציונלי)');
    const submitBtn = getByText('צור צוות (ראש צוות)');

    fireEvent.changeText(nameInput, 'Core Team');
    await waitFor(() => {
      expect(nameInput.props.value).toBe('Core Team');
    });

    fireEvent.changeText(officeInput, 'Haifa Office');
    await waitFor(() => {
      expect(officeInput.props.value).toBe('Haifa Office');
    });

    // Wrapping in act() flushes the async onSubmit handler (and the state reset that
    // follows it) inside the act scope, instead of leaving it to resolve on a stray microtask.
    await act(async () => {
      fireEvent.press(submitBtn);
    });

    expect(mockSubmit).toHaveBeenCalledWith('Core Team', 'Haifa Office');
    expect(nameInput.props.value).toBe('');
  });
});
