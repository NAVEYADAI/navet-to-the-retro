import React from 'react';
import { Box, Select, MenuItem, Checkbox, ListItemText, Typography, type SelectChangeEvent } from '@mui/material';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Field, Button } from '@/components/ui';

interface CommentFilterBarWebProps {
  categories: string[];
  onCategoriesChange: (values: string[]) => void;
  searchText: string;
  onSearchTextChange: (value: string) => void;
}

export function CommentFilterBarWeb({ categories, onCategoriesChange, searchText, onSearchTextChange }: CommentFilterBarWebProps) {
  const t = useTheme();
  const isFilterActive = categories.length > 0 || !!searchText.trim();

  const handleChange = (e: SelectChangeEvent<string[]>) => {
    const value = e.target.value;
    onCategoriesChange(typeof value === 'string' ? value.split(',') : value);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'stretch', sm: 'flex-end' },
        gap: `${t.space[3]}px`,
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${t.space[1] + 2}px` }}>
        <Typography sx={{ ...t.type.label, color: t.color.textSecondary }}>
          {Strings.retroBoard.categoryLabel}
        </Typography>
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
            borderRadius: `${t.radius.field}px`,
            backgroundColor: t.color.surface,
            color: t.color.text,
            ...t.type.body,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: t.color.borderStrong },
          }}
        >
          {Object.entries(Strings.retroBoard.categories).map(([key, label]) => (
            <MenuItem key={key} value={key} sx={{ ...t.type.body }}>
              <Checkbox checked={categories.includes(key)} />
              <ListItemText primary={label} />
            </MenuItem>
          ))}
        </Select>
      </Box>

      <Box sx={{ flex: 1 }}>
        <Field
          label={Strings.retroBoard.searchFieldLabel}
          value={searchText}
          onChangeText={onSearchTextChange}
          placeholder={Strings.retroBoard.searchPlaceholder}
        />
      </Box>

      {isFilterActive && (
        <Button variant="ghost" size="sm" icon="x" onPress={() => { onCategoriesChange([]); onSearchTextChange(''); }}>
          {Strings.retroBoard.clearFiltersLabel}
        </Button>
      )}
    </Box>
  );
}
