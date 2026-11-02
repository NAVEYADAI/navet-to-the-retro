/**
 * @jest-environment jsdom
 *
 * Feature 13 §13.0 decision #2 — the admin "הארכת כתיבה" form on the web: pick an active member and an
 * end date, grant; nothing is sent while the form is incomplete.
 */
import React, { act } from 'react';
import axios from 'axios';
import { AdminCommentToolsWeb } from '../admin-comment-tools-web';
import { Strings } from '@/constants/strings';
import { todayLocalIso } from '../../hooks/use-write-extensions';
import { mountWeb, clickText, setInput, flush, dateInputs, type Mounted } from '@/test-utils/web-dom';
import { trackEvent } from '@/lib/analytics';

jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() } }));
const mockedAxios = axios as jest.Mocked<typeof axios>;
jest.setTimeout(30000);

const members = [
  { userId: 1, status: 'ACTIVE', user: { id: 1, username: 'admin', firstName: 'נוה', lastName: '' } },
  { userId: 21, status: 'ACTIVE', user: { id: 21, username: 'dana', firstName: 'דנה', lastName: 'כהן' } },
  { userId: 30, status: 'ACTIVE', user: { id: 30, username: 'ghost', firstName: 'רוח', lastName: '', isPhantom: true } },
  { userId: 31, status: 'PENDING', user: { id: 31, username: 'wait', firstName: 'ממתין', lastName: '' } },
];

let mounted: Mounted | null = null;
const onExtensionsChanged = jest.fn();
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockedAxios.get.mockResolvedValue({ data: [] });
});
afterEach(() => { mounted?.unmount(); mounted = null; jest.restoreAllMocks(); jest.clearAllMocks(); mockedAxios.post.mockReset(); });

const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return todayLocalIso(d); };

async function openExtensionsPanel(c: HTMLElement) {
  const panel = Array.from(c.querySelectorAll('h2')).find((h) => h.textContent === Strings.retroBoard.extensionsPanelTitle)!.closest('div')!.parentElement!;
  const open = Array.from(panel.querySelectorAll('button')).find((b) => b.textContent === Strings.retroBoard.adminToolsOpenButton)!;
  await act(async () => { open.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
  await flush();
}

async function pickMember(c: HTMLElement, label: string) {
  const combobox = c.querySelector<HTMLElement>('[role="combobox"]')!;
  await act(async () => { combobox.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })); });
  await clickText(document.body, label);
}

describe('write extensions form (web)', () => {
  const render = async () => {
    mounted = await mountWeb(<AdminCommentToolsWeb sprintId={5} token="tok" members={members} deletedRefreshKey={0} onExtensionsChanged={onExtensionsChanged} />);
    await openExtensionsPanel(mounted.container);
    return mounted.container;
  };

  it('offers only real, active members (no phantom, no pending invitation)', async () => {
    const c = await render();
    const combobox = c.querySelector<HTMLElement>('[role="combobox"]')!;
    await act(async () => { combobox.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })); });
    const options = Array.from(document.body.querySelectorAll('[role="option"]')).map((o) => o.textContent);
    expect(options).toEqual(['נוה', 'דנה כהן']);
  });

  it('grants { userId, expiresAt } for the chosen member and date, tracks it and resets the form', async () => {
    mockedAxios.post.mockResolvedValue({ data: {} });
    const c = await render();
    const date = tomorrow();
    await pickMember(c, 'דנה כהן');
    await setInput(dateInputs(c)[0], date);
    await clickText(c, Strings.retroBoard.extensionsGrantButton);

    expect(mockedAxios.post).toHaveBeenCalledWith(expect.stringContaining('/sprints/5/write-extensions'), { userId: 21, expiresAt: date }, { headers: { Authorization: 'Bearer tok' } });
    expect(trackEvent).toHaveBeenCalledWith('write_extension_granted', { sprintId: 5 });
    expect(onExtensionsChanged).toHaveBeenCalledTimes(1);
    expect(dateInputs(c)[0].value).toBe('');
  });

  it('an incomplete form is not sent — the admin is told what is missing', async () => {
    const c = await render();
    await clickText(c, Strings.retroBoard.extensionsGrantButton);
    expect(c.textContent).toContain(Strings.retroBoard.extensionsPickMemberError);
    await pickMember(c, 'דנה כהן');
    await clickText(c, Strings.retroBoard.extensionsGrantButton);
    expect(c.textContent).toContain(Strings.retroBoard.extensionsPickDateError);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('grant errors appear next to the grant button, not at the top of the panel', async () => {
    const c = await render();
    await clickText(c, Strings.retroBoard.extensionsGrantButton);
    const grantButton = Array.from(c.querySelectorAll('button')).find((b) => b.textContent?.includes(Strings.retroBoard.extensionsGrantButton))!;
    expect(grantButton.parentElement!.textContent).toContain(Strings.retroBoard.extensionsPickMemberError);
  });

  it('a server rejection of the grant is tracked and shown by the button', async () => {
    mockedAxios.post.mockRejectedValue(Object.assign(new Error('boom'), { response: { status: 400, data: { message: 'ההארכה חורגת מ-30 יום' } } }));
    const c = await render();
    await pickMember(c, 'דנה כהן');
    await setInput(dateInputs(c)[0], tomorrow());
    await clickText(c, Strings.retroBoard.extensionsGrantButton);
    const grantButton = Array.from(c.querySelectorAll('button')).find((b) => b.textContent?.includes(Strings.retroBoard.extensionsGrantButton))!;
    expect(grantButton.parentElement!.textContent).toContain('ההארכה חורגת מ-30 יום');
    expect(trackEvent).toHaveBeenCalledWith('write_extension_grant_failed', { sprintId: 5, status: 400 });
  });
});
