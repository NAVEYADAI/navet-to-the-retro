import React from 'react';
import { View } from 'react-native';
import { Pencil, Trash2, Copy, ChevronDown, Plus, Check, X, UserPlus, MapPin, Link, Wrench, Eye, EyeOff, Home, Settings, Star, Target, Code, ShieldCheck, Infinity, LogOut } from 'lucide-react-native';
import { useTheme } from '@/design/theme-context';
import type { IconName, IconProps } from './icon';

export type { IconName, IconSize, IconTone, IconProps } from './icon';

const REGISTRY: Record<IconName, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  edit: Pencil,
  trash: Trash2,
  copy: Copy,
  'chevron-down': ChevronDown,
  plus: Plus,
  check: Check,
  x: X,
  'user-plus': UserPlus,
  'map-pin': MapPin,
  link: Link,
  wrench: Wrench,
  eye: Eye,
  'eye-off': EyeOff,
  home: Home,
  settings: Settings,
  star: Star,
  target: Target,
  code: Code,
  'shield-check': ShieldCheck,
  infinity: Infinity,
  'log-out': LogOut,
};

/** האייקון היחיד באפליקציה. שם מתוך הרשימה המורשית בלבד — אין ייבוא ישיר של lucide-react-native מחוץ לקובץ הזה. */
export function Icon({ name, size = 'md', tone = 'default', rotate }: IconProps) {
  const t = useTheme();
  const Cmp = REGISTRY[name];
  const px = t.iconSize[size];
  const color =
    tone === 'accent' ? t.color.accent.base
    : tone === 'danger' ? t.color.status.danger.fg
    : tone === 'success' ? t.color.status.success.fg
    : tone === 'muted' ? t.color.textMuted
    : tone === 'inverse' ? t.color.accent.onBase
    : t.color.text;

  if (rotate !== undefined) {
    return (
      <View style={{ transform: [{ rotate: `${rotate}deg` }] }}>
        <Cmp size={px} color={color} strokeWidth={1.75} />
      </View>
    );
  }

  return <Cmp size={px} color={color} strokeWidth={1.75} />;
}
