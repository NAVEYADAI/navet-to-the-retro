import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from './themed-text';
import { Spacing } from '@/constants/theme';
import { Strings } from '@/constants/strings';

interface AccountDetailsProps {
  user: {
    username: string;
    email: string;
  };
  theme: {
    backgroundElement: string;
  };
}

export function AccountDetails({ user, theme }: AccountDetailsProps) {
  return (
    <View style={[styles.infoSection, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="subtitle" style={styles.sectionHeader}>
        {Strings.dashboard.accountDetailsHeader}
      </ThemedText>
      <View style={styles.infoRow}>
        <ThemedText type="default" style={{ fontWeight: 'bold' }}>
          {Strings.dashboard.usernameLabel}
        </ThemedText>
        <ThemedText type="default" style={styles.valueText}>{user.username}</ThemedText>
      </View>
      <View style={styles.infoRow}>
        <ThemedText type="default" style={{ fontWeight: 'bold' }}>
          {Strings.dashboard.emailLabel}
        </ThemedText>
        <ThemedText type="default" style={styles.valueText}>{user.email}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  infoSection: {
    padding: Spacing.three,
    borderRadius: 10,
    gap: Spacing.two,
    width: '100%',
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: Spacing.one,
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    width: '100%',
  },
  valueText: {
    flexShrink: 1,
  },
});
