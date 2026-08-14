import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SprintRetroBoard } from '../sprint-retro-board';
import { Strings } from '../../constants/strings';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock Animated.timing to execute callback synchronously in Jest
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.Animated.timing = (value: any, config: any) => ({
    start: (callback?: () => void) => {
      if (callback) callback();
    },
  });
  RN.Animated.spring = (value: any, config: any) => ({
    start: (callback?: () => void) => {
      if (callback) callback();
    },
  });
  return RN;
});

describe('SprintRetroBoard Component', () => {
  const mockSprint = {
    id: 5,
    name: 'Sprint 5',
    startDate: '2026-08-01',
    endDate: '2026-08-15',
    description: 'Sprint 5 retro description',
  };
  const mockTeam = {
    id: 1,
    name: 'Core Team',
    members: [{ userId: 12, isAdmin: true }],
  };
  const mockToken = 'mock-token';
  const mockUser = { id: 12, username: 'adminuser' };
  const mockTheme = {
    text: '#000',
    background: '#fff',
    backgroundElement: '#eee',
    backgroundSelected: '#ddd',
    textSecondary: '#666',
  };

  const mockComments = [
    {
      id: 101,
      content: 'Great velocity this sprint!',
      type: 'KEEP',
      isAnonymous: false,
      createdAt: '2026-08-04T12:00:00.000Z',
      author: { username: 'dev1' },
    },
    {
      id: 102,
      content: 'Too many meetings.',
      type: 'IMPROVE',
      isAnonymous: true,
      createdAt: '2026-08-04T13:00:00.000Z',
      author: { username: 'dev2' },
    },
  ];

  beforeEach(() => {
    mockedAxios.get.mockResolvedValue({ data: mockComments });
    mockedAxios.post.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders retro board header details correctly', async () => {
    const mockBack = jest.fn();
    const { getByText, findByText } = await render(
      <SprintRetroBoard
        sprint={mockSprint}
        team={mockTeam}
        token={mockToken}
        user={mockUser}
        theme={mockTheme}
        onBack={mockBack}
      />
    );

    expect(getByText(Strings.retroBoard.backButton)).toBeTruthy();
    expect(getByText('Sprint 5')).toBeTruthy();
    expect(getByText('Sprint 5 retro description')).toBeTruthy();
    expect(await findByText('Great velocity this sprint!')).toBeTruthy();
  });

  it('displays comments in respective columns', async () => {
    const mockBack = jest.fn();
    const { findByText, getByText } = await render(
      <SprintRetroBoard
        sprint={mockSprint}
        team={mockTeam}
        token={mockToken}
        user={mockUser}
        theme={mockTheme}
        onBack={mockBack}
      />
    );

    expect(await findByText('Great velocity this sprint!')).toBeTruthy();
    expect(await findByText('Too many meetings.')).toBeTruthy();

    expect(getByText('@dev1')).toBeTruthy();
  });

  it('toggles note type when clicking the Yin-Yang wheel', async () => {
    const mockBack = jest.fn();
    const { getByText, findByText } = await render(
      <SprintRetroBoard
        sprint={mockSprint}
        team={mockTeam}
        token={mockToken}
        user={mockUser}
        theme={mockTheme}
        onBack={mockBack}
      />
    );

    // Wait for comments to load so that initial mount state updates settle
    expect(await findByText('Great velocity this sprint!')).toBeTruthy();

    // Initial state: Keep
    expect(getByText(Strings.retroBoard.keepLabel)).toBeTruthy();

    // Find the thumb-up icon representing the Keep side of the wheel and click it
    const toggleArea = getByText('👍');
    fireEvent.press(toggleArea);

    expect(await findByText(Strings.retroBoard.improveLabel)).toBeTruthy();
  });

  it('submits a new note successfully via API', async () => {
    const mockBack = jest.fn();

    const { getByPlaceholderText, getByText, findByText } = await render(
      <SprintRetroBoard
        sprint={mockSprint}
        team={mockTeam}
        token={mockToken}
        user={mockUser}
        theme={mockTheme}
        onBack={mockBack}
      />
    );

    // Wait for comments to load so that initial mount state updates settle
    expect(await findByText('Great velocity this sprint!')).toBeTruthy();

    const input = getByPlaceholderText('מה עבד טוב? ציין הישגים...');
    const submitBtn = getByText(Strings.retroBoard.postNoteButton);

    fireEvent.changeText(input, 'Working together was smooth.');
    await waitFor(() => {
      expect(input.props.value).toBe('Working together was smooth.');
    });

    fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/sprints/5/comments'),
        {
          content: 'Working together was smooth.',
          type: 'KEEP',
          isAnonymous: false,
        },
        expect.objectContaining({
          headers: { Authorization: 'Bearer mock-token' },
        })
      );
    });
  });
});
