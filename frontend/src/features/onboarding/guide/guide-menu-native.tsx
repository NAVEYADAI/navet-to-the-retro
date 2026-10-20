import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Icon, Modal } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { useTour } from '../hooks/use-tour';
import { TourDialogNative } from '../components/tour-native';
import { rnText } from '../components/native-parts';
import { useGuide } from './guide-provider';
import type { GuideId } from './guide-types';

const G = Strings.onboarding.guide;

/** Native entry point (the native tab bar has no room for a button, so it lives in the dashboard header). */
export function GuideMenuNative() {
  const t = useTheme();
  const guide = useGuide();
  const tour = useTour(guide.managedTeamId);
  const [open, setOpen] = useState(false);

  const pick = (kind: GuideId | 'tour') => {
    setOpen(false);
    trackEvent('guide_menu_choice', { choice: kind });
    // The sheet has to be gone before the overlay appears, or the system modal would cover it.
    setTimeout(() => (kind === 'tour' ? tour.onOpen() : guide.start(kind)), 350);
  };

  const items: { key: GuideId | 'tour'; label: string; hint: string }[] = [
    { key: 'basic', label: G.menuBasic, hint: G.menuBasicHint },
    { key: 'advanced', label: G.menuAdvanced, hint: G.menuAdvancedHint },
    { key: 'tour', label: G.menuTour, hint: G.menuTourHint },
  ];

  return (
    <>
      <TouchableOpacity
        testID="guide-menu-open"
        accessibilityRole="button"
        accessibilityLabel={G.menuButton}
        onPress={() => { trackEvent('guide_menu_opened'); setOpen(true); }}
        style={{ width: t.layout.minTouchTarget, height: t.layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="map-pin" size="sm" tone="muted" />
      </TouchableOpacity>
      <Modal open={open} onClose={() => setOpen(false)} title={G.menuLabel} closeLabel={Strings.onboarding.tourClose}>
        <View style={{ gap: t.space[2] }}>
          {items.map((item) => (
            <TouchableOpacity
              key={item.key}
              testID={`guide-menu-${item.key}`}
              accessibilityRole="button"
              onPress={() => pick(item.key)}
              style={{ minHeight: t.layout.minTouchTarget, justifyContent: 'center', paddingVertical: t.space[2] }}
            >
              <Text style={[rnText(t.type.bodyStrong), { color: t.color.text, textAlign: 'right' }]}>{item.label}</Text>
              <Text style={[rnText(t.type.caption), { color: t.color.textSecondary, textAlign: 'right' }]}>{item.hint}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
      <TourDialogNative tour={tour} />
    </>
  );
}
