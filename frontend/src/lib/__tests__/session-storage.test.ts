import AsyncStorage from '@react-native-async-storage/async-storage';

const freshModule = (): typeof import('../session-storage') => {
  let mod: typeof import('../session-storage');
  jest.isolateModules(() => {
    // Share the one AsyncStorage instance across "launches"; only the module's memory copy resets.
    jest.doMock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: AsyncStorage }));
    mod = require('../session-storage');
  });
  return mod!;
};

describe('sessionStorage (native, BUG-30)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.restoreAllMocks();
  });

  it('persists the token so a fresh module instance (app relaunch) can read it', async () => {
    await freshModule().sessionStorage.setItem('userToken', 'tok-1');
    // A brand-new module instance has an empty in-memory copy, so this only passes via AsyncStorage.
    expect(await freshModule().sessionStorage.getItem('userToken')).toBe('tok-1');
    expect(await AsyncStorage.getItem('userToken')).toBe('tok-1');
  });

  it('returns null when nothing is stored', async () => {
    expect(await freshModule().sessionStorage.getItem('userToken')).toBeNull();
  });

  it('removeItem clears both the persisted and the in-memory copy', async () => {
    const { sessionStorage } = freshModule();
    await sessionStorage.setItem('userToken', 'tok-1');
    await sessionStorage.removeItem('userToken');
    expect(await AsyncStorage.getItem('userToken')).toBeNull();
    expect(await sessionStorage.getItem('userToken')).toBeNull();
    expect(await freshModule().sessionStorage.getItem('userToken')).toBeNull();
  });

  it('falls back to memory when AsyncStorage throws, instead of failing login', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValue(new Error('disk full'));
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValue(new Error('unavailable'));
    const { sessionStorage } = freshModule();
    await expect(sessionStorage.setItem('userToken', 'tok-2')).resolves.toBeUndefined();
    expect(await sessionStorage.getItem('userToken')).toBe('tok-2');
  });
});
