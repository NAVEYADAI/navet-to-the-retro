import React from 'react';
import { render } from '@testing-library/react-native';
import { MemoryCardNative } from '../memory-card-native';
import { Strings } from '@/constants/strings';

// Feature 13: an edited comment shows "נערכה" on its revealed face in the native memory game.
jest.setTimeout(30000);
jest.mock('react-native-gesture-handler', () => ({
  Gesture: { Tap: () => ({ numberOfTaps: () => ({ onEnd: () => ({}) , requireExternalGestureToFail: () => ({ onEnd: () => ({}) }) }) }), Exclusive: () => ({}) },
  GestureDetector: ({ children }: any) => children,
}));

const comment = (over: Record<string, unknown> = {}) => ({
  id: 1, content: 'הדמו עבר חלק', type: 'KEEP' as const, isAnonymous: false, author: { username: 'dev', firstName: 'דנה', lastName: 'לוי' },
  createdAt: '2026-08-04T12:00:00.000Z', ...over,
});

describe('MemoryCardNative — "נערכה" (feature 13)', () => {
  it('labels an edited comment', async () => {
    const { getByText } = await render(<MemoryCardNative comment={comment({ updatedAt: '2026-08-05T09:00:00.000Z' })} />);
    expect(getByText(new RegExp(Strings.retroBoard.editedLabel), { includeHiddenElements: true })).toBeTruthy();
  });

  it('does not label an untouched comment', async () => {
    const { queryByText } = await render(<MemoryCardNative comment={comment()} />);
    expect(queryByText(new RegExp(Strings.retroBoard.editedLabel), { includeHiddenElements: true })).toBeNull();
  });
});
