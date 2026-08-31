import React, { useState } from 'react';
import { Box, TextField, MenuItem, Typography, IconButton, InputAdornment } from '@mui/material';
import { useTheme } from '@/design/theme-context';
import { Icon } from './icon';
import { Strings } from '@/constants/strings';

type FieldType = 'text' | 'email' | 'password' | 'date' | 'number' | 'textarea' | 'select';

export interface FieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  type?: FieldType;
  placeholder?: string;
  error?: string | null;
  hint?: string;
  disabled?: boolean;
  required?: boolean;
  rows?: number;
  options?: { value: string; label: string }[];
}

/**
 * הקלט היחיד באפליקציה — כל סוגי השדות עוברים דרך כאן.
 * שינוי גובה, רדיוס או מצב focus נעשה פעם אחת בקובץ הזה.
 */
export function Field({
  label,
  value,
  onChangeText,
  type = 'text',
  placeholder,
  error,
  hint,
  disabled,
  required,
  rows = 4,
  options = [],
}: FieldProps) {
  const t = useTheme();
  const borderColor = error ? t.color.status.danger.fg : t.color.borderStrong;
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[1] + 2}px` }}>
      <Typography
        component="label"
        sx={{ ...t.type.label, color: error ? t.color.status.danger.fg : t.color.textSecondary }}
      >
        {label}
        {required ? ' *' : ''}
      </Typography>

      <TextField
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChangeText(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        select={type === 'select'}
        multiline={type === 'textarea'}
        minRows={type === 'textarea' ? rows : undefined}
        type={isPassword ? (showPassword ? 'text' : 'password') : type === 'select' || type === 'textarea' ? undefined : type}
        size="small"
        slotProps={
          isPassword
            ? {
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword((v) => !v)}
                        edge="end"
                        size="small"
                        aria-label={showPassword ? Strings.auth.hidePasswordLabel : Strings.auth.showPasswordLabel}
                      >
                        <Icon name={showPassword ? 'eye-off' : 'eye'} size="sm" tone="muted" />
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }
            : undefined
        }
        sx={{
          '& .MuiInputBase-root': {
            ...t.type.body,
            color: t.color.text,
            backgroundColor: t.color.surface,
            borderRadius: `${t.radius.field}px`,
            paddingBlock: '2px',
          },
          '& .MuiInputBase-input': { textAlign: 'start', paddingBlock: '9px' },
          '& fieldset': { borderColor },
          '&:hover fieldset': { borderColor: error ? t.color.status.danger.fg : t.color.textMuted },
          '& .Mui-focused fieldset': {
            borderColor: error ? t.color.status.danger.fg : t.color.accent.base,
            borderWidth: '1.5px',
          },
          '& .Mui-disabled': { backgroundColor: t.color.surfaceSubtle },
        }}
      >
        {type === 'select'
          ? options.map((o) => (
              <MenuItem key={o.value} value={o.value} sx={{ ...t.type.body }}>
                {o.label}
              </MenuItem>
            ))
          : null}
      </TextField>

      {error || hint ? (
        <Typography sx={{ ...t.type.caption, color: error ? t.color.status.danger.fg : t.color.textMuted }}>
          {error || hint}
        </Typography>
      ) : null}
    </Box>
  );
}
