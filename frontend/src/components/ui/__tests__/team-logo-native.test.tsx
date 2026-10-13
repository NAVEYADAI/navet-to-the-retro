import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { SessionTokenContext } from '@/context/session-token-context';
import { TeamLogo } from '../team-logo.native';

// expo-image is a native view; a plain host view that carries `source` is enough to assert on.
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: (props: any) => <View testID={props.testID ?? 'expo-image'} source={props.source} /> };
});

const hidden = { includeHiddenElements: true };

const withToken = (el: React.ReactElement, token: string | null = 'tok') => (
  <SessionTokenContext.Provider value={token}>{el}</SessionTokenContext.Provider>
);

describe('TeamLogo (native, feature 19)', () => {
  it('without a logo shows the letter fallback', async () => {
    await render(withToken(<TeamLogo teamId={1} name="פיתוח" logoUpdatedAt={null} />));
    expect(screen.getByTestId('team-logo-fallback', hidden)).toBeTruthy();
    expect(screen.getByText('פ', hidden)).toBeTruthy();
  });

  it('with a logo, expo-image gets the versioned URL and the Authorization header', async () => {
    await render(withToken(<TeamLogo teamId={4} name="פיתוח" logoUpdatedAt="v1" />));
    const source = screen.getByTestId('expo-image').props.source;
    expect(source.uri).toContain('/teams/4/logo?v=v1');
    expect(source.headers).toEqual({ Authorization: 'Bearer tok' });
  });

  it('an invite token uses the public URL with no headers', async () => {
    await render(<TeamLogo teamId={0} name="פיתוח" logoUpdatedAt="v1" inviteToken="tok-1" />);
    const source = screen.getByTestId('expo-image').props.source;
    expect(source.uri).toContain('/invites/tok-1/logo?v=v1');
    expect(source.headers).toBeUndefined();
  });

  it('shows the fallback instead of a request when there is no session', async () => {
    await render(withToken(<TeamLogo teamId={4} name="פיתוח" logoUpdatedAt="v1" />, null));
    expect(screen.getByTestId('team-logo-fallback', hidden)).toBeTruthy();
    expect(screen.queryByTestId('expo-image')).toBeNull();
  });

  it('marker renders nothing without a logo, and the watermark only with one', async () => {
    await render(withToken(<TeamLogo teamId={1} name="פיתוח" logoUpdatedAt={null} marker />));
    expect(screen.queryByTestId('team-logo')).toBeNull();
    expect(screen.queryByTestId('team-logo-fallback', hidden)).toBeNull();

    await render(withToken(<TeamLogo teamId={1} name="פיתוח" logoUpdatedAt={null} watermark />));
    expect(screen.queryByTestId('team-logo-watermark')).toBeNull();

    await render(withToken(<TeamLogo teamId={1} name="פיתוח" logoUpdatedAt="v1" watermark />));
    expect(screen.getByTestId('team-logo-watermark')).toBeTruthy();
  });
});
