import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ListingCard } from '@/components/listing-card';
import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/context';
import { radius, spacing, useTheme } from '@/theme';
import type { ListingSummary } from '@/lib/api/types';

export default function SavedScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [loading, setLoading] = useState(false);

  // Refetches whenever the tab regains focus, so a listing saved on the detail
  // screen shows up here without a manual pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let cancelled = false;
      setLoading(true);
      apiFetch<{ data: ListingSummary[] }>('/me/saved-listings', { authenticated: true })
        .then((result) => {
          if (!cancelled) setListings(result.data);
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [user]),
  );

  if (authLoading) return <ActivityIndicator style={styles.center} />;

  if (!user) {
    return (
      <View style={[styles.screen, styles.gate, { backgroundColor: theme.background }]}>
        <Text style={[styles.gateText, { color: theme.mutedForeground }]}>
          Sign in to keep a list of the places you like.
        </Text>
        <Pressable
          onPress={() => router.push('/login')}
          accessibilityRole="button"
          style={[styles.button, { backgroundColor: theme.primary }]}
        >
          <Text style={[styles.buttonText, { color: theme.primaryForeground }]}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      {loading && listings.length === 0 ? (
        <ActivityIndicator style={styles.center} />
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ListingCard listing={item} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.gateText, { color: theme.mutedForeground }]}>
              You have not saved any listings yet.
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  gate: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.lg },
  gateText: { textAlign: 'center', fontSize: 15, marginTop: spacing.xl },
  button: {
    height: 44,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 15, fontWeight: '600' },
  list: { padding: spacing.md },
  center: { marginTop: spacing.xxl },
});
