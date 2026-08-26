import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Modal, FlatList, useColorScheme as useRNColorScheme } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { Strings } from '@/constants/strings';

interface CommentFilterBarNativeProps {
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

export function CommentFilterBarNative({ categories, onCategoriesChange, searchText, onSearchTextChange, theme }: CommentFilterBarNativeProps) {
  const colorScheme = useRNColorScheme();
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const isFilterActive = categories.length > 0 || !!searchText.trim();

  const toggleCategory = (key: string) => {
    onCategoriesChange(
      categories.includes(key) ? categories.filter(c => c !== key) : [...categories, key]
    );
  };

  return (
    <View style={{ gap: Spacing.two }}>
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.two }}>
        <TouchableOpacity
          onPress={() => setIsCategoryPickerOpen(true)}
          activeOpacity={0.8}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 14,
            borderRadius: 999,
            borderTopRightRadius: 4,
            backgroundColor: categories.length > 0
              ? (colorScheme === 'dark' ? 'rgba(129,140,248,0.16)' : 'rgba(99,102,241,0.1)')
              : theme.backgroundSelected,
          }}
        >
          <ThemedText style={{
            fontSize: 13,
            fontWeight: categories.length > 0 ? '700' : '400',
            color: categories.length > 0 ? (colorScheme === 'dark' ? '#818cf8' : '#6366f1') : theme.textSecondary,
          }}>
            {categories.length > 0
              ? Strings.retroBoard.categoriesSelectedLabel(categories.length)
              : Strings.retroBoard.filterAllCategoriesLabel}
          </ThemedText>
        </TouchableOpacity>

        <TextInput
          style={{
            flex: 1,
            height: 40,
            borderWidth: 1,
            borderRadius: 8,
            paddingHorizontal: Spacing.two,
            fontSize: 13,
            textAlign: 'right',
            color: theme.text,
            borderColor: theme.backgroundSelected,
            backgroundColor: theme.background,
          }}
          placeholder={Strings.retroBoard.searchPlaceholder}
          placeholderTextColor={theme.textSecondary}
          value={searchText}
          onChangeText={onSearchTextChange}
        />
      </View>

      {isFilterActive && (
        <TouchableOpacity onPress={() => { onCategoriesChange([]); onSearchTextChange(''); }} style={{ alignSelf: 'flex-end' }}>
          <ThemedText style={{ fontSize: 12, fontWeight: 'bold', color: theme.textSecondary }}>
            {Strings.retroBoard.clearFiltersLabel}
          </ThemedText>
        </TouchableOpacity>
      )}

      <Modal
        visible={isCategoryPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCategoryPickerOpen(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setIsCategoryPickerOpen(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={{ backgroundColor: theme.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', paddingVertical: 8 }}
          >
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10 }}>
              <ThemedText style={{ fontSize: 14, fontWeight: 'bold' }}>
                {Strings.retroBoard.filterSectionLabel}
              </ThemedText>
              <TouchableOpacity onPress={() => setIsCategoryPickerOpen(false)}>
                <ThemedText style={{ fontSize: 13, fontWeight: 'bold', color: colorScheme === 'dark' ? '#818cf8' : '#6366f1' }}>
                  {Strings.teamList.saveButton}
                </ThemedText>
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
                      paddingVertical: 14,
                      paddingHorizontal: 20,
                      backgroundColor: isSelected ? theme.backgroundSelected : 'transparent',
                    }}
                  >
                    <ThemedText style={{ fontSize: 15, textAlign: 'right', fontWeight: isSelected ? 'bold' : 'normal' }}>
                      {label}
                    </ThemedText>
                    {isSelected && (
                      <ThemedText style={{ fontSize: 15, color: colorScheme === 'dark' ? '#818cf8' : '#6366f1' }}>✓</ThemedText>
                    )}
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
