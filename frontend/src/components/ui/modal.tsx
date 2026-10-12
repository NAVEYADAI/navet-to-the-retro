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

/**
 * חלון מעל הכל: כותרת + סגירה + תוכן. הדיאלוג היחיד באפליקציה (web).
 * בטלפון הוא גיליון תחתון (כמו modal.native.tsx) — צמוד לתחתית, ברוחב מלא, עם ידית.
 */
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
        container: { sx: { alignItems: { xs: 'flex-end', sm: 'center' } } },
        paper: {
          sx: {
            backgroundColor: t.color.surface,
            backgroundImage: 'none',
            border: `1px solid ${t.color.border}`,
            borderBlockEnd: { xs: 'none', sm: `1px solid ${t.color.border}` },
            borderRadius: { xs: `${t.radius.card}px ${t.radius.card}px 0 0`, sm: `${t.radius.card}px` },
            boxShadow: t.shadow.md,
            margin: { xs: 0, sm: `${t.space[4]}px` },
            width: { xs: '100%', sm: `calc(100% - ${t.space[5] * 2}px)` },
            maxWidth: { xs: '100%', sm: 444 },
            maxHeight: { xs: '90%', sm: `calc(100% - ${t.space[6] * 2}px)` },
          },
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: `${t.space[4]}px`,
          padding: { xs: `${t.space[3]}px ${t.space[4]}px ${t.space[5]}px`, sm: `${t.space[5]}px` },
        }}
      >
        {/* ידית הגיליון — קישוט בלבד, רק בטלפון. */}
        <Box aria-hidden sx={{ display: { xs: 'block', sm: 'none' }, alignSelf: 'center', width: 40, height: 4, borderRadius: `${t.radius.pill}px`, backgroundColor: t.color.borderStrong }} />
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
