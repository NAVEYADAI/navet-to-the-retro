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

  const mockCommentsForFilters = [
    {
      id: 201,
      content: 'Great velocity this sprint!',
      type: 'KEEP',
      category: 'PLANNING',
      isAnonymous: false,
      createdAt: '2026-08-04T12:00:00.000Z',
      author: { username: 'dev1' },
    },
    {
      id: 202,
      content: 'Testing took too long.',
      type: 'IMPROVE',
      category: 'TESTING',
      isAnonymous: false,
      createdAt: '2026-08-04T13:00:00.000Z',
      author: { username: 'dev2' },
    },
    {
      id: 203,
      content: 'Good team communication.',
      type: 'KEEP',
      category: 'GENERAL',
      isAnonymous: false,
      createdAt: '2026-08-04T14:00:00.000Z',
      author: { username: 'dev3' },
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
        onBack={mockBack}
      />
    );

    expect(await findByText('Great velocity this sprint!')).toBeTruthy();
    expect(await findByText('Too many meetings.')).toBeTruthy();

    expect(getByText('dev1')).toBeTruthy();
  });

  it('toggles note type when pressing the KEEP/IMPROVE toggle', async () => {
    const mockBack = jest.fn();
    const { getByTestId, getByLabelText, findByText } = await render(
      <SprintRetroBoard
        sprint={mockSprint}
        team={mockTeam}
        token={mockToken}
        user={mockUser}
        onBack={mockBack}
      />
    );

    // Wait for comments to load so that initial mount state updates settle
    expect(await findByText('Great velocity this sprint!')).toBeTruthy();

    // Initial state: Keep (queried by testID since the label text also appears as a column header)
    expect(getByTestId('retro-type-label').props.children).toBe(Strings.retroBoard.keepLabel);

    // Find the KEEP/IMPROVE toggle control (identified by its accessibility label) and press it
    const toggleArea = getByLabelText(Strings.retroBoard.spinLabel);
    await fireEvent.press(toggleArea);

    await waitFor(() => {
      expect(getByTestId('retro-type-label').props.children).toBe(Strings.retroBoard.improveLabel);
    });
  });

  it('submits a new note successfully via API', async () => {
    const mockBack = jest.fn();

    const { getByPlaceholderText, getByText, findByText } = await render(
      <SprintRetroBoard
        sprint={mockSprint}
        team={mockTeam}
        token={mockToken}
        user={mockUser}
        onBack={mockBack}
      />
    );

    // Wait for comments to load so that initial mount state updates settle
    expect(await findByText('Great velocity this sprint!')).toBeTruthy();

    const input = getByPlaceholderText(Strings.retroBoard.notePlaceholderKeep);
    const submitBtn = getByText(Strings.retroBoard.postNoteButton);

    await fireEvent.changeText(input, 'Working together was smooth.');
    await waitFor(() => {
      expect(input.props.value).toBe('Working together was smooth.');
    });

    await fireEvent.press(submitBtn);

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
    expect(input.props.value).toBe('');
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });

  describe('filtering comments', () => {
    async function renderWithFilterableComments() {
      mockedAxios.get.mockResolvedValueOnce({ data: mockCommentsForFilters });
      const utils = await render(
        <SprintRetroBoard
          sprint={mockSprint}
          team={mockTeam}
          token={mockToken}
          user={mockUser}
          onBack={jest.fn()}
        />
      );
      await utils.findByText('Great velocity this sprint!');
      return utils;
    }

    it('does not show the "no matching comments" message on initial load', async () => {
      const { queryByText } = await renderWithFilterableComments();

      expect(queryByText(Strings.retroBoard.noMatchingCommentsText)).toBeNull();
    });

    it('filters by category: only comments in the selected category remain visible', async () => {
      const { getByText, getAllByText, queryByText, findByText } = await renderWithFilterableComments();

      // Open the category picker (shows the "all categories" label when unset) and pick TESTING.
      // The picker's own list item and the matching comment's category chip render the same
      // label text once selected, so disambiguate: the picker item renders first in the tree.
      await fireEvent.press(getByText(Strings.retroBoard.filterAllCategoriesLabel));
      await fireEvent.press(getAllByText(Strings.retroBoard.categories.TESTING)[0]);

      expect(queryByText('Great velocity this sprint!')).toBeNull();
      expect(queryByText('Good team communication.')).toBeNull();
      expect(await findByText('Testing took too long.')).toBeTruthy();
    });

    it('filters by free text appearing in the comment content (case-insensitive)', async () => {
      const { getByPlaceholderText, queryByText, findByText } = await renderWithFilterableComments();

      const searchInput = getByPlaceholderText(Strings.retroBoard.searchPlaceholder);
      await fireEvent.changeText(searchInput, 'VELOCITY');

      expect(await findByText('Great velocity this sprint!')).toBeTruthy();
      expect(queryByText('Testing took too long.')).toBeNull();
      expect(queryByText('Good team communication.')).toBeNull();
    });

    it('supports selecting multiple categories (OR within categories)', async () => {
      const { getByText, getAllByText, queryByText, findByText } = await renderWithFilterableComments();

      // Open the picker once and select both PLANNING and TESTING without it closing in between.
      await fireEvent.press(getByText(Strings.retroBoard.filterAllCategoriesLabel));
      await fireEvent.press(getAllByText(Strings.retroBoard.categories.PLANNING)[0]);
      await fireEvent.press(getAllByText(Strings.retroBoard.categories.TESTING)[0]);

      expect(await findByText('Great velocity this sprint!')).toBeTruthy();
      expect(await findByText('Testing took too long.')).toBeTruthy();
      expect(queryByText('Good team communication.')).toBeNull();
    });

    it('combines category and text filters with AND semantics', async () => {
      const { getByText, getAllByText, getByPlaceholderText, queryByText, findAllByText } = await renderWithFilterableComments();

      await fireEvent.press(getByText(Strings.retroBoard.filterAllCategoriesLabel));
      await fireEvent.press(getAllByText(Strings.retroBoard.categories.PLANNING)[0]);
      await fireEvent.changeText(getByPlaceholderText(Strings.retroBoard.searchPlaceholder), 'communication');

      // PLANNING matches only the "Great velocity" comment, but the text filter doesn't match it,
      // so both KEEP and IMPROVE columns end up empty and each shows its own "no matches" message.
      expect(queryByText('Great velocity this sprint!')).toBeNull();
      expect(queryByText('Good team communication.')).toBeNull();
      expect(await findAllByText(Strings.retroBoard.noMatchingCommentsText)).toHaveLength(2);
    });

    it('clearing filters restores the full comment list', async () => {
      const { getByText, getByPlaceholderText, findByText } = await renderWithFilterableComments();

      await fireEvent.changeText(getByPlaceholderText(Strings.retroBoard.searchPlaceholder), 'velocity');
      await findByText(Strings.retroBoard.clearFiltersLabel);
      await fireEvent.press(getByText(Strings.retroBoard.clearFiltersLabel));

      expect(await findByText('Testing took too long.')).toBeTruthy();
      expect(await findByText('Good team communication.')).toBeTruthy();
    });
  });

  // Feature 9 (phantom members, product-backlog/09-phantom-members.md §9.0 decisions #1/#2/#3).
  describe('"post on behalf of" (feature 9, phantom members)', () => {
    const adminUser = { id: 12, username: 'adminuser' };
    const teamWithTarget = {
      id: 1,
      name: 'Core Team',
      members: [
        { userId: 12, isAdmin: true, role: 'TEAM_LEADER', user: { username: 'adminuser', firstName: 'Admin', lastName: 'Istrator' } },
        { userId: 77, isAdmin: false, role: 'DEVELOPER', user: { username: 'phantom_abc', firstName: 'Phanto', lastName: 'Mm' } },
      ],
    };

    const postOnBehalfButtonLabel = Strings.retroBoard.postOnBehalfOtherOption;

    beforeEach(() => {
      mockedAxios.get.mockResolvedValue({ data: [] });
      mockedAxios.post.mockResolvedValue({ data: {} });
    });

    it('is not rendered at all for a plain (non-admin, non-leader) team member', async () => {
      const plainMemberTeam = {
        id: 2,
        name: 'Core Team',
        members: [
          { userId: 12, isAdmin: false, role: 'DEVELOPER', user: { username: 'adminuser' } },
          { userId: 77, isAdmin: false, role: 'DEVELOPER', user: { username: 'phantom_abc' } },
        ],
      };

      const { queryByText, findByText } = await render(
        <SprintRetroBoard sprint={mockSprint} team={plainMemberTeam} token={mockToken} user={adminUser} onBack={jest.fn()} />
      );
      await findByText(Strings.retroBoard.writeNoteHeader);

      expect(queryByText(postOnBehalfButtonLabel, { exact: false })).toBeNull();
    });

    it('lets an admin pick a target, sends onBehalfOfUserId, and hides the anonymous toggle once a target is chosen', async () => {
      const { getByText, getByLabelText, queryByLabelText, getByPlaceholderText, findByText } = await render(
        <SprintRetroBoard sprint={mockSprint} team={teamWithTarget} token={mockToken} user={adminUser} onBack={jest.fn()} />
      );
      await findByText(Strings.retroBoard.writeNoteHeader);

      // Default state ("אני"): the anonymous toggle is present.
      expect(getByLabelText(Strings.retroBoard.anonymousToggleHint)).toBeTruthy();

      await fireEvent.press(getByText(postOnBehalfButtonLabel));
      await fireEvent.press(getByText('Phanto Mm'));

      // Selecting a target removes the anonymous toggle from the tree entirely (not just disabled).
      expect(queryByLabelText(Strings.retroBoard.anonymousToggleHint)).toBeNull();

      const input = getByPlaceholderText(Strings.retroBoard.notePlaceholderKeep);
      await fireEvent.changeText(input, 'Entered on their behalf.');
      await fireEvent.press(getByText(Strings.retroBoard.postNoteButton));

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/sprints/5/comments'),
        expect.objectContaining({
          content: 'Entered on their behalf.',
          isAnonymous: false,
          onBehalfOfUserId: 77,
        }),
        expect.objectContaining({ headers: { Authorization: 'Bearer mock-token' } })
      );
    });

    it('renders the "posted on behalf of X by Y" indicator naming the specific admin, visible to any team member', async () => {
      const onBehalfComment = {
        id: 301,
        content: 'A comment entered on behalf of a phantom member.',
        type: 'KEEP',
        isAnonymous: false,
        createdAt: '2026-08-04T12:00:00.000Z',
        author: { username: 'phantom_abc', firstName: 'Phanto', lastName: 'Mm' },
        postedByAdmin: { id: 12, username: 'adminuser', firstName: 'Admin', lastName: 'Istrator' },
      };
      mockedAxios.get.mockResolvedValue({ data: [onBehalfComment] });

      // A plain, non-admin/non-leader member — the indicator must still be visible to them
      // (product-backlog/09-phantom-members.md §9.0 decision #2: never masked, unlike isAnonymous).
      const plainMember = { id: 999, username: 'plainmember' };
      const teamWithPlainViewer = {
        id: 3,
        name: 'Core Team',
        members: [{ userId: 999, isAdmin: false, role: 'DEVELOPER', user: { username: 'plainmember' } }],
      };

      const { findByText } = await render(
        <SprintRetroBoard sprint={mockSprint} team={teamWithPlainViewer} token={mockToken} user={plainMember} onBack={jest.fn()} />
      );

      expect(await findByText('A comment entered on behalf of a phantom member.')).toBeTruthy();
      expect(await findByText(Strings.retroBoard.postedOnBehalfIndicator('Phanto Mm', 'Admin Istrator'))).toBeTruthy();
    });
  });
});
