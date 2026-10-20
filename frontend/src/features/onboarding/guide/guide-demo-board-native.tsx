import React, { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { trackEvent } from '@/lib/analytics';
import { ActionButtonNative, CardNative, PillNative, rnText } from '../components/native-parts';
import { GuideAnchor } from '@/components/ui/guide-anchor';
import { emitGuideSignal } from './guide-signals';

const G = Strings.onboarding.guide;

type Kind = 'KEEP' | 'IMPROVE';
interface DemoComment { id: string; kind: Kind; text: string }

const SEED: DemoComment[] = [
  ...G.demoComments.keep.map((text, i): DemoComment => ({ id: `k${i}`, kind: 'KEEP', text })),
  ...G.demoComments.improve.map((text, i): DemoComment => ({ id: `i${i}`, kind: 'IMPROVE', text })),
];

/** Native twin of guide-demo-board-web: client-side only, nothing is sent or saved (§22.0 default #12). */
export function GuideDemoBoardNative() {
  const t = useTheme();
  const [comments, setComments] = useState<DemoComment[]>(SEED);
  const [kind, setKind] = useState<Kind>('KEEP');
  const [text, setText] = useState('');

  const post = () => {
    const value = text.trim();
    if (!value) return;
    trackEvent('guide_demo_comment_posted', { kind });
    setComments((c) => [{ id: `n${c.length}`, kind, text: value }, ...c]);
    setText('');
    emitGuideSignal('comment-posted');
  };

  const kindButton = (k: Kind, label: string) => (
    <TouchableOpacity
      key={k}
      testID={`demo-kind-${k}`}
      accessibilityRole="button"
      onPress={() => setKind(k)}
      style={{
        flex: 1, minHeight: t.layout.minTouchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: t.radius.field, borderWidth: 1,
        borderColor: kind === k ? t.color.accent.border : t.color.border, backgroundColor: kind === k ? t.color.accent.subtle : t.color.surface,
      }}
    >
      <Text style={[rnText(t.type.label), { color: kind === k ? t.color.accent.base : t.color.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );

  const column = (k: Kind, label: string) => {
    const items = comments.filter((c) => c.kind === k);
    return (
      <View key={k} style={{ gap: t.space[2] }}>
        <Text style={[rnText(t.type.label), { color: t.color.textSecondary, textAlign: 'right' }]}>{label}</Text>
        {items.length === 0 ? <Text style={[rnText(t.type.caption), { color: t.color.textSecondary, textAlign: 'right' }]}>{G.demoEmpty}</Text> : null}
        {items.map((c) => (
          <View key={c.id} testID="demo-comment" style={{ padding: t.space[3], borderWidth: 1, borderColor: t.color.border, borderRadius: t.radius.field, backgroundColor: t.color.surfaceSubtle }}>
            <Text style={[rnText(t.type.body), { color: t.color.text, textAlign: 'right' }]}>{c.text}</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <ScrollView testID="guide-demo-board" contentContainerStyle={{ padding: t.space[4], gap: t.space[3] }} keyboardShouldPersistTaps="handled">
      <CardNative>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: t.space[2] }}>
          <Text style={[rnText(t.type.cardTitle), { color: t.color.text, textAlign: 'right' }]}>{G.demoTitle}</Text>
          <PillNative tone="neutral" label={G.demoBadge} />
        </View>
        <GuideAnchor name="demo-compose">
          <View style={{ gap: t.space[3] }}>
            <View style={{ flexDirection: 'row-reverse', gap: t.space[2] }}>
              {kindButton('KEEP', G.demoKeepLabel)}
              {kindButton('IMPROVE', G.demoImproveLabel)}
            </View>
            <TextInput
              testID="demo-input"
              value={text}
              onChangeText={setText}
              multiline
              placeholder={kind === 'KEEP' ? G.demoKeepPlaceholder : G.demoImprovePlaceholder}
              placeholderTextColor={t.color.textMuted}
              style={[rnText(t.type.body), { minHeight: 64, padding: t.space[3], textAlign: 'right', textAlignVertical: 'top', color: t.color.text, borderWidth: 1, borderColor: t.color.borderStrong, borderRadius: t.radius.field, backgroundColor: t.color.surface }]}
            />
            <ActionButtonNative testID="demo-post" label={G.demoPostButton} onPress={post} />
          </View>
        </GuideAnchor>
      </CardNative>
      <GuideAnchor name="demo-comments">
        <View style={{ gap: t.space[3], padding: t.space[3], borderWidth: 1, borderColor: t.color.border, borderRadius: t.radius.card, backgroundColor: t.color.surface }}>
          {column('KEEP', G.demoKeepLabel)}
          {column('IMPROVE', G.demoImproveLabel)}
        </View>
      </GuideAnchor>
    </ScrollView>
  );
}
