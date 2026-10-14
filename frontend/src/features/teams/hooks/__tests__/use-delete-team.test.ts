import { renderHook, act } from '@testing-library/react-native';
import axios from 'axios';
import { useDeleteTeam, isDeleteConfirmationMatch } from '../use-delete-team';
import { Strings } from '@/constants/strings';
import { trackEvent } from '@/lib/analytics';
import { subscribeTeamsChanged } from '@/features/dashboard/teams-changed-signal';

jest.mock('axios');
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
const mockedAxios = axios as jest.Mocked<typeof axios>;

async function setup(teamName = 'Core Team') {
  const onDeleted = jest.fn();
  const hook = await renderHook(() => useDeleteTeam({ teamId: 7, teamName, token: 'tok', onDeleted }));
  return { ...hook, onDeleted };
}

afterEach(() => { jest.clearAllMocks(); mockedAxios.delete.mockReset(); });

describe('isDeleteConfirmationMatch', () => {
  it('matches exactly after trimming both sides — same rule as the server', () => {
    expect(isDeleteConfirmationMatch('Core Team', 'Core Team')).toBe(true);
    expect(isDeleteConfirmationMatch('  Core Team ', 'Core Team  ')).toBe(true);
    expect(isDeleteConfirmationMatch('core team', 'Core Team')).toBe(false);
    expect(isDeleteConfirmationMatch('Core', 'Core Team')).toBe(false);
    expect(isDeleteConfirmationMatch('', 'Core Team')).toBe(false);
  });
});

describe('useDeleteTeam (feature 14)', () => {
  it('starts closed; opening resets the typed name and tracks the click', async () => {
    const { result } = await setup();
    expect(result.current.isOpen).toBe(false);
    await act(async () => { result.current.open(); });
    expect(result.current.isOpen).toBe(true);
    expect(result.current.typedName).toBe('');
    expect(trackEvent).toHaveBeenCalledWith('team_delete_clicked', { teamId: 7 });
  });

  it('the confirm button only unlocks when the exact name is typed', async () => {
    const { result } = await setup();
    await act(async () => { result.current.open(); });
    expect(result.current.canConfirm).toBe(false);
    await act(async () => { result.current.setTypedName('Core'); });
    expect(result.current.canConfirm).toBe(false);
    await act(async () => { result.current.setTypedName('Core Team'); });
    expect(result.current.canConfirm).toBe(true);
  });

  it('confirming with a wrong name never reaches the server', async () => {
    const { result } = await setup();
    await act(async () => { result.current.open(); });
    await act(async () => { result.current.setTypedName('nope'); });
    await act(async () => { await result.current.confirm(); });
    expect(mockedAxios.delete).not.toHaveBeenCalled();
  });

  it('confirming sends the typed name with the token, then refreshes the team list everywhere', async () => {
    mockedAxios.delete.mockResolvedValue({ data: { id: 7 } });
    const changed = jest.fn();
    const unsubscribe = subscribeTeamsChanged(changed);
    const { result, onDeleted } = await setup();
    await act(async () => { result.current.open(); });
    await act(async () => { result.current.setTypedName('Core Team'); });
    await act(async () => { await result.current.confirm(); });
    unsubscribe();

    expect(mockedAxios.delete).toHaveBeenCalledWith(expect.stringContaining('/teams/7'), {
      headers: { Authorization: 'Bearer tok' },
      data: { confirmName: 'Core Team' },
    });
    expect(trackEvent).toHaveBeenCalledWith('team_deleted', { teamId: 7 });
    expect(onDeleted).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(result.current.isOpen).toBe(false);
  });

  it('a server rejection keeps the form open with the server message', async () => {
    mockedAxios.delete.mockRejectedValue(Object.assign(new Error('x'), { response: { data: { message: 'שם הצוות שהוקלד לא תואם' } } }));
    const { result, onDeleted } = await setup();
    await act(async () => { result.current.open(); });
    await act(async () => { result.current.setTypedName('Core Team'); });
    await act(async () => { await result.current.confirm(); });
    expect(result.current.isOpen).toBe(true);
    expect(result.current.error).toBe('שם הצוות שהוקלד לא תואם');
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('falls back to a generic error, and cancel closes without deleting', async () => {
    mockedAxios.delete.mockRejectedValue(new Error('network'));
    const { result } = await setup();
    await act(async () => { result.current.open(); });
    await act(async () => { result.current.setTypedName('Core Team'); });
    await act(async () => { await result.current.confirm(); });
    expect(result.current.error).toBe(Strings.teamDeletion.deleteError);

    mockedAxios.delete.mockClear();
    await act(async () => { result.current.cancel(); });
    expect(result.current.isOpen).toBe(false);
    expect(trackEvent).toHaveBeenCalledWith('team_delete_cancelled', { teamId: 7 });
    expect(mockedAxios.delete).not.toHaveBeenCalled();
  });
});
