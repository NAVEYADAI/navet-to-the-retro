import React from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { ThemedText } from './themed-text';
import { Spacing } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import { Box, Typography, Avatar } from '@mui/material';

interface AccountDetailsProps {
  user: {
    username: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  theme: {
    text: string;
    background: string;
    backgroundElement: string;
    backgroundSelected: string;
    textSecondary: string;
  };
}

export function AccountDetails(props: AccountDetailsProps) {
  if (Platform.OS === 'web') {
    return <AccountDetailsWeb {...props} />;
  }
  return <AccountDetailsNative {...props} />;
}

function AccountDetailsWeb({ user, theme }: AccountDetailsProps) {
  const initial = (user.firstName || user.username).charAt(0).toUpperCase();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'right' }}>
      <Typography variant="h6" sx={{ fontWeight: 'bold', color: theme.text, fontFamily: 'Rubik, sans-serif' }}>
        {Strings.dashboard.accountDetailsHeader}
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'row-reverse', alignItems: 'center', gap: 2, p: 2, backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 3 }}>
        <Avatar
          sx={{
            width: 48,
            height: 48,
            backgroundColor: theme.text,
            color: theme.background,
            fontWeight: 'bold',
            fontFamily: 'Rubik, sans-serif',
          }}
        >
          {initial}
        </Avatar>
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <Typography variant="body1" sx={{ fontWeight: 'bold', color: theme.text, fontFamily: 'Rubik, sans-serif' }}>
            {user.firstName || user.username} {user.lastName || ''}
          </Typography>
          <Typography variant="body2" sx={{ color: theme.textSecondary, fontFamily: 'Rubik, sans-serif' }}>
            @{user.username}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
          <Typography variant="body2" sx={{ fontWeight: 'bold', color: theme.text, fontFamily: 'Rubik, sans-serif' }}>
            {Strings.dashboard.emailLabel}
          </Typography>
          <Typography variant="body2" sx={{ color: theme.textSecondary, fontFamily: 'Rubik, sans-serif' }}>
            {user.email}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

function AccountDetailsNative({ user, theme }: AccountDetailsProps) {
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
    textAlign: 'right',
  },
  infoRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: Spacing.one,
    width: '100%',
  },
  valueText: {
    flexShrink: 1,
  },
});
