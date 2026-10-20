import React from 'react';
import { Platform } from 'react-native';
import { useOnboarding } from './hooks/use-onboarding';
import { useTour } from './hooks/use-tour';
import { findManagedTeamId } from './onboarding-logic';

export { useQuickStart } from './hooks/use-quick-start';
export { useOnboarding } from './hooks/use-onboarding';

/**
 * Feature 21: the starter checklist + "what's new" card for the dashboard (above "המשימות שלי").
 * One fetch for both; `refreshKey` is the dashboard's refresh button. `teams` / `userId` only tell
 * us which team the management CTAs open.
 */
export function OnboardingSection(props: { token: string | null | undefined; refreshKey: number; teams: any[]; userId: number }) {
  const managedTeamId = findManagedTeamId(props.teams, props.userId);
  const onboarding = useOnboarding(props.token, props.refreshKey, managedTeamId);
  if (Platform.OS === 'web') {
    const { OnboardingChecklistWeb } = require('./components/onboarding-checklist-web');
    const { WhatsNewCardWeb } = require('./components/whats-new-card-web');
    return (
      <>
        <OnboardingChecklistWeb onboarding={onboarding} />
        <WhatsNewCardWeb onboarding={onboarding} />
      </>
    );
  }
  const { OnboardingChecklistNative } = require('./components/onboarding-checklist-native');
  const { WhatsNewCardNative } = require('./components/whats-new-card-native');
  return (
    <>
      <OnboardingChecklistNative onboarding={onboarding} />
      <WhatsNewCardNative onboarding={onboarding} />
    </>
  );
}

export { GuideProvider, useGuide } from './guide/guide-provider';
export { GuideAnchor } from '@/components/ui/guide-anchor';
export { emitGuideSignal } from './guide/guide-signals';

/**
 * Feature 22: the guide's entry button (three choices: basic guide, advanced guide, the textual
 * overview). Web renders it in the top bar; native, whose tab bar has no room, in the dashboard header.
 */
export function GuideMenu() {
  if (Platform.OS === 'web') {
    const { GuideMenuWeb } = require('./guide/guide-menu-web');
    return <GuideMenuWeb />;
  }
  const { GuideMenuNative } = require('./guide/guide-menu-native');
  return <GuideMenuNative />;
}

/**
 * "סיור במערכת": the header button (+ its stepped window) that lets an existing user walk through
 * what the system can do whenever they like. Nothing is stored on the server.
 */
export function TourButton(props: { teams: any[]; userId: number }) {
  const tour = useTour(findManagedTeamId(props.teams, props.userId));
  if (Platform.OS === 'web') {
    const { TourWeb } = require('./components/tour-web');
    return <TourWeb tour={tour} />;
  }
  const { TourNative } = require('./components/tour-native');
  return <TourNative tour={tour} />;
}
