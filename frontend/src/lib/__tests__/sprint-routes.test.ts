import { router } from 'expo-router';
import { sprintPath, openSprint, goBackOr } from '../sprint-routes';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn() },
}));
const mockedRouter = router as jest.Mocked<typeof router>;

describe('sprint-routes (BUG-33)', () => {
  afterEach(() => jest.clearAllMocks());

  it('builds the board, summary and memory paths', () => {
    expect(sprintPath(3, 7)).toBe('/team/3/sprint/7');
    expect(sprintPath(3, 7, 'board')).toBe('/team/3/sprint/7');
    expect(sprintPath(3, 7, 'summary')).toBe('/team/3/sprint/7/summary');
    expect(sprintPath('3', '7', 'memory')).toBe('/team/3/sprint/7/memory');
  });

  it('openSprint pushes (so Back returns to where the user was)', () => {
    openSprint(3, 7, 'summary');
    expect(mockedRouter.push).toHaveBeenCalledWith('/team/3/sprint/7/summary');
  });

  it('goBackOr pops the stack when there is history', () => {
    mockedRouter.canGoBack.mockReturnValue(true);
    goBackOr('/');
    expect(mockedRouter.back).toHaveBeenCalled();
    expect(mockedRouter.replace).not.toHaveBeenCalled();
  });

  it('goBackOr replaces with the fallback after a refresh / deep link (no history)', () => {
    mockedRouter.canGoBack.mockReturnValue(false);
    goBackOr('/team/3/sprint/7');
    expect(mockedRouter.replace).toHaveBeenCalledWith('/team/3/sprint/7');
    expect(mockedRouter.back).not.toHaveBeenCalled();
  });
});
