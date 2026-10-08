import React from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@/design/theme-context';

export interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  /** 0 = כרטיס שמחולק לאזורים עם קו מפריד, וכל אזור מרפד את עצמו. */
  padding?: 0 | 4 | 5 | 6;
  /** מסגרת מקווקוות למצב ריק / הוספה */
  placeholder?: boolean;
}

/** וריאנט כרטיס אחד. אין צל בסיסי, אין פס צבע בקצה, אין גרדיאנט. */
export function Card({ children, onPress, padding = 5, placeholder }: CardProps) {
  const t = useTheme();
  return (
    <Box
      onClick={onPress}
      sx={{
        backgroundColor: placeholder ? 'transparent' : t.color.surface,
        border: `1px ${placeholder ? 'dashed' : 'solid'} ${placeholder ? t.color.borderStrong : t.color.border}`,
        borderRadius: `${t.radius.card}px`,
        padding: padding === 0 ? 0 : `${t.space[padding]}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: padding === 0 ? 0 : `${t.space[4]}px`,
        cursor: onPress ? 'pointer' : 'default',
        transition: `border-color ${t.motion.fast}, box-shadow ${t.motion.fast}`,
        ...(onPress
          ? { '&:hover': { borderColor: t.color.borderStrong, boxShadow: t.shadow.md } }
          : {}),
      }}
    >
      {children}
    </Box>
  );
}
