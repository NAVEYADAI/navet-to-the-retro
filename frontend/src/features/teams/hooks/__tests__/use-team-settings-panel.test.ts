import { renderHook, act, waitFor } from '@testing-library/react-native';
import axios from 'axios';
import { useTeamSettingsPanel } from '../use-team-settings-panel';
import { Strings } from '@/constants/strings';

jest.mock('axios');
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
const mockedAxios = axios as jest.Mocked<typeof axios>;

const sprints = [{ id: 1, name: 'S1' }, { id: 2, name: 'S2' }];
const cat = (commentCount: number) => ({ id: 10, teamId: 1, label: 'X', isDefault: true, isEnabled: true, createdById: null, createdAt: '', commentCount });

const categoryCalls = () => mockedAxios.get.mock.calls.filter(([url]) => String(url).endsWith('/categories'));

function setupGet(categoriesImpl: (params: any) => Promise<any>) {
  mockedAxios.get.mockImplementation((async (url: string, config: any) => {
    if (String(url).endsWith('/sprints')) return { data: sprints };
    return categoriesImpl(config?.params);
  }) as any);
}

async function openPanel() {
  const hook = await renderHook(() =>
    useTeamSettingsPanel({ teamId: 1, token: 'tok', teamName: 'T', teamOffice: null, onTeamDetailsUpdated: jest.fn() })
  );
  await act(async () => {
    hook.result.current.handleToggleExpand();
  });
  await waitFor(() => expect(hook.result.current.selectedSprintIds).toEqual([1, 2]));
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  return hook;
}

describe('useTeamSettingsPanel sprint filter (BUG-55)', () => {
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    mockedAxios.get.mockReset();
  });

  it('un-checking every sprint shows "0 of N" and zero counts (backend would return all-sprint counts for an empty filter)', async () => {
    // The backend treats an absent/empty sprintIds as "all sprints" -> returns the big count.
    setupGet(async (params) => ({ data: [cat(params?.sprintIds ? 3 : 99)] }));
    const { result } = await openPanel();
    expect(result.current.sprintFilterLabel).toBe(Strings.categoryManagement.sprintFilterAllLabel);

    await act(async () => { result.current.handleToggleSprintSelected(1); });
    await act(async () => { result.current.handleToggleSprintSelected(2); });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.selectedSprintIds).toEqual([]);
    expect(result.current.sprintFilterLabel).toBe(Strings.categoryManagement.sprintFilterSelectedLabel(0, 2));
    expect(result.current.categories[0].commentCount).toBe(0);
  });

  it('fires exactly one categories request per toggle (no duplicate fetch)', async () => {
    setupGet(async () => ({ data: [cat(1)] }));
    const { result } = await openPanel();
    const before = categoryCalls().length;

    await act(async () => { result.current.handleToggleSprintSelected(1); });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(categoryCalls().length - before).toBe(1);
    expect(categoryCalls().at(-1)![1]).toEqual(expect.objectContaining({ params: { sprintIds: '2' } }));
  });

  it('ignores a slow, stale response that resolves after a newer request', async () => {
    const pending: Array<(v: any) => void> = [];
    let first = true;
    setupGet((params) => {
      if (first) { first = false; return Promise.resolve({ data: [cat(5)] }); } // initial open
      return new Promise((resolve) => { pending.push(() => resolve({ data: [cat(params?.sprintIds === '2' ? 111 : 222)] })); });
    });
    const { result } = await openPanel();

    await act(async () => { result.current.handleToggleSprintSelected(1); }); // request A: sprintIds '2'
    await act(async () => { result.current.handleToggleSprintSelected(2); }); // request B: sprintIds '' -> none
    expect(pending).toHaveLength(2);

    await act(async () => { pending[1](undefined); }); // B (latest) resolves first
    await act(async () => { pending[0](undefined); }); // A (stale) resolves late

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // Latest state is "none selected" -> zero counts, not A's 111.
    expect(result.current.categories[0].commentCount).toBe(0);
  });
});
