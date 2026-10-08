/**
 * @jest-environment jsdom
 */
import React from 'react';
import axios from 'axios';
import { SprintLengthHistoryPanelWeb } from '../sprint-length-history-panel-web';
import { Strings } from '@/constants/strings';
import { mountWeb, clickText, type Mounted } from '@/test-utils/web-dom';

// Factory mock: automocking would load axios' browser build, which needs TextEncoder in jsdom.
jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn() } }));
const mockedAxios = axios as jest.Mocked<typeof axios>;

const entry = (id: number) => ({
  id,
  previousStartDate: '2026-08-01T00:00:00.000Z',
  previousEndDate: '2026-08-15T00:00:00.000Z',
  newStartDate: '2026-08-01T00:00:00.000Z',
  newEndDate: '2026-08-22T00:00:00.000Z',
  reason: null,
  createdAt: '2026-08-10T09:30:00.000Z',
  changedBy: { username: 'admin' },
});
const panel = (refreshKey?: number) => <SprintLengthHistoryPanelWeb teamId={1} sprintId={5} token="tok" refreshKey={refreshKey} />;

let mounted: Mounted | null = null;
beforeEach(() => {
  // lucide-react-native renders RNSVG* tags under react-dom; harmless noise (see memory-card-web.test.tsx).
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('SprintLengthHistoryPanelWeb', () => {
  it('does not fetch while collapsed; fetches when opened', async () => {
    mockedAxios.get.mockResolvedValue({ data: [entry(1)] });
    mounted = await mountWeb(panel(0));
    expect(mockedAxios.get).not.toHaveBeenCalled();

    await clickText(mounted.container, Strings.retroBoard.lengthHistoryShowButton);
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it('BUG-53: an open panel refetches when refreshKey changes (after a sprint dates edit)', async () => {
    mockedAxios.get.mockResolvedValue({ data: [entry(1)] });
    mounted = await mountWeb(panel(0));
    await clickText(mounted.container, Strings.retroBoard.lengthHistoryShowButton);
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);

    mockedAxios.get.mockResolvedValue({ data: [entry(2), entry(1)] });
    await mounted.rerender(panel(1));
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);

    // Re-rendering with an unchanged key does not refetch.
    await mounted.rerender(panel(1));
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });

  it('a collapsed panel does not fetch just because refreshKey changed', async () => {
    mockedAxios.get.mockResolvedValue({ data: [] });
    mounted = await mountWeb(panel(0));
    await mounted.rerender(panel(1));
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('BUG-58: renders entry dates in he-IL', async () => {
    mockedAxios.get.mockResolvedValue({ data: [entry(1)] });
    mounted = await mountWeb(panel());
    await clickText(mounted.container, Strings.retroBoard.lengthHistoryShowButton);
    expect(mounted.container.textContent).toContain('22.8.2026');
  });
});
