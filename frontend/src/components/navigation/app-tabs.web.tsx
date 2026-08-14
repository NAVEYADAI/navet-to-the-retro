import React, { useRef, useEffect } from 'react';
import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, useColorScheme, View, TouchableOpacity, Platform } from 'react-native';
import { ThemedText } from '../themed-text';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { navStyles } from './app-tabs.styles';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ flex: 1, minHeight: '100vh', overflowY: Platform.OS === 'web' ? 'auto' : undefined, direction: 'rtl' } as any} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton icon="🏠">ראשי</TabButton>
          </TabTrigger>
          <TabTrigger name="settings" href="/settings" asChild>
            <TabButton icon="⚙️">הגדרות</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, icon, ...props }: TabTriggerSlotProps & { icon?: string }) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  return (
    <Pressable {...props} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '7px 16px',
          borderRadius: 10,
          backgroundColor: isFocused
            ? (isDark ? 'rgba(129,140,248,0.15)' : 'rgba(99,102,241,0.08)')
            : 'transparent',
          transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
          cursor: 'pointer',
        }}
      >
        {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
        <ThemedText
          type="smallBold"
          themeColor={isFocused ? 'text' : 'textSecondary'}
          style={{
            fontSize: 13,
            fontWeight: isFocused ? '700' : '500',
            letterSpacing: -0.2,
          }}
        >
          {children}
        </ThemedText>
      </div>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const { logout, user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);

  const isDark = scheme === 'dark';

  useEffect(() => {
    if (Platform.OS === 'web' && containerRef.current) {
      const el = containerRef.current;
      el.style.backdropFilter = 'blur(20px) saturate(1.8)';
      (el.style as any).webkitBackdropFilter = 'blur(20px) saturate(1.8)';
      el.style.boxShadow = isDark
        ? '0 4px 30px rgba(0,0,0,0.4), 0 0 1px rgba(255,255,255,0.05) inset'
        : '0 4px 30px rgba(0,0,0,0.06), 0 0 1px rgba(255,255,255,0.8) inset';
      el.style.animation = 'navSlideIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both';
      el.style.transition = 'background 0.3s ease, border-color 0.3s ease';
    }
  }, [isDark]);

  return (
    <View
      {...props}
      ref={containerRef as any}
      style={[
        navStyles.tabListContainer,
        {
          backgroundColor: isDark ? 'rgba(10,10,18,0.82)' : 'rgba(255,255,255,0.78)',
          borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        },
      ]}
    >
      <View style={navStyles.innerContainer}>
        {/* Brand (Right side in RTL) */}
        <View style={navStyles.brandContainer}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: isDark
                ? 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)'
                : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
            }}
          >
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 16, fontFamily: 'Rubik, sans-serif' }}>R</span>
          </div>
          <div className="nav-brand-text">
            <View style={navStyles.brandTextBlock}>
              <ThemedText style={[navStyles.brandTitle, { color: colors.text }]}>לוח רטרו</ThemedText>
              <ThemedText style={[navStyles.brandSubtitle, { color: isDark ? '#818cf8' : '#6366f1' }]}>RETRO BOARD</ThemedText>
            </View>
          </div>
        </View>

        {/* Navigation */}
        <View style={navStyles.navLinks}>
          {props.children}
        </View>

        {/* User & Logout (Left side in RTL) */}
        {!!user ? (
          <View style={navStyles.leftActions}>
            <View style={navStyles.userInfo}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: isDark
                    ? 'linear-gradient(135deg, #334155 0%, #1e293b 100%)'
                    : 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  color: isDark ? '#818cf8' : '#4f46e5',
                  fontFamily: 'Rubik, sans-serif',
                }}
              >
                {(user.firstName?.[0] || user.email?.[0] || '?').toUpperCase()}
              </div>
              <div className="nav-user-text">
                <View>
                  <ThemedText style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>
                    {user.firstName || user.email?.split('@')[0]}
                  </ThemedText>
                  <ThemedText style={{ fontSize: 10, color: colors.textSecondary, opacity: 0.7 }}>
                    מחובר
                  </ThemedText>
                </View>
              </div>
            </View>
            <TouchableOpacity
              onPress={logout}
              activeOpacity={0.6}
            >
              <div
                style={{
                  padding: '5px 12px',
                  borderRadius: 8,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  color: colors.textSecondary,
                  fontFamily: 'Rubik, sans-serif',
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.borderColor = '#ef4444';
                  (e.target as HTMLElement).style.color = '#ef4444';
                  (e.target as HTMLElement).style.background = 'rgba(239,68,68,0.06)';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
                  (e.target as HTMLElement).style.color = colors.textSecondary;
                  (e.target as HTMLElement).style.background = 'transparent';
                }}
              >
                יציאה
              </div>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ width: 140 }} />
        )}
      </View>
    </View>
  );
}
