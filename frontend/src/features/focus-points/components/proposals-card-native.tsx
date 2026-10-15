import React from 'react';
import { View } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { ActionButtonNative, CardNative, TextNative } from './native-parts';
import type { Proposal } from '../types';

const S = Strings.focusPoints;

export function ProposalsCardNative({ proposals, disabled, onCreate, onDismiss }: {
  proposals: Proposal[]; disabled: boolean; onCreate: (p: Proposal) => void; onDismiss: (p: Proposal) => void;
}) {
  const t = useTheme();
  return (
    <CardNative>
      <TextNative kind="title">{S.proposalsTitle}</TextNative>
      {proposals.length === 0 ? <TextNative kind="caption">{S.proposalsEmpty}</TextNative> : null}
      {proposals.map((p) => (
        <View key={p.commentId} style={{ gap: t.space[2], padding: t.space[3], borderWidth: 1, borderColor: t.color.border, borderRadius: t.radius.field }}>
          <TextNative>{p.content}</TextNative>
          <TextNative kind="caption">{`${S.proposerCount(p.proposerCount)} · ${S.sourceCommentOf(p.sprintName)}`}</TextNative>
          <View style={{ flexDirection: 'row-reverse', gap: t.space[2] }}>
            <View style={{ flex: 1 }}><ActionButtonNative label={S.createFromProposal} disabled={disabled} onPress={() => onCreate(p)} /></View>
            <View style={{ flex: 1 }}><ActionButtonNative variant="ghost" label={S.dismissProposal} disabled={disabled} onPress={() => onDismiss(p)} /></View>
          </View>
        </View>
      ))}
    </CardNative>
  );
}
