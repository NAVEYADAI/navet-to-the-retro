/**
 * @jest-environment jsdom
 */
import React from 'react';
import axios from 'axios';
import { MemoryBoardWeb } from '../memory-board-web';
import { Strings } from '@/constants/strings';
import { mountWeb, clickText, type Mounted } from '@/test-utils/web-dom';

// Factory mock: automocking would load axios' browser build, which needs TextEncoder in jsdom.
jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn() } }));
const mockedAxios = axios as jest.Mocked<typeof axios>;

let mounted: Mounted | null = null;
const render = async () => {
  mounted = await mountWeb(<MemoryBoardWeb sprint={{ id: 5 }} team={{ id: 1 }} token="tok" onBack={jest.fn()} />);
  return mounted.container;
};

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('MemoryBoardWeb', () => {
  it('BUG-34: a failed load shows an error instead of the "no cards" empty state, and refresh recovers', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('Network Error'));
    const c = await render();
    expect(c.textContent).toContain(Strings.memoryBoard.loadError);
    expect(c.textContent).not.toContain(Strings.memoryBoard.emptyKeepText);
    expect(c.textContent).not.toContain(Strings.memoryBoard.emptyImproveText);

    mockedAxios.get.mockResolvedValueOnce({ data: [] });
    await clickText(c, Strings.common.refreshButton);
    expect(c.textContent).not.toContain(Strings.memoryBoard.loadError);
    expect(c.textContent).toContain(Strings.memoryBoard.emptyKeepText);
  });

  it('a successful empty load still shows the genuine empty state', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: [] });
    const c = await render();
    expect(c.textContent).not.toContain(Strings.memoryBoard.loadError);
    expect(c.textContent).toContain(Strings.memoryBoard.emptyKeepText);
  });
});
