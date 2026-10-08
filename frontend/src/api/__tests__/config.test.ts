import { resolveWebBackendUrl, resolveNativeBackendUrl, parseHostUriHost } from '../config';

const PROD = 'https://navet-to-retro-backend.fly.dev';

describe('resolveWebBackendUrl (BUG-30)', () => {
  it('keeps localhost on the local backend', () => {
    expect(resolveWebBackendUrl('localhost', true)).toBe('http://localhost:5005');
    expect(resolveWebBackendUrl('app.localhost', true)).toBe('http://localhost:5005');
  });

  it('maps 127.0.0.1 and [::1] to a local backend instead of production', () => {
    expect(resolveWebBackendUrl('127.0.0.1', true)).toBe('http://127.0.0.1:5005');
    expect(resolveWebBackendUrl('[::1]', true)).toBe('http://[::1]:5005');
  });

  it('maps private LAN IPs to the same host on the backend port in dev', () => {
    expect(resolveWebBackendUrl('192.168.1.20', true)).toBe('http://192.168.1.20:5005');
    expect(resolveWebBackendUrl('10.0.0.7', true)).toBe('http://10.0.0.7:5005');
    expect(resolveWebBackendUrl('172.20.3.4', true)).toBe('http://172.20.3.4:5005');
  });

  it('does not treat LAN IPs as local in a production build, nor public/other hosts', () => {
    expect(resolveWebBackendUrl('192.168.1.20', false)).toBe(PROD);
    expect(resolveWebBackendUrl('172.32.0.1', true)).toBe(PROD);
    expect(resolveWebBackendUrl('navet-to-retro-frontend.fly.dev', true)).toBe(PROD);
    expect(resolveWebBackendUrl('localhost.evil.com', true)).toBe(PROD);
  });
});

describe('resolveNativeBackendUrl (BUG-30)', () => {
  it('derives the dev machine host from Expo hostUri so real devices on the LAN work', () => {
    expect(resolveNativeBackendUrl({ isDev: true, os: 'ios', hostUri: '192.168.1.20:8081' })).toBe('http://192.168.1.20:5005');
    expect(resolveNativeBackendUrl({ isDev: true, os: 'android', hostUri: '10.0.0.7:8081' })).toBe('http://10.0.0.7:5005');
    expect(resolveNativeBackendUrl({ isDev: true, os: 'ios', hostUri: 'my-mac.local:8081' })).toBe('http://my-mac.local:5005');
  });

  it('tolerates a scheme or path in hostUri', () => {
    expect(resolveNativeBackendUrl({ isDev: true, os: 'ios', hostUri: 'exp://192.168.1.20:8081/--/x' })).toBe('http://192.168.1.20:5005');
  });

  it('keeps localhost on the iOS simulator and uses 10.0.2.2 on the Android emulator', () => {
    expect(resolveNativeBackendUrl({ isDev: true, os: 'ios', hostUri: 'localhost:8081' })).toBe('http://localhost:5005');
    expect(resolveNativeBackendUrl({ isDev: true, os: 'ios', hostUri: null })).toBe('http://localhost:5005');
    expect(resolveNativeBackendUrl({ isDev: true, os: 'android', hostUri: 'localhost:8081' })).toBe('http://10.0.2.2:5005');
    expect(resolveNativeBackendUrl({ isDev: true, os: 'android', hostUri: '127.0.0.1:8081' })).toBe('http://10.0.2.2:5005');
    expect(resolveNativeBackendUrl({ isDev: true, os: 'android', hostUri: undefined })).toBe('http://10.0.2.2:5005');
  });

  it('ignores Expo tunnel hosts (they do not forward the backend port)', () => {
    expect(resolveNativeBackendUrl({ isDev: true, os: 'ios', hostUri: 'abc-anonymous-8081.exp.direct' })).toBe('http://localhost:5005');
    expect(resolveNativeBackendUrl({ isDev: true, os: 'android', hostUri: 'x.ngrok.io:443' })).toBe('http://10.0.2.2:5005');
  });

  it('leaves non-dev (production) builds on the historical default regardless of hostUri', () => {
    expect(resolveNativeBackendUrl({ isDev: false, os: 'ios', hostUri: '192.168.1.20:8081' })).toBe('http://localhost:5005');
    expect(resolveNativeBackendUrl({ isDev: false, os: 'android', hostUri: null })).toBe('http://localhost:5005');
  });
});

describe('parseHostUriHost', () => {
  it('extracts the host', () => {
    expect(parseHostUriHost('192.168.1.20:8081')).toBe('192.168.1.20');
    expect(parseHostUriHost('[::1]:8081')).toBe('[::1]');
    expect(parseHostUriHost('')).toBeNull();
    expect(parseHostUriHost(undefined)).toBeNull();
  });
});
