import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme } from '@/design/theme-context';

/**
 * הפתרון ל״דברים זזים לי ימינה ושמאלה״:
 * כל מסך עטוף ב-Page, מכולה בעלת רוחב קבוע וממורכזת.
 * PageHeader מחזיק כותרת + תיאור + פעולה אחת, באותו מקום בכל מסך.
 */
export function Page({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Box sx={{ backgroundColor: t.color.bg, minHeight: '100%' }}>
      <Box
        sx={{
          maxWidth: t.layout.container,
          marginInline: 'auto',
          paddingInline: `${t.layout.pagePaddingInline}px`,
          paddingBlock: `${t.space[6]}px`,
          display: 'flex',
          flexDirection: 'column',
          gap: `${t.space[5]}px`,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: `${t.space[5]}px` }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[1] + 2}px` }}>
        <Typography component="h1" sx={{ ...t.type.pageTitle, color: t.color.text, margin: 0 }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography sx={{ ...t.type.body, color: t.color.textSecondary }}>{subtitle}</Typography>
        ) : null}
      </Box>
      {action}
    </Box>
  );
}

/** רשת עם מספר טורים קבוע — פיצ׳ר חדש נכנס כתא, לא מזיז את השאר. */
export function Grid({ columns = 3, children }: { columns?: 2 | 3 | 4; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: `${t.layout.gridGap}px` }}>
      {children}
    </Box>
  );
}
