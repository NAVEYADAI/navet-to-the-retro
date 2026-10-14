import React from 'react';
import { Platform } from 'react-native';
import { ActionItemsSectionNative } from './components/action-items-section-native';
import { MyActionItemsCardNative } from './components/my-action-items-card-native';
import type { ActionItemsSectionProps } from './components/action-items-section-web';

export type { ActionItemDraft } from './types';
export { draftTitleFromComment } from './action-items-logic';

/** Retro-board section: previous-retro strip + this sprint's tasks panel + create/edit form. */
export function ActionItemsSection(props: ActionItemsSectionProps) {
  if (Platform.OS === 'web') {
    const { ActionItemsSectionWeb } = require('./components/action-items-section-web');
    return <ActionItemsSectionWeb {...props} />;
  }
  return <ActionItemsSectionNative {...props} />;
}

/** Dashboard card: "המשימות שלי". */
export function MyActionItemsCard(props: { token: string | null | undefined; refreshKey: number }) {
  if (Platform.OS === 'web') {
    const { MyActionItemsCardWeb } = require('./components/my-action-items-card-web');
    return <MyActionItemsCardWeb {...props} />;
  }
  return <MyActionItemsCardNative {...props} />;
}
