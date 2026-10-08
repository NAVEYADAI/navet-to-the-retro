import { renderHook, waitFor, act } from '@testing-library/react-native';
import axios from 'axios';
import { useSprintRouteData } from '../use-sprint-route-data';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const teams = [{ id: 1, name: 'Core', members: [] }, { id: 2, name: 'Other', members: [] }];
const sprints = [{ id: 10, name: 'S10' }, { id: 11, name: 'S11' }];

function mockBackend({ teamsResult = Promise.resolve({ data: teams }) as Promise<any>, sprintsResult = Promise.resolve({ data: sprints }) as Promise<any> } = {}) {
  mockedAxios.get.mockImplementation((url: string) => (url.endsWith('/teams/user/me') ? teamsResult : sprintsResult));
}

describe('useSprintRouteData (BUG-33: sprint routes fetch their own data on mount)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('resolves the team and sprint by id from the route params', async () => {
    mockBackend();
    const { result } = await renderHook(() => useSprintRouteData('1', '11', 'tok'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.team).toEqual(teams[0]);
    expect(result.current.sprint).toEqual(sprints[1]);
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    expect(mockedAxios.get.mock.calls.map(([url]) => url).join(' ')).toContain('/teams/1/sprints');
  });

  it('is notFound when the team is not one of the user\'s teams', async () => {
    mockBackend();
    const { result } = await renderHook(() => useSprintRouteData('99', '10', 'tok'));
    await waitFor(() => expect(result.current.status).toBe('notFound'));
  });

  it('is notFound when the sprint is not in that team', async () => {
    mockBackend();
    const { result } = await renderHook(() => useSprintRouteData('1', '999', 'tok'));
    await waitFor(() => expect(result.current.status).toBe('notFound'));
  });

  it('is notFound (not an error) when the backend answers 403 for the team\'s sprints', async () => {
    mockBackend({ sprintsResult: Promise.reject(Object.assign(new Error('403'), { response: { status: 403 } })) });
    const { result } = await renderHook(() => useSprintRouteData('1', '10', 'tok'));
    await waitFor(() => expect(result.current.status).toBe('notFound'));
  });

  it('is notFound for non-numeric route params, without calling the backend', async () => {
    mockBackend();
    const { result } = await renderHook(() => useSprintRouteData('abc', 'xyz', 'tok'));
    await waitFor(() => expect(result.current.status).toBe('notFound'));
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('is error on a network failure, and retry() recovers', async () => {
    mockBackend({ teamsResult: Promise.reject(new Error('Network Error')) });
    const { result } = await renderHook(() => useSprintRouteData('1', '10', 'tok'));
    await waitFor(() => expect(result.current.status).toBe('error'));

    mockBackend();
    await act(async () => {
      result.current.retry();
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.sprint).toEqual(sprints[0]);
  });

  it('does not fetch until there is a token', async () => {
    mockBackend();
    const { result } = await renderHook(() => useSprintRouteData('1', '10', null));
    expect(result.current.status).toBe('loading');
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });
});
