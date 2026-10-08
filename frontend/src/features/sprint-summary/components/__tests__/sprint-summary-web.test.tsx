/**
 * @jest-environment jsdom
 */
import React from 'react';
import { TextEncoder } from 'util';
import axios from 'axios';
import { SprintSummaryWeb } from '../sprint-summary-web';
import { Strings } from '@/constants/strings';
import { mountWeb, clickText, flush, type Mounted } from '@/test-utils/web-dom';

// expo's lazy `URL` global needs TextEncoder, which jsdom does not provide.
(global as any).TextEncoder = (global as any).TextEncoder ?? TextEncoder;

// Factory mock: automocking would load axios' browser build, which needs TextEncoder in jsdom.
jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn() } }));
const mockedAxios = axios as jest.Mocked<typeof axios>;

const sprint = { id: 5, name: 'Sprint 5', startDate: '2026-08-01T00:00:00.000Z', endDate: '2026-08-15T00:00:00.000Z' };
const team = { id: 1, name: 'Core Team' };
const comment = { id: 1, type: 'KEEP', content: 'x', categoryId: null, category: null };

let mounted: Mounted | null = null;
const render = async () => {
  mounted = await mountWeb(<SprintSummaryWeb sprint={sprint} team={team} token="tok" onBack={jest.fn()} />);
  return mounted.container;
};

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  jest.useRealTimers();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('SprintSummaryWeb', () => {
  it('BUG-34: a failed load shows an error, not "no comments yet", and hides the download button', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('Network Error'));
    const c = await render();
    expect(c.textContent).toContain(Strings.sprintSummary.loadError);
    expect(c.textContent).not.toContain(Strings.sprintSummary.noCommentsText);
    expect(c.textContent).not.toContain(Strings.sprintSummary.downloadButton);

    mockedAxios.get.mockResolvedValueOnce({ data: [comment] });
    await clickText(c, Strings.common.refreshButton);
    expect(c.textContent).not.toContain(Strings.sprintSummary.loadError);
    expect(c.textContent).toContain(Strings.sprintSummary.downloadButton);
  });

  it('BUG-58: the date range uses he-IL formatting', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: [comment] });
    const c = await render();
    expect(c.textContent).toContain('1.8.2026 - 15.8.2026');
  });

  it('BUG-58: the PPTX object URL is revoked after a delay, not synchronously after click()', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: [comment] });
    const c = await render();

    const createObjectURL = jest.fn(() => 'blob:fake');
    const revokeObjectURL = jest.fn();
    (URL as any).createObjectURL = createObjectURL;
    (URL as any).revokeObjectURL = revokeObjectURL;
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    mockedAxios.get.mockResolvedValueOnce({ data: new Blob(['x']), headers: {} });

    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    await clickText(c, Strings.sprintSummary.downloadButton);
    await flush();

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).not.toHaveBeenCalled();

    // Deferred: a timer with a real delay was scheduled; firing it revokes the URL.
    const revokeTimer = setTimeoutSpy.mock.calls.find(([, ms]) => typeof ms === 'number' && ms >= 1000);
    expect(revokeTimer).toBeDefined();
    (revokeTimer![0] as () => void)();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });
});
