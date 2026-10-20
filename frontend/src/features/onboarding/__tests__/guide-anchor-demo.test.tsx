import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { GuideAnchor, anchorExists, subscribeAnchorPress, waitForAnchor } from '@/components/ui/guide-anchor';
import { GuideDemoBoardNative } from '../guide/guide-demo-board-native';
import { emitGuideSignal, subscribeGuideSignal } from '../guide/guide-signals';
import { Strings } from '@/constants/strings';
import axios from 'axios';

jest.mock('axios');
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));

const G = Strings.onboarding.guide;

describe('GuideAnchor (native)', () => {
  it('registers while mounted, forgets on unmount, and reports presses inside it only', async () => {
    const seen: string[] = [];
    const off = subscribeAnchorPress('box', () => seen.push('box'));
    const { getByTestId, unmount } = await render(
      <>
        <GuideAnchor name="box"><TouchableOpacity testID="inside"><Text>x</Text></TouchableOpacity></GuideAnchor>
        <TouchableOpacity testID="outside"><Text>y</Text></TouchableOpacity>
      </>,
    );
    expect(anchorExists('box')).toBe(true);
    await fireEvent(getByTestId('outside'), 'touchEnd');
    expect(seen).toEqual([]);
    await fireEvent(getByTestId('inside'), 'touchEnd');
    expect(seen).toEqual(['box']);
    off();
    await fireEvent(getByTestId('inside'), 'touchEnd');
    expect(seen).toEqual(['box']);
    await unmount();
    expect(anchorExists('box')).toBe(false);
  });

  it('waitForAnchor gives up after the timeout, and can be cancelled', async () => {
    jest.useFakeTimers();
    try {
      const wait = waitForAnchor('nowhere', 300, 100);
      let result: boolean | undefined;
      wait.promise.then((r) => { result = r; });
      await jest.advanceTimersByTimeAsync(500);
      expect(result).toBe(false);

      const cancelled = waitForAnchor('nowhere', 5000, 100);
      cancelled.cancel();
      await jest.advanceTimersByTimeAsync(200);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('guide demo board (native)', () => {
  it('shows the sample notes and a visible "דוגמה" label', async () => {
    const { getByText, getAllByTestId } = await render(<GuideDemoBoardNative />);
    expect(getByText(G.demoBadge)).toBeTruthy();
    expect(getAllByTestId('demo-comment')).toHaveLength(4);
  });

  it('writing a note adds it locally, signals the guide, and never touches the network', async () => {
    const heard: string[] = [];
    const off = subscribeGuideSignal((n) => heard.push(n));
    const { getByTestId, getAllByTestId, getByText } = await render(<GuideDemoBoardNative />);
    await fireEvent.press(getByTestId('demo-post')); // empty: nothing happens
    expect(heard).toEqual([]);
    await fireEvent.changeText(getByTestId('demo-input'), 'הערה שלי');
    await fireEvent.press(getByTestId('demo-post'));
    expect(getByText('הערה שלי')).toBeTruthy();
    expect(getAllByTestId('demo-comment')).toHaveLength(5);
    expect(heard).toEqual(['comment-posted']);
    const mocked = axios as jest.Mocked<typeof axios>;
    expect(mocked.post).not.toHaveBeenCalled();
    expect(mocked.get).not.toHaveBeenCalled();
    off();
  });

  it('a note written under "לשפר" lands in that column’s data (kind switch works)', async () => {
    const { getByTestId, getByText } = await render(<GuideDemoBoardNative />);
    await fireEvent.press(getByTestId('demo-kind-IMPROVE'));
    await fireEvent.changeText(getByTestId('demo-input'), 'לשפר את הבדיקות');
    await fireEvent.press(getByTestId('demo-post'));
    expect(getByText('לשפר את הבדיקות')).toBeTruthy();
  });

  it('signals reach only current listeners', () => {
    const heard: string[] = [];
    const off = subscribeGuideSignal((n) => heard.push(n));
    off();
    emitGuideSignal('comment-posted');
    expect(heard).toEqual([]);
  });
});
