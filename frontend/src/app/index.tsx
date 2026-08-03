import React, { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/auth-context';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'unspecified' ? 'light' : colorScheme];
  const { user, token, logout } = useAuth();

  // DB Connection status in dashboard
  const [dbStatus, setDbStatus] = useState<string>('Checking database connection...');

  const getBackendUrl = () => {
    return Platform.OS === 'web' && typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
      ? 'https://navet-to-retro-backend.fly.dev'
      : 'http://localhost:5005';
  };

  useEffect(() => {
    if (token) {
      checkDbConnection(token);
    }
  }, [token]);

  const checkDbConnection = async (authToken: string) => {
    try {
      const response = await fetch(getBackendUrl(), {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (response.ok) {
        const text = await response.text();
        setDbStatus(text);
      } else {
        setDbStatus('Failed to query database check endpoint');
      }
    } catch (err: any) {
      setDbStatus(`Database connection failed: ${err.message}`);
    }
  };

  if (!user) return null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.contentCard, { backgroundColor: theme.background, borderColor: theme.backgroundElement }]}>
          <ThemedText type="title" style={styles.title}>
            Welcome, {user.firstName || user.username}!
          </ThemedText>
          <ThemedText type="default" style={styles.subtitle}>
            You have successfully logged in to the Retro system.
          </ThemedText>

          <View style={[styles.infoSection, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="subtitle" style={styles.sectionHeader}>
              User Information
            </ThemedText>
            <View style={styles.infoRow}>
              <ThemedText type="default" style={{ fontWeight: 'bold' }}>Username: </ThemedText>
              <ThemedText type="default">{user.username}</ThemedText>
            </View>
            <View style={styles.infoRow}>
              <ThemedText type="default" style={{ fontWeight: 'bold' }}>Email: </ThemedText>
              <ThemedText type="default">{user.email}</ThemedText>
            </View>
            {(user.firstName || user.lastName) && (
              <View style={styles.infoRow}>
                <ThemedText type="default" style={{ fontWeight: 'bold' }}>Full Name: </ThemedText>
                <ThemedText type="default">
                  {user.firstName} {user.lastName}
                </ThemedText>
              </View>
            )}
          </View>

          <View style={[styles.infoSection, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="subtitle" style={styles.sectionHeader}>
              Neon Database Status
            </ThemedText>
            <ThemedText type="code" style={styles.dbStatusText}>
              {dbStatus}
            </ThemedText>
          </View>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#e53935' }]}
            onPress={logout}
          >
            <ThemedText style={styles.buttonText}>Log Out</ThemedText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  contentCard: {
    width: '100%',
    maxWidth: 450,
    padding: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.three,
    borderWidth: 1,
  },
  title: {
    textAlign: 'center',
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: Spacing.two,
  },
  button: {
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
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
  dbStatusText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
