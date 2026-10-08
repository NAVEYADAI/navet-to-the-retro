import React from 'react';
import { Box, Dialog, Typography } from '@mui/material';
import { useTheme } from '@/design/theme-context';
import { Icon } from './icon';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** תווית נגישות לכפתור הסגירה */
  closeLabel: string;
  children: React.ReactNode;
}

/** חלון מעל הכל: כותרת + סגירה + תוכן. הדיאלוג היחיד באפליקציה (web). */
export function Modal({ open, onClose, title, subtitle, closeLabel, children }: ModalProps) {
  const t = useTheme();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      transitionDuration={150}
      slotProps={{
        backdrop: { sx: { backgroundColor: t.color.overlay } },
        paper: {
          sx: {
            backgroundColor: t.color.surface,
            backgroundImage: 'none',
            border: `1px solid ${t.color.border}`,
            borderRadius: `${t.radius.card}px`,
            boxShadow: t.shadow.md,
            margin: `${t.space[4]}px`,
            width: `calc(100% - ${t.space[5] * 2}px)`,
          },
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[4]}px`, padding: `${t.space[5]}px` }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: `${t.space[3]}px` }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography component="h2" sx={{ ...t.type.sectionTitle, color: t.color.text }}>
              {title}
            </Typography>
            {!!subtitle && (
              <Typography sx={{ ...t.type.caption, color: t.color.textSecondary }}>{subtitle}</Typography>
            )}
          </Box>
          <Box
            component="button"
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              width: t.layout.minTouchTarget,
              height: t.layout.minTouchTarget,
              marginBlockStart: `-${t.space[2]}px`,
              marginInlineEnd: `-${t.space[2]}px`,
              border: 'none',
              borderRadius: `${t.radius.field}px`,
              backgroundColor: 'transparent',
              cursor: 'pointer',
              transition: `background-color ${t.motion.fast}`,
              '&:hover': { backgroundColor: t.color.surfaceHover },
            }}
          >
            <Icon name="x" size="md" tone="muted" />
          </Box>
        </Box>
        {children}
      </Box>
    </Dialog>
  );
}
