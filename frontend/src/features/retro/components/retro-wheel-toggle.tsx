import React from 'react';
import { Box, Typography } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { Strings } from '@/constants/strings';

interface RetroWheelToggleProps {
  type: 'KEEP' | 'IMPROVE';
  toggleType: () => void;
  clickSide: 'left' | 'right';
  theme: {
    text: string;
    textSecondary: string;
  };
}

export function RetroWheelToggle({ type, toggleType, clickSide, theme }: RetroWheelToggleProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 4, my: 1.5 }}>
      <motion.div
        onClick={toggleType}
        whileHover={{ scale: 1.12 }}
        whileTap={{ scale: 0.9 }}
        style={{
          width: 108,
          height: 108,
          borderRadius: '50%',
          overflow: 'hidden',
          border: '4px solid #ffffff',
          position: 'relative',
          cursor: 'pointer',
          boxShadow: type === 'KEEP'
            ? '0 0 30px rgba(0,230,118,0.6), 0 8px 30px rgba(0,0,0,0.25)'
            : '0 0 30px rgba(255,23,68,0.6), 0 8px 30px rgba(0,0,0,0.25)',
          transition: 'box-shadow 0.4s ease',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Inner Rotating Background Halves & Icons */}
        <motion.div
          animate={{ rotate: type === 'KEEP' ? 0 : 180 }}
          transition={{ type: 'spring', stiffness: 180, damping: 18 }}
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Top Half: KEEP */}
          <div style={{
            height: '50%',
            background: 'linear-gradient(135deg, #00e676 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <motion.div
              animate={{ rotate: type === 'KEEP' ? 0 : -180 }}
              transition={{ type: 'spring', stiffness: 180, damping: 18 }}
              style={{ zIndex: 5 }}
            >
              <span style={{ fontSize: 28, filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.4))' }}>👍</span>
            </motion.div>
          </div>

          {/* Bottom Half: IMPROVE */}
          <div style={{
            height: '50%',
            background: 'linear-gradient(135deg, #ff1744 0%, #b71c1c 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <motion.div
              animate={{ rotate: type === 'KEEP' ? 0 : -180 }}
              transition={{ type: 'spring', stiffness: 180, damping: 18 }}
              style={{ zIndex: 5 }}
            >
              <span style={{ fontSize: 28, filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.4))' }}>🔧</span>
            </motion.div>
          </div>
        </motion.div>

        {/* Sand Dune Layer */}
        <motion.div
          key={`sand-dune-${type}-${clickSide}`}
          initial={{
            height: '0%',
            rotate: clickSide === 'left' ? -20 : 20,
            borderRadius: clickSide === 'left' ? '70% 30% 0 0' : '30% 70% 0 0',
          }}
          animate={{
            height: ['0%', '52%', '42%', '45%'],
            rotate: clickSide === 'left'
              ? [-20, 6, -2, 0]
              : [20, -6, 2, 0],
            borderRadius: clickSide === 'left'
              ? ['70% 30% 0 0', '40% 60% 0 0', '48% 52% 0 0', '50% 50% 0 0']
              : ['30% 70% 0 0', '60% 40% 0 0', '52% 48% 0 0', '50% 50% 0 0'],
          }}
          transition={{
            duration: 0.8,
            ease: [0.34, 1.5, 0.64, 1],
          }}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 2,
            pointerEvents: 'none',
            overflow: 'hidden',
            background: type === 'KEEP'
              ? 'linear-gradient(180deg, rgba(254,202,202,0.94) 0%, rgba(239,68,68,0.96) 50%, rgba(185,28,28,0.96) 100%)'
              : 'linear-gradient(180deg, rgba(167,243,208,0.94) 0%, rgba(16,185,129,0.96) 50%, rgba(4,120,87,0.96) 100%)',
            boxShadow: 'inset 0 4px 10px rgba(255,255,255,0.7), 0 -2px 8px rgba(0,0,0,0.2)',
            transformOrigin: 'bottom center',
          }}
        />

        {/* Sand Waterfall Cascade */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`cascade-stream-${type}-${clickSide}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: [0, 44, 0],
              opacity: [0, 1, 0],
            }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: '46%',
              left: '50%',
              x: '-50%',
              width: 5,
              borderRadius: 3,
              background: type === 'KEEP'
                ? 'linear-gradient(180deg, #fecdd3 0%, #ef4444 100%)'
                : 'linear-gradient(180deg, #a7f3d0 0%, #10b981 100%)',
              boxShadow: `0 0 10px ${type === 'KEEP' ? '#ef4444' : '#10b981'}`,
              zIndex: 3,
              pointerEvents: 'none',
              transformOrigin: 'top center',
            }}
          />
        </AnimatePresence>

        {/* Center Glass Funnel Bead */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 22,
            height: 22,
            borderRadius: '50%',
            backgroundColor: '#ffffff',
            boxShadow: '0 0 12px rgba(255,255,255,0.95), inset 0 2px 4px rgba(0,0,0,0.25)',
            zIndex: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <motion.div
            animate={{ scale: [0.8, 1.2, 0.8] }}
            transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: type === 'KEEP' ? '#ef4444' : '#10b981',
              boxShadow: `0 0 8px ${type === 'KEEP' ? '#ef4444' : '#10b981'}`,
            }}
          />
        </div>
      </motion.div>

      <Box sx={{ textAlign: 'right' }}>
        <Typography sx={{ fontSize: 12, color: theme.textSecondary, fontFamily: 'Rubik, sans-serif', mb: 0.5, fontWeight: 600 }}>
          {Strings.retroBoard.spinLabel} ⏳
        </Typography>
        <Typography sx={{
          fontSize: 20,
          fontWeight: 900,
          color: type === 'KEEP' ? '#00c853' : '#ff1744',
          fontFamily: 'Rubik, sans-serif',
          letterSpacing: -0.5,
          textShadow: type === 'KEEP' ? '0 2px 10px rgba(0,230,118,0.3)' : '0 2px 10px rgba(255,23,68,0.3)',
        }}>
          {type === 'KEEP' ? `👍 ${Strings.retroBoard.keepLabel}` : `🔧 ${Strings.retroBoard.improveLabel}`}
        </Typography>
      </Box>
    </Box>
  );
}
