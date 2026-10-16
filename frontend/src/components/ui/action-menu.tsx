import React, { useState } from 'react';
import { Box, Menu, MenuItem } from '@mui/material';
import { useTheme } from '@/design/theme-context';
import { Icon, type IconName } from './icon';

export interface ActionMenuItem {
  key: string;
  label: string;
  icon?: IconName;
  /** `danger` צובע את הפריט כפעולה הרסנית ומפריד אותו מהשאר. */
  tone?: 'default' | 'danger';
  disabled?: boolean;
  onPress: () => void;
}

export interface ActionMenuProps {
  /** תווית נגישות לכפתור "⋯" — אין לו טקסט גלוי. */
  label: string;
  items: ActionMenuItem[];
  /** נקרא כשהתפריט נפתח — המקום ל-trackEvent. */
  onOpen?: () => void;
}

/**
 * פעולות משניות מאחורי כפתור "⋯" אחד, במקום שורה של כפתורים.
 * web: תפריט נפתח מהכפתור; native: גיליון תחתון (action-menu.native.tsx), אותו API.
 */
export function ActionMenu({ label, items, onOpen }: ActionMenuProps) {
  const t = useTheme();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <Box
        component="button"
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        onClick={(e: React.MouseEvent<HTMLElement>) => {
          onOpen?.();
          setAnchor(e.currentTarget);
        }}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: t.layout.minTouchTarget,
          height: t.layout.minTouchTarget,
          color: t.color.textSecondary,
          backgroundColor: anchor ? t.color.surfaceSubtle : 'transparent',
          border: `1px solid ${anchor ? t.color.borderStrong : 'transparent'}`,
          borderRadius: `${t.radius.field}px`,
          cursor: 'pointer',
          transition: `background-color ${t.motion.fast}`,
          '&:hover': { backgroundColor: t.color.surfaceSubtle },
          '&:focus-visible': { outline: `2px solid ${t.color.accent.border}`, outlineOffset: 1 },
        }}
      >
        <Icon name="more" size="md" tone="muted" />
      </Box>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {items.map((item, index) => {
          const isDanger = item.tone === 'danger';
          return (
            <MenuItem
              key={item.key}
              disabled={item.disabled}
              onClick={() => {
                setAnchor(null);
                item.onPress();
              }}
              sx={{
                ...t.type.body,
                gap: `${t.space[2]}px`,
                minHeight: t.layout.minTouchTarget,
                minWidth: 160,
                color: isDanger ? t.color.status.danger.fg : t.color.text,
                // פעולה הרסנית מופרדת מהשאר בקו, כדי שלא תילחץ בטעות.
                borderBlockStart: isDanger && index > 0 ? `1px solid ${t.color.border}` : undefined,
              }}
            >
              {item.icon ? <Icon name={item.icon} size="sm" tone={isDanger ? 'danger' : 'muted'} /> : null}
              {item.label}
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
