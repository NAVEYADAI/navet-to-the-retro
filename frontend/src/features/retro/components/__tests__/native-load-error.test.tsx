import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import axios from 'axios';
import { SprintRetroBoardNative } from '../sprint-retro-board-native';
import { MemoryBoardNative } from '../memory-board-native';
import { SprintSummaryNative } from '@/features/sprint-summary/components/sprint-summary-native';
import { Strings } from '@/constants/strings';
import { formatDateRange } from '@/lib/format-date';
import { trackEvent } from '@/lib/analytics';

// First test in a cold jest cache pays the RN transform cost.
jest.setTimeout(30000);

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
// Not under test: the card's gesture-handler wiring, the file/sharing native modules.
jest.mock('../memory-card-native', () => ({ MemoryCardNative: () => null }));
jest.mock('expo-file-system', () => ({ File: {}, Directory: class {}, Paths: { cache: '' } }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

const sprint = { id: 5, name: 'Sprint 5', startDate: '2026-08-01', endDate: '2026-08-15', description: 'desc' };
const team = { id: 1, name: 'Core Team', members: [{ userId: 12, isAdmin: true }] };
const user = { id: 12, username: 'admin' };

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

/** GET /categories succeeds; GET /comments follows the given handler. */
function mockGets(commentsHandler: () => Promise<any>) {
  mockedAxios.get.mockImplementation((url: string) =>
    url.includes('/categories') ? Promise.resolve({ data: [] }) : commentsHandler()
  );
}

describe('SprintRetroBoardNative', () => {
  const renderBoard = () =>
    render(
      <SprintRetroBoardNative
        {...({ sprint, team, token: 't', user, onBack: jest.fn(), onOpenSummary: jest.fn(), onOpenMemory: jest.fn() } as any)}
      />
    );

  it('BUG-34: a failed comments load shows an error instead of the empty columns, and retry recovers', async () => {
    let fail = true;
    mockGets(() => (fail ? Promise.reject(new Error('Network Error')) : Promise.resolve({ data: [] })));
    const { findByText, queryByText, getByTestId } = await renderBoard();

    expect(await findByText(Strings.retroBoard.loadCommentsError)).toBeTruthy();
    expect(queryByText(Strings.retroBoard.emptyKeepText)).toBeNull();
    expect(queryByText(Strings.retroBoard.emptyImproveText)).toBeNull();

    fail = false;
    await fireEvent.press(getByTestId('load-error-retry'));
    expect(trackEvent).toHaveBeenCalledWith('load_error_retry_clicked', { screen: 'retro_board' });
    expect(await findByText(Strings.retroBoard.emptyKeepText)).toBeTruthy();
    expect(queryByText(Strings.retroBoard.loadCommentsError)).toBeNull();
  });

  it('a successful empty load still shows the genuine empty state', async () => {
    mockGets(() => Promise.resolve({ data: [] }));
    const { findByText, queryByText } = await renderBoard();
    expect(await findByText(Strings.retroBoard.emptyKeepText)).toBeTruthy();
    expect(queryByText(Strings.retroBoard.loadCommentsError)).toBeNull();
  });

  it('BUG-58: the sprint date range is formatted with the he-IL locale', async () => {
    mockGets(() => Promise.resolve({ data: [] }));
    const { findByText } = await renderBoard();
    expect(await findByText(`${team.name} • ${formatDateRange(sprint.startDate, sprint.endDate)}`)).toBeTruthy();
  });

  describe('sprint edit date validation (BUG-12)', () => {
    const openEditor = async () => {
      mockGets(() => Promise.resolve({ data: [] }));
      const utils = await renderBoard();
      await fireEvent.press(await utils.findByText(Strings.retroBoard.editSprintButton));
      return utils;
    };

    it('rejects an end date before the start date without calling the server', async () => {
      const { getByPlaceholderText, getByText } = await openEditor();
      await fireEvent.changeText(getByPlaceholderText(Strings.sprints.endDateLabel), '2026-07-01');
      await fireEvent.press(getByText(Strings.teamList.saveButton));
      expect(getByText(Strings.sprints.endBeforeStartError)).toBeTruthy();
      expect(mockedAxios.patch).not.toHaveBeenCalled();
    });

    it("shows the backend's 400 message when the server rejects the edit", async () => {
      mockedAxios.patch.mockRejectedValueOnce({ response: { data: { message: 'תאריך לא תקין מהשרת' } } });
      const { getByText, findByText } = await openEditor();
      await fireEvent.press(getByText(Strings.teamList.saveButton));
      expect(await findByText('תאריך לא תקין מהשרת')).toBeTruthy();
    });

    it('joins an array of validation messages from the backend', async () => {
      mockedAxios.patch.mockRejectedValueOnce({ response: { data: { message: ['שגיאה א', 'שגיאה ב'] } } });
      const { getByText, findByText } = await openEditor();
      await fireEvent.press(getByText(Strings.teamList.saveButton));
      expect(await findByText('שגיאה א שגיאה ב')).toBeTruthy();
    });
  });
});

describe('MemoryBoardNative', () => {
  const renderBoard = () => render(<MemoryBoardNative sprint={sprint} team={team} token="t" onBack={jest.fn()} />);

  it('BUG-34: a failed load shows an error instead of the "no cards" empty state, and retry recovers', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('Network Error'));
    const { findByText, queryByText, getByTestId } = await renderBoard();
    expect(await findByText(Strings.memoryBoard.loadError)).toBeTruthy();
    expect(queryByText(Strings.memoryBoard.emptyKeepText)).toBeNull();

    mockedAxios.get.mockResolvedValueOnce({ data: [] });
    await fireEvent.press(getByTestId('load-error-retry'));
    expect(await findByText(Strings.memoryBoard.emptyKeepText)).toBeTruthy();
    expect(queryByText(Strings.memoryBoard.loadError)).toBeNull();
  });
});

describe('SprintSummaryNative', () => {
  const renderSummary = () => render(<SprintSummaryNative sprint={sprint} team={team} token="t" onBack={jest.fn()} />);

  it('BUG-34: a failed load shows an error (no "no comments" text, no download button), and retry recovers', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('Network Error'));
    const { findByText, queryByText, getByTestId } = await renderSummary();
    expect(await findByText(Strings.sprintSummary.loadError)).toBeTruthy();
    expect(queryByText(Strings.sprintSummary.noCommentsText)).toBeNull();
    expect(queryByText(Strings.sprintSummary.downloadButton)).toBeNull();

    mockedAxios.get.mockResolvedValueOnce({ data: [{ id: 1, type: 'KEEP', content: 'x', createdAt: '2026-08-04T12:00:00.000Z' }] });
    await fireEvent.press(getByTestId('load-error-retry'));
    await waitFor(() => expect(queryByText(Strings.sprintSummary.loadError)).toBeNull());
    expect(await findByText(Strings.sprintSummary.downloadButton)).toBeTruthy();
  });

  it('BUG-58: shows the sprint date range in he-IL format', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: [] });
    const { findByText } = await renderSummary();
    expect(await findByText(`${team.name} • ${formatDateRange(sprint.startDate, sprint.endDate)}`)).toBeTruthy();
  });
});
