import React from 'react';
import { Pencil, Trash2, Copy, ChevronDown, Plus, Check, X, UserPlus, MapPin, Link, Wrench, Eye, EyeOff, Home, Settings, Star, Target, Code, ShieldCheck, Infinity, LogOut, Presentation, Download, RotateCw, Ghost, History, Tag } from 'lucide-react';
import { useTheme } from '@/design/theme-context';

export type IconName =
  | 'edit'
  | 'trash'
  | 'copy'
  | 'chevron-down'
  | 'plus'
  | 'check'
  | 'x'
  | 'user-plus'
  | 'map-pin'
  | 'link'
  | 'wrench'
  | 'eye'
  | 'eye-off'
  | 'home'
  | 'settings'
  | 'star'
  | 'target'
  | 'code'
  | 'shield-check'
  | 'infinity'
  | 'log-out'
  | 'presentation'
  | 'download'
  | 'refresh'
  | 'ghost'
  | 'history'
  | 'tag';

export type IconSize = 'sm' | 'md' | 'lg';
export type IconTone = 'default' | 'muted' | 'accent' | 'danger' | 'success' | 'inverse';

const REGISTRY: Record<IconName, React.ComponentType<React.SVGProps<SVGSVGElement> & { size?: number; color?: string; strokeWidth?: number }>> = {
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
  presentation: Presentation,
  download: Download,
  refresh: RotateCw,
  ghost: Ghost,
  history: History,
  tag: Tag,
};

export interface IconProps {
  name: IconName;
  size?: IconSize;
  tone?: IconTone;
  /** מסובב את האייקון (במעלות) — לשימוש בשברון מתהפך במקום החלפת שם אייקון. */
  rotate?: number;
}

/** האייקון היחיד באפליקציה. שם מתוך הרשימה המורשית בלבד — אין ייבוא ישיר של lucide מחוץ לקובץ הזה. */
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

  return (
    <Cmp
      size={px}
      color={color}
      strokeWidth={1.75}
      aria-hidden="true"
      style={rotate !== undefined ? { transform: `rotate(${rotate}deg)`, transition: `transform ${t.motion.fast}` } : undefined}
    />
  );
}
