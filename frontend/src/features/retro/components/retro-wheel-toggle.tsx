import React from 'react';
import { Box, Typography } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Icon } from '@/components/ui';

interface RetroWheelToggleProps {
  type: 'KEEP' | 'IMPROVE';
  toggleType: () => void;
}

export function RetroWheelToggle({ type, toggleType }: RetroWheelToggleProps) {
  const t = useTheme();
  const isKeep = type === 'KEEP';
  const tone = isKeep ? t.color.status.success : t.color.status.danger;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: `${t.space[4]}px`, marginBlock: `${t.space[3]}px` }}>
      <Box
        component="button"
        type="button"
        onClick={toggleType}
        aria-label={Strings.retroBoard.spinLabel}
        sx={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          border: `2px solid ${tone.border}`,
          backgroundColor: tone.bg,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          transition: `background-color ${t.motion.fast}, border-color ${t.motion.fast}, transform ${t.motion.fast}`,
          '&:hover': { borderColor: tone.fg },
          '&:active': { transform: 'scale(0.94)' },
          '&:focus-visible': { outline: `2px solid ${t.color.accent.border}`, outlineOffset: 2 },
          perspective: 600,
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={type}
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: -90, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{ display: 'flex', backfaceVisibility: 'hidden' }}
          >
            <Icon name={isKeep ? 'check' : 'wrench'} tone={isKeep ? 'success' : 'danger'} size="lg" />
          </motion.span>
        </AnimatePresence>
      </Box>

      <Box sx={{ textAlign: 'start' }}>
        <Typography sx={{ ...t.type.caption, fontWeight: 600, color: t.color.textSecondary, marginBlockEnd: `${t.space[1]}px` }}>
          {Strings.retroBoard.spinLabel}
        </Typography>
        <Typography sx={{ ...t.type.cardTitle, fontWeight: 800, color: tone.fg }}>
          {isKeep ? Strings.retroBoard.keepLabel : Strings.retroBoard.improveLabel}
        </Typography>
      </Box>
    </Box>
  );
}
