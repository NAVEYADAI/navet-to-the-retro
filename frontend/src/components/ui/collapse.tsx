import React from 'react';
import { Collapse as MuiCollapse } from '@mui/material';

/**
 * פתיחה/סגירה מונפשת של אזור שהמשתמש מחליף בלחיצה (למשל "ספרינטים שהסתיימו").
 * לא לשימוש בטעינת מסך — ר' UI-GUIDELINES §6. התוכן לא נטען ל-DOM כשהאזור סגור.
 * מי שביקש הפחתת תנועה במערכת ההפעלה מקבל החלפה מיידית.
 */
const DURATION_MS = 220;

export function Collapse({ open, children, id }: { open: boolean; children: React.ReactNode; id?: string }) {
  return (
    <MuiCollapse
      {...(id ? ({ id } as object) : {})}
      in={open}
      timeout={DURATION_MS}
      unmountOnExit
      sx={{ '@media (prefers-reduced-motion: reduce)': { transitionDuration: '0s !important' } }}
    >
      {children}
    </MuiCollapse>
  );
}
