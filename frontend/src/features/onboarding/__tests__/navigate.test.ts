import { router } from 'expo-router';
import { performCta } from '../navigate';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const hints = { teamId: 4, activeSprintId: 12 };

describe('performCta (feature 21)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens the running sprint board', () => {
    performCta('sprint-board', null, hints);
    expect(router.push).toHaveBeenLastCalledWith('/team/4/sprint/12');
  });

  it('does nothing when the target is unknown', () => {
    performCta('sprint-board', null, { teamId: 4, activeSprintId: null });
    performCta('sprint-board', null);
    expect(router.push).not.toHaveBeenCalled();
  });
});
