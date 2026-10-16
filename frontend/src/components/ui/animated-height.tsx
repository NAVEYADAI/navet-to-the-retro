import React, { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@/design/theme-context';

/**
 * עוטף תוכן שגובהו משתנה (החלפת לשונית, רשימה שנטענת, שגיאה שמופיעה) ומזיז את הגובה באנימציה
 * במקום לקפוץ. חלון/כרטיס שמכיל אותו גדל ומתכווץ יחד איתו. מכבד "הפחתת תנועה".
 * (ר' UI-GUIDELINES §6 — חריג לתנועה: שינוי שהמשתמש עצמו גרם לו.)
 */
const DURATION = '0.22s ease';
// Room for focus rings / shadows of the children, which `overflow: hidden` would otherwise clip.
const BLEED = 4;

export function AnimatedHeight({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const el = inner.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => setHeight(el.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Box
      sx={{
        height: height === null ? 'auto' : height + BLEED * 2,
        margin: `-${BLEED}px`,
        overflow: 'hidden',
        transition: `height ${DURATION}`,
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
      }}
    >
      <Box ref={inner} sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[4]}px`, padding: `${BLEED}px` }}>
        {children}
      </Box>
    </Box>
  );
}
