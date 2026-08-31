import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, FlatList, type TextStyle } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import { Icon } from '@/components/ui';

interface CommentFilterBarNativeProps {
  categories: string[];
  onCategoriesChange: (values: string[]) => void;
  searchText: string;
  onSearchTextChange: (value: string) => void;
}

/** RN doesn't support the web font stack / unitless line-height from tokens.ts — adapt numerically. */
function rnText(entry: { fontSize: number; fontWeight: number; lineHeight: number }): TextStyle {
  return {
    fontSize: entry.fontSize,
    lineHeight: Math.round(entry.fontSize * entry.lineHeight),
    fontWeight: String(entry.fontWeight) as TextStyle['fontWeight'],
  };
}

export function CommentFilterBarNative({ categories, onCategoriesChange, searchText, onSearchTextChange }: CommentFilterBarNativeProps) {
  const t = useTheme();
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const isFilterActive = categories.length > 0 || !!searchText.trim();

  const toggleCategory = (key: string) => {
    onCategoriesChange(
      categories.includes(key) ? categories.filter(c => c !== key) : [...categories, key]
    );
  };

  return (
    <View style={{ gap: t.space[2] }}>
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: t.space[2] }}>
        <TouchableOpacity
          onPress={() => setIsCategoryPickerOpen(true)}
          activeOpacity={0.8}
          style={{
            paddingVertical: t.space[2],
            paddingHorizontal: t.space[3] + 2,
            borderRadius: t.radius.pill,
            backgroundColor: categories.length > 0 ? t.color.accent.subtle : t.color.surfaceSubtle,
          }}
        >
          <Text style={[
            rnText({ ...t.type.label, fontWeight: categories.length > 0 ? 700 : 400 }),
            { color: categories.length > 0 ? t.color.accent.base : t.color.textSecondary },
          ]}>
            {categories.length > 0
              ? Strings.retroBoard.categoriesSelectedLabel(categories.length)
              : Strings.retroBoard.filterAllCategoriesLabel}
          </Text>
        </TouchableOpacity>

        <TextInput
          style={[
            rnText(t.type.label),
            {
              flex: 1,
              height: t.layout.minTouchTarget,
              borderWidth: 1,
              borderRadius: t.radius.field,
              paddingHorizontal: t.space[2],
              textAlign: 'right',
              color: t.color.text,
              borderColor: t.color.border,
              backgroundColor: t.color.surface,
            },
          ]}
          placeholder={Strings.retroBoard.searchPlaceholder}
          placeholderTextColor={t.color.textMuted}
          value={searchText}
          onChangeText={onSearchTextChange}
        />
      </View>

      {isFilterActive && (
        <TouchableOpacity
          onPress={() => { onCategoriesChange([]); onSearchTextChange(''); }}
          style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4, alignSelf: 'flex-end' }}
        >
          <Icon name="x" size="sm" tone="muted" />
          <Text style={[rnText({ ...t.type.caption, fontWeight: 700 }), { color: t.color.textSecondary }]}>
            {Strings.retroBoard.clearFiltersLabel}
          </Text>
        </TouchableOpacity>
      )}

      <Modal
        visible={isCategoryPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCategoryPickerOpen(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: t.color.overlay, justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setIsCategoryPickerOpen(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={{
              backgroundColor: t.color.surface,
              borderTopLeftRadius: t.radius.card + 8,
              borderTopRightRadius: t.radius.card + 8,
              maxHeight: '70%',
              paddingVertical: t.space[2],
            }}
          >
            <View
              style={{
                flexDirection: 'row-reverse',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: t.space[5],
                paddingVertical: t.space[2] + 2,
              }}
            >
              <Text style={[rnText(t.type.bodyStrong), { color: t.color.text }]}>
                {Strings.retroBoard.filterSectionLabel}
              </Text>
              <TouchableOpacity onPress={() => setIsCategoryPickerOpen(false)}>
                <Text style={[rnText({ ...t.type.label, fontWeight: 700 }), { color: t.color.accent.base }]}>
                  {Strings.teamList.saveButton}
                </Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={Object.entries(Strings.retroBoard.categories)}
              keyExtractor={([key]) => key}
              renderItem={({ item: [key, label] }) => {
                const isSelected = categories.includes(key);
                return (
                  <TouchableOpacity
                    onPress={() => toggleCategory(key)}
                    style={{
                      flexDirection: 'row-reverse',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: t.space[3] + 2,
                      paddingHorizontal: t.space[5],
                      backgroundColor: isSelected ? t.color.surfaceSubtle : 'transparent',
                    }}
                  >
                    <Text style={[
                      rnText({ ...t.type.body, fontWeight: isSelected ? 700 : 400 }),
                      { color: t.color.text, textAlign: 'right' },
                    ]}>
                      {label}
                    </Text>
                    {isSelected && <Icon name="check" size="sm" tone="accent" />}
                  </TouchableOpacity>
                );
              }}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
