import React, { useEffect, useRef } from 'react';
import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, useColorScheme, View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { ThemedText } from './themed-text';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ flex: 1, minHeight: '100vh', overflowY: Platform.OS === 'web' ? 'auto' : undefined, direction: 'rtl' } as any} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton>ראשי</TabButton>
          </TabTrigger>
          <TabTrigger name="settings" href="/settings" asChild>
            <TabButton>הגדרות</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...props} style={({ pressed }) => [pressed && styles.pressed]}>
      <View
        style={[
          styles.tabButtonView,
          isFocused && styles.tabButtonViewActive,
        ]}
      >
        <ThemedText
          type="smallBold"
          themeColor={isFocused ? 'text' : 'textSecondary'}
          style={[styles.tabButtonText, isFocused && styles.tabButtonTextActive]}
        >
          {children}
        </ThemedText>
      </View>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const { logout, user } = useAuth();
  const navRef = useRef<View>(null);

  const isDark = scheme === 'dark';
  const navBg = isDark ? 'rgba(15, 15, 20, 0.85)' : 'rgba(255, 255, 255, 0.82)';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';

  return (
    <View
      {...props}
      ref={navRef}
      style={[
        styles.tabListContainer,
        {
          backgroundColor: navBg,
          borderColor,
        }
      ]}
    >
      <View style={styles.innerContainer}>
        {/* Brand (Right side in RTL) */}
        <View style={styles.brandContainer}>
          <View style={[styles.brandSquare, { backgroundColor: colors.text }]}>
            <ThemedText style={{ fontWeight: '800', fontSize: 14, color: colors.background, letterSpacing: -0.5 }}>R</ThemedText>
          </View>
          <View style={styles.brandTextBlock}>
            <ThemedText style={[styles.brandTitle, { color: colors.text }]}>לוח רטרו</ThemedText>
            <ThemedText style={[styles.brandSubtitle, { color: colors.textSecondary }]}>Retro Board</ThemedText>
          </View>
        </View>

        {/* Navigation */}
        <View style={styles.navLinks}>
          {props.children}
        </View>

        {/* User & Logout (Left side in RTL) */}
        {!!user ? (
          <View style={styles.leftActions}>
            <View style={styles.userInfo}>
              <ThemedText style={[styles.greetingLabel, { color: colors.textSecondary }]}>שלום,</ThemedText>
              <ThemedText style={[styles.greetingName, { color: colors.text }]}>
                {user.firstName || user.email?.split('@')[0]}
              </ThemedText>
            </View>
            <TouchableOpacity
              style={[styles.logoutButton, { borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }]}
              onPress={logout}
              activeOpacity={0.65}
            >
              <ThemedText style={[styles.logoutText, { color: colors.textSecondary }]}>יציאה</ThemedText>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ width: 120 }} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'fixed',
    top: 12,
    left: 0,
    right: 0,
    height: 60,
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    width: '92%',
    maxWidth: MaxContentWidth,
    marginHorizontal: 'auto',
    // Web-only CSS injection for blur + animation + shadow
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.05)',
      animation: 'navSlideIn 0.45s cubic-bezier(0.34,1.56,0.64,1) both',
    } as any : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
    }),
  },
  innerContainer: {
    width: '100%',
    paddingHorizontal: Spacing.three,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  brandSquare: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTextBlock: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 0,
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 18,
  },
  brandSubtitle: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.5,
    opacity: 0.5,
    lineHeight: 13,
    textTransform: 'uppercase',
  },
  navLinks: {
    flexDirection: 'row-reverse',
    gap: 4,
    alignItems: 'center',
  },
  leftActions: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: Spacing.two,
  },
  userInfo: {
    flexDirection: 'row-reverse',
    alignItems: 'baseline',
    gap: 4,
  },
  greetingLabel: {
    fontSize: 12,
    fontWeight: '400',
  },
  greetingName: {
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.65,
  },
  tabButtonView: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    ...(Platform.OS === 'web' ? {
      transition: 'background 0.18s ease, transform 0.15s ease',
    } as any : {}),
  },
  tabButtonViewActive: {
    backgroundColor: 'rgba(0,0,0,0.07)',
  },
  tabButtonText: {
    fontSize: 14,
  },
  tabButtonTextActive: {
    fontWeight: '700',
  },
  logoutButton: {
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 8,
    ...(Platform.OS === 'web' ? {
      transition: 'opacity 0.15s ease',
    } as any : {}),
  },
  logoutText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
