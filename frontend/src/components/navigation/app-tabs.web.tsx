import React from 'react';
import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, View, TouchableOpacity, Platform, Image } from 'react-native';
import { ThemedText } from '../themed-text';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/design/theme-context';
import { Icon, type IconName } from '@/components/ui';
import { MaxContentWidth } from '@/constants/theme';

/** מיקום וגובה סרגל הניווט הצף (CustomTabList) — משמשים גם לחישוב ה-padding שמפנה לו מקום בתוכן המסך. */
const NAV_TOP = 14;
const NAV_HEIGHT = 62;
const NAV_CLEARANCE = NAV_TOP + NAV_HEIGHT;

export default function AppTabs() {
  const t = useTheme();
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
            <TabButton icon="home">ראשי</TabButton>
          </TabTrigger>
          <TabTrigger name="settings" href="/settings" asChild>
            <TabButton icon="settings">הגדרות</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, icon, ...props }: TabTriggerSlotProps & { icon?: IconName }) {
  const t = useTheme();

  return (
    <Pressable {...props} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: t.space[1],
          paddingBlock: t.space[2],
          paddingInline: t.space[4],
          minHeight: 40,
          borderRadius: t.radius.field,
          backgroundColor: isFocused ? t.color.accent.subtle : 'transparent',
          transition: `background-color ${t.motion.fast}`,
          cursor: 'pointer',
        }}
      >
        {icon && <Icon name={icon} size="sm" tone={isFocused ? 'accent' : 'muted'} />}
        <ThemedText
          type="smallBold"
          themeColor={isFocused ? 'text' : 'textSecondary'}
          style={{
            fontSize: t.type.label.fontSize,
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
  const t = useTheme();
  const { logout, user } = useAuth();

  return (
    <View
      {...props}
      style={{
        position: 'fixed' as any,
        top: NAV_TOP,
        left: 0,
        right: 0,
        height: NAV_HEIGHT,
        zIndex: 1000,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: t.radius.card,
        borderWidth: 1,
        borderColor: t.color.border,
        backgroundColor: t.color.surface,
        boxShadow: t.shadow.md,
        width: '94%',
        maxWidth: MaxContentWidth + 40,
        marginHorizontal: 'auto',
        direction: 'rtl',
      } as any}
    >
      <View
        style={{
          width: '100%',
          paddingInline: t.space[5],
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        } as any}
      >
        {/* Brand */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[2] } as any}>
          <Image source={require('../../../assets/images/app-logo.png')} style={{ width: 38, height: 38 }} resizeMode="contain" />
          <div className="nav-brand-text">
            <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 0 } as any}>
              <ThemedText style={{ fontFamily: t.type.rowTitle.fontFamily, fontSize: t.type.rowTitle.fontSize, fontWeight: '800', letterSpacing: -0.4, color: t.color.text }}>נווט לרט</ThemedText>
              <ThemedText style={{ fontFamily: t.type.overline.fontFamily, fontSize: t.type.overline.fontSize, fontWeight: '700', letterSpacing: 1.5, color: t.color.accent.base }}>RETRO BOARD</ThemedText>
            </View>
          </div>
        </View>

        {/* Navigation */}
        <View style={{ flexDirection: 'row', gap: t.space[1], alignItems: 'center' } as any}>
          {props.children}
        </View>

        {/* User & Logout */}
        {!!user ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[3] } as any}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[2] } as any}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: t.radius.field,
                  backgroundColor: t.color.accent.subtle,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: t.type.label.fontSize,
                  fontWeight: 700,
                  color: t.color.accent.base,
                  fontFamily: t.type.bodyStrong.fontFamily,
                }}
              >
                {(user.firstName?.[0] || user.email?.[0] || '?').toUpperCase()}
              </div>
              <div className="nav-user-text">
                <View>
                  <ThemedText style={{ fontSize: t.type.caption.fontSize, fontWeight: '600', color: t.color.text }}>
                    {user.firstName || user.email?.split('@')[0]}
                  </ThemedText>
                  <ThemedText style={{ fontSize: t.type.overline.fontSize, color: t.color.textSecondary, opacity: 0.7 }}>
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
                  paddingBlock: t.space[1],
                  paddingInline: t.space[3],
                  borderRadius: t.radius.field,
                  border: `1px solid ${t.color.border}`,
                  transition: `all ${t.motion.fast}`,
                  cursor: 'pointer',
                  fontSize: t.type.caption.fontSize,
                  fontWeight: 600,
                  color: t.color.textSecondary,
                  fontFamily: t.type.bodyStrong.fontFamily,
                }}
                onMouseEnter={(e) => {
                  const el = e.target as HTMLElement;
                  el.style.borderColor = t.color.status.danger.fg;
                  el.style.color = t.color.status.danger.fg;
                  el.style.background = t.color.status.danger.bg;
                }}
                onMouseLeave={(e) => {
                  const el = e.target as HTMLElement;
                  el.style.borderColor = t.color.border;
                  el.style.color = t.color.textSecondary;
                  el.style.background = 'transparent';
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
