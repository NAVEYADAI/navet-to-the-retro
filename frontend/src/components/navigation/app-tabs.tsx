import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTheme } from '@/design/theme-context';

// The first trigger is the "(home)" group (dashboard + sprint routes, BUG-33), not a bare "index".
export default function AppTabs() {
  const t = useTheme();

  return (
    <NativeTabs
      backgroundColor={t.color.surface}
      indicatorColor={t.color.accent.subtle}
      labelStyle={{ selected: { color: t.color.text } }}>
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Label>ראשי</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>הגדרות</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
