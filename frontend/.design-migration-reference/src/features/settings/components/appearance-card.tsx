import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme, usePreferences } from '@/design/theme-context';
import { accentSchemes, type AccentScheme } from '@/design/tokens';
import { Card, Segmented } from '@/components/ui';

const SCHEME_LABELS: Record<AccentScheme, string> = {
  blue: 'כחול',
  green: 'ירוק',
  purple: 'סגול',
  graphite: 'גרפיט',
};

/** ההעדפות האישיות של המשתמש. נשמרות מקומית ומוחלות על כל האפליקציה. */
export function AppearanceCard() {
  const t = useTheme();
  const { prefs, setPrefs } = usePreferences();

  const row = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: `${t.space[5]}px`,
  };

  return (
    <Card padding={5}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[1]}px` }}>
        <Typography component="h2" sx={{ ...t.type.cardTitle, color: t.color.text, margin: 0 }}>
          מראה
        </Typography>
        <Typography sx={{ ...t.type.caption, color: t.color.textMuted }}>
          נשמר לכל משתמש בנפרד ומוחל על כל האפליקציה
        </Typography>
      </Box>

      <Box sx={row}>
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <Typography sx={{ ...t.type.bodyStrong, color: t.color.text }}>מצב תצוגה</Typography>
          <Typography sx={{ ...t.type.caption, color: t.color.textMuted }}>
            ״מערכת״ עוקב אחרי הגדרות המכשיר
          </Typography>
        </Box>
        <Segmented
          value={prefs.mode}
          onChange={(mode) => setPrefs({ mode })}
          options={[
            { value: 'light', label: 'בהיר' },
            { value: 'dark', label: 'כהה' },
            { value: 'system', label: 'מערכת' },
          ]}
        />
      </Box>

      <Box sx={{ height: 1, backgroundColor: t.color.border }} />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[3]}px` }}>
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <Typography sx={{ ...t.type.bodyStrong, color: t.color.text }}>סכימת צבע</Typography>
          <Typography sx={{ ...t.type.caption, color: t.color.textMuted }}>
            משנה את האקסנט בלבד. הניטרלים נשארים זהים בכל הסכימות
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: `${t.space[2] + 2}px`, flexWrap: 'wrap' }}>
          {(Object.keys(accentSchemes) as AccentScheme[]).map((key) => {
            const active = prefs.scheme === key;
            return (
              <Box
                key={key}
                onClick={() => setPrefs({ scheme: key })}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: `${t.space[2]}px`,
                  paddingBlock: '9px',
                  paddingInline: `${t.space[3]}px`,
                  backgroundColor: active ? t.color.accent.subtle : t.color.surface,
                  border: `${active ? 1.5 : 1}px solid ${active ? t.color.accent.base : t.color.border}`,
                  borderRadius: `${t.radius.field}px`,
                  cursor: 'pointer',
                  '&:hover': { borderColor: active ? t.color.accent.base : t.color.borderStrong },
                }}
              >
                <Box
                  sx={{
                    width: 16,
                    height: 16,
                    borderRadius: '4px',
                    backgroundColor: accentSchemes[key].base,
                  }}
                />
                <Typography
                  sx={{
                    ...t.type.label,
                    fontFamily: t.type.overline.fontFamily,
                    fontWeight: active ? 600 : 500,
                    color: active ? t.color.text : t.color.textSecondary,
                  }}
                >
                  {SCHEME_LABELS[key]}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>

      <Box sx={{ height: 1, backgroundColor: t.color.border }} />

      <Box sx={row}>
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <Typography sx={{ ...t.type.bodyStrong, color: t.color.text }}>צפיפות</Typography>
          <Typography sx={{ ...t.type.caption, color: t.color.textMuted }}>
            מכפיל את סקאלת הריווח, לא את גדלי הגופן
          </Typography>
        </Box>
        <Segmented
          value={prefs.density}
          onChange={(density) => setPrefs({ density })}
          options={[
            { value: 'compact', label: 'קומפקטי' },
            { value: 'regular', label: 'רגיל' },
          ]}
        />
      </Box>
    </Card>
  );
}
