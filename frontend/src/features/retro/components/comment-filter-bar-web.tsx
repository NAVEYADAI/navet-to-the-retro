import React from 'react';
import { Strings } from '@/constants/strings';
import { Box, Select, MenuItem, Checkbox, ListItemText, TextField, Button, type SelectChangeEvent } from '@mui/material';

interface CommentFilterBarWebProps {
  categories: string[];
  onCategoriesChange: (values: string[]) => void;
  searchText: string;
  onSearchTextChange: (value: string) => void;
  theme: {
    text: string;
    background: string;
    backgroundElement: string;
    backgroundSelected: string;
    textSecondary: string;
  };
}

export function CommentFilterBarWeb({ categories, onCategoriesChange, searchText, onSearchTextChange, theme }: CommentFilterBarWebProps) {
  const isFilterActive = categories.length > 0 || !!searchText.trim();

  const handleChange = (e: SelectChangeEvent<string[]>) => {
    const value = e.target.value;
    onCategoriesChange(typeof value === 'string' ? value.split(',') : value);
  };

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: { xs: 'column', sm: 'row-reverse' },
      alignItems: { xs: 'stretch', sm: 'center' },
      gap: 1.5,
    }}>
      <Select
        multiple
        value={categories}
        onChange={handleChange}
        displayEmpty
        renderValue={(selected) =>
          selected.length === 0
            ? Strings.retroBoard.filterAllCategoriesLabel
            : Strings.retroBoard.categoriesSelectedLabel(selected.length)
        }
        size="small"
        sx={{
          minWidth: 200,
          direction: 'rtl',
          borderRadius: '12px',
          backgroundColor: theme.background,
          color: theme.text,
          fontFamily: 'Rubik, sans-serif',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.backgroundSelected },
        }}
      >
        {Object.entries(Strings.retroBoard.categories).map(([key, label]) => (
          <MenuItem key={key} value={key} sx={{ fontFamily: 'Rubik, sans-serif' }}>
            <Checkbox checked={categories.includes(key)} />
            <ListItemText primary={label} sx={{ textAlign: 'right' }} />
          </MenuItem>
        ))}
      </Select>

      <TextField
        placeholder={Strings.retroBoard.searchPlaceholder}
        value={searchText}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearchTextChange(e.target.value)}
        size="small"
        sx={{
          flex: 1,
          direction: 'rtl',
          input: { color: theme.text, textAlign: 'right', fontFamily: 'Rubik, sans-serif' },
          '& .MuiOutlinedInput-root': {
            borderRadius: '12px',
            backgroundColor: theme.background,
            '& fieldset': { borderColor: theme.backgroundSelected },
          },
        }}
      />

      {isFilterActive && (
        <Button
          onClick={() => { onCategoriesChange([]); onSearchTextChange(''); }}
          sx={{ color: theme.textSecondary, fontWeight: 'bold', fontFamily: 'Rubik, sans-serif', textTransform: 'none', whiteSpace: 'nowrap' }}
        >
          {Strings.retroBoard.clearFiltersLabel}
        </Button>
      )}
    </Box>
  );
}
