import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { TeamSprintsManager } from '../team-sprints-manager';
import { Strings } from '../../constants/strings';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TeamSprintsManager Component', () => {
  const mockTeam = { id: 10, name: 'Core Team' };
  const mockToken = 'mock-token';
  const mockTheme = {
    text: '#000',
    background: '#fff',
    backgroundElement: '#eee',
    backgroundSelected: '#ddd',
    textSecondary: '#666',
  };

  const activeStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const activeEnd = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const futureStart = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
  const futureEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
  const pastStart = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const pastEnd = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

  const mockSprints = [
    {
      id: 1,
      name: 'Sprint Active',
      description: 'Active Retro',
      startDate: activeStart,
      endDate: activeEnd,
    },
    {
      id: 2,
      name: 'Sprint Future',
      description: 'Future Retro',
      startDate: futureStart,
      endDate: futureEnd,
    },
    {
      id: 3,
      name: 'Sprint Past',
      description: 'Past Retro',
      startDate: pastStart,
      endDate: pastEnd,
    },
  ];

  beforeEach(() => {
    mockedAxios.get.mockResolvedValue({ data: mockSprints });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('fetches and renders sprints on mount', async () => {
    const mockSelect = jest.fn();
    const { getByText, findByText } = await render(
      <TeamSprintsManager
        team={mockTeam}
        token={mockToken}
        isAdmin={false}
        theme={mockTheme}
        onSelectSprint={mockSelect}
      />
    );

    expect(getByText(Strings.sprints.header)).toBeTruthy();
    expect(await findByText('Sprint Active')).toBeTruthy();
    expect(await findByText('Sprint Future')).toBeTruthy();
    
    // Toggle the expired sprints accordion to show past sprints
    fireEvent.press(await findByText(/ספרינטים קודמים/));
    expect(await findByText('Sprint Past')).toBeTruthy();
  });

  it('renders correct status badges (active, scheduled, closed) based on dates', async () => {
    const mockSelect = jest.fn();
    const { findByText } = await render(
      <TeamSprintsManager
        team={mockTeam}
        token={mockToken}
        isAdmin={false}
        theme={mockTheme}
        onSelectSprint={mockSelect}
      />
    );

    expect(await findByText('בלייב 🟢')).toBeTruthy();
    expect(await findByText('עתידי')).toBeTruthy();

    // Toggle the expired sprints accordion to show past sprints
    fireEvent.press(await findByText(/ספרינטים קודמים/));
    expect(await findByText('Sprint Past')).toBeTruthy();
  });

  it('shows "+ New Sprint" button and toggles create form for admins', async () => {
    const mockSelect = jest.fn();
    const { getByText, queryByText, findByText } = await render(
      <TeamSprintsManager
        team={mockTeam}
        token={mockToken}
        isAdmin={true}
        theme={mockTheme}
        onSelectSprint={mockSelect}
      />
    );

    // Wait for the initial sprints fetch to settle first
    expect(await findByText('Sprint Active')).toBeTruthy();

    const toggleBtn = getByText('+ פתח ספרינט');
    expect(queryByText(Strings.sprints.createSprintHeader)).toBeNull();

    fireEvent.press(toggleBtn);
    expect(await findByText(Strings.sprints.createSprintHeader)).toBeTruthy();

    fireEvent.press(getByText('✕ סגור'));
    await waitFor(() => {
      expect(queryByText(Strings.sprints.createSprintHeader)).toBeNull();
    });
  });

  it('triggers onSelectSprint when entering a retro session', async () => {
    const mockSelect = jest.fn();
    const { findAllByText } = await render(
      <TeamSprintsManager
        team={mockTeam}
        token={mockToken}
        isAdmin={false}
        theme={mockTheme}
        onSelectSprint={mockSelect}
      />
    );

    const enterButtons = await findAllByText('כניסה ללוח ←');
    fireEvent.press(enterButtons[0]);

    expect(mockSelect).toHaveBeenCalledWith(mockSprints[0], mockTeam);
  });
});
