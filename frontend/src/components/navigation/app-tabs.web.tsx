import React, { useState } from 'react';
import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, View, Platform, Image } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/design/theme-context';
import { Icon, type IconName } from '@/components/ui';
import { Strings } from '@/constants/strings';
import { triggerGoHome } from '@/features/dashboard/home-signal';
import { trackEvent } from '@/lib/analytics';
import { NavUserMenu, type NavUserMenuItem } from './nav-user-menu.web';
import { getNavStyles, NAV_CLEARANCE } from './app-tabs.styles';

export default function AppTabs() {
  const t = useTheme();
  const pathname = usePathname();
  // The sprint screens are routes inside the "ראשי" tab (BUG-33). The tab is already focused
  // there, so the trigger's own press is a no-op — send a click on "ראשי" back to the dashboard.
  const handleHomePress = () => {
    if (pathname?.startsWith('/team/')) router.navigate('/');
  };
  return (
    <Tabs>
      <TabSlot
        style={{
          flex: 1,
          height: '100vh',
          overflowY: Platform.OS === 'web' ? 'auto' : undefined,
          direction: 'rtl',
          paddingTop: NAV_CLEARANCE + t.space[4],
        } as any}
      />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            {/* A click leaves a sprint route for the dashboard (handleHomePress); double-click also
                resets the dashboard's team selection and refetches — see HIDDEN-DETAILS.md. */}
            <TabButton icon="home" onPress={handleHomePress} onDoubleClick={triggerGoHome}>{Strings.nav.home}</TabButton>
          </TabTrigger>
          <TabTrigger name="settings" href="/settings" asChild>
            <TabButton icon="settings">{Strings.nav.settings}</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, icon, onDoubleClick, onPress, ...props }: TabTriggerSlotProps & { icon?: IconName; onDoubleClick?: () => void }) {
  const t = useTheme();
  const s = getNavStyles(t);
  const [hovered, setHovered] = useState(false);

  const handlePress = (e: any) => {
    trackEvent('nav_tab_pressed', { tab: icon ?? 'unknown' });
    onPress?.(e);
  };

  return (
    <Pressable {...props} onPress={handlePress} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
      <div
        className={isFocused ? undefined : 'nav-tab-inactive'}
        onDoubleClick={onDoubleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={s.tab(!!isFocused, hovered)}
      >
        {icon && <Icon name={icon} size="md" tone={isFocused ? 'accent' : 'muted'} />}
        {/* ברוחב טלפון הטאב הלא-פעיל מצטמצם לאייקון (global-web-styles); התווית נשארת לקורא מסך. */}
        <span className="nav-tab-label" style={s.tabLabel(!!isFocused)}>{children}</span>
      </div>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const t = useTheme();
  const s = getNavStyles(t);
  const { logout, user } = useAuth();

  const menuItems: NavUserMenuItem[] = [
    { key: 'logout', label: Strings.nav.logout, icon: 'log-out', danger: true, onSelect: logout },
  ];
  const displayName = user ? user.firstName || user.email?.split('@')[0] || '' : '';

  return (
    <View {...props} style={s.bar}>
      <View style={s.barInner}>
        {/* Brand */}
        <div style={s.brand}>
          <Image source={require('../../../assets/images/app-logo.png')} style={{ width: 36, height: 36 }} resizeMode="contain" />
          <span className="nav-brand-text" style={s.brandText}>{Strings.nav.brand}</span>
        </div>

        <div className="nav-brand-text" style={s.divider} />

        {/* Navigation */}
        <View style={s.tabTrack} accessibilityRole={'navigation' as any} aria-label={Strings.nav.mainNavLabel}>
          {props.children}
        </View>

        <div style={{ flexGrow: 1 }} />

        {!!user && <NavUserMenu displayName={displayName} items={menuItems} />}
      </View>
    </View>
  );
}
