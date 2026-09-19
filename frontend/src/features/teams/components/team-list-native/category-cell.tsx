import React from 'react';
import { View, Text, Switch } from 'react-native';
import { Strings } from '@/constants/strings';
import { useTheme } from '@/design/theme-context';
import type { TeamCategory } from '@/features/teams/types';
import { getTeamSettingsPanelStyles } from './team-settings-panel.styles';

interface CategoryCellProps {
  category: TeamCategory;
  onToggleEnabled: (category: TeamCategory) => void;
  isToggling: boolean;
}

/** One cell in the 2-column category grid — split out of category-list-section.tsx so that file
 * stays about the list/filter/create flow, not one item's markup. */
export function CategoryCell({ category, onToggleEnabled, isToggling }: CategoryCellProps) {
  const t = useTheme();
  const s = getTeamSettingsPanelStyles(t);

  return (
    <View style={s.categoryCell(category.isEnabled)}>
      <View style={s.categoryCellTop}>
        <Text style={s.categoryLabel} numberOfLines={1}>
          {category.label}
        </Text>
        <View style={s.categoryBadge(category.isDefault)}>
          <Text style={s.categoryBadgeText(category.isDefault)}>
            {category.isDefault ? Strings.categoryManagement.defaultBadge : Strings.categoryManagement.customBadge}
          </Text>
        </View>
      </View>
      <View style={s.categoryCellBottom}>
        <Text style={s.categoryUsageText}>{Strings.categoryManagement.usageCountLabel(category.commentCount)}</Text>
        <Switch
          value={category.isEnabled}
          onValueChange={() => onToggleEnabled(category)}
          disabled={isToggling}
          trackColor={{ false: t.color.border, true: t.color.accent.border }}
          thumbColor={category.isEnabled ? t.color.accent.base : t.color.surface}
        />
      </View>
    </View>
  );
}
