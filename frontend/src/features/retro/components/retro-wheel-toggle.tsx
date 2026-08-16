import React from 'react';
import { Box, Typography } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { Strings } from '@/constants/strings';

interface RetroWheelToggleProps {
  type: 'KEEP' | 'IMPROVE';
  toggleType: () => void;
  theme: {
    text: string;
    textSecondary: string;
  };
}

export function RetroWheelToggle({ type, toggleType, theme }: RetroWheelToggleProps) {
  const isKeep = type === 'KEEP';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 4, my: 1.5 }}>
      <motion.button
        type="button"
        onClick={toggleType}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        style={{
          width: 84,
          height: 84,
          borderRadius: '50%',
          border: '3px solid #ffffff',
          cursor: 'pointer',
          position: 'relative',
          padding: 0,
          overflow: 'hidden',
          background: isKeep
            ? 'linear-gradient(135deg, #00e676 0%, #059669 100%)'
            : 'linear-gradient(135deg, #ff1744 0%, #b71c1c 100%)',
          boxShadow: isKeep
            ? '0 0 24px rgba(0,230,118,0.5), 0 8px 20px rgba(0,0,0,0.25)'
            : '0 0 24px rgba(255,23,68,0.5), 0 8px 20px rgba(0,0,0,0.25)',
          transition: 'background 0.4s ease, box-shadow 0.4s ease',
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={type}
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: -90, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.35))',
            }}
          >
            {isKeep ? '👍' : '🔧'}
          </motion.span>
        </AnimatePresence>
      </motion.button>

      <Box sx={{ textAlign: 'right' }}>
        <Typography sx={{ fontSize: 12, color: theme.textSecondary, fontFamily: 'Rubik, sans-serif', mb: 0.5, fontWeight: 600 }}>
          {Strings.retroBoard.spinLabel}
        </Typography>
        <Typography sx={{
          fontSize: 20,
          fontWeight: 900,
          color: isKeep ? '#00c853' : '#ff1744',
          fontFamily: 'Rubik, sans-serif',
          letterSpacing: -0.5,
          textShadow: isKeep ? '0 2px 10px rgba(0,230,118,0.3)' : '0 2px 10px rgba(255,23,68,0.3)',
        }}>
          {isKeep ? `👍 ${Strings.retroBoard.keepLabel}` : `🔧 ${Strings.retroBoard.improveLabel}`}
        </Typography>
      </Box>
    </Box>
  );
}
