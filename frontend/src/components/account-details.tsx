import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from './themed-text';
import { Spacing } from '@/constants/theme';

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
        Account Details
      </ThemedText>
      <View style={styles.infoRow}>
        <ThemedText type="default" style={{ fontWeight: 'bold' }}>
          Username:{' '}
        </ThemedText>
        <ThemedText type="default">{user.username}</ThemedText>
      </View>
      <View style={styles.infoRow}>
        <ThemedText type="default" style={{ fontWeight: 'bold' }}>
          Email:{' '}
        </ThemedText>
        <ThemedText type="default">{user.email}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  infoSection: {
    padding: Spacing.three,
    borderRadius: 10,
    gap: Spacing.two,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: Spacing.one,
  },
  infoRow: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
});
