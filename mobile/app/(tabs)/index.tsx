import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ListingCard } from '@/components/listing-card';
import { apiFetch } from '@/lib/api/client';
import { spacing, radius, useTheme } from '@/theme';
import type { DealType, ListingSummary, Page } from '@/lib/api/types';

export default function BrowseScreen() {
  const theme = useTheme();
  const [dealType, setDealType] = useState<DealType>('SALE');
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (deal: DealType, append = false, from?: string | null) => {
      try {
        setError(null);
        const page = await apiFetch<Page<ListingSummary>>('/listings', {
          query: { dealType: deal, limit: 20, sort: 'newest', ...(from ? { cursor: from } : {}) },
        });
        setListings((current) => (append ? [...current, ...page.data] : page.data));
        setCursor(page.page.nextCursor);
      } catch {
        setError('Could not load listings. Check your connection and try again.');
      }
    },
    [],
  );

  useEffect(() => {
    setLoading(true);
    void load(dealType).finally(() => setLoading(false));
  }, [dealType, load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load(dealType).finally(() => setRefreshing(false));
  }, [dealType, load]);

  const onEndReached = useCallback(() => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    void load(dealType, true, cursor).finally(() => setLoadingMore(false));
  }, [cursor, dealType, load, loadingMore]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <View style={[styles.toggle, { backgroundColor: theme.muted }]}>
        {(['SALE', 'RENT'] as const).map((value) => (
          <Pressable
            key={value}
            onPress={() => setDealType(value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: dealType === value }}
            style={[
              styles.toggleItem,
              dealType === value && { backgroundColor: theme.card },
            ]}
          >
            <Text
              style={[
                styles.toggleText,
                { color: dealType === value ? theme.foreground : theme.mutedForeground },
              ]}
            >
              {value === 'SALE' ? 'Buy' : 'Rent'}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={styles.center} />
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ListingCard listing={item} />}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: theme.mutedForeground }]}>
              {error ?? 'No listings yet.'}
            </Text>
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={styles.footer} /> : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  toggle: {
    flexDirection: 'row',
    margin: spacing.md,
    padding: 3,
    borderRadius: radius.md,
  },
  toggleItem: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  toggleText: { fontSize: 14, fontWeight: '600' },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  center: { marginTop: spacing.xxl },
  empty: { textAlign: 'center', marginTop: spacing.xxl, fontSize: 14 },
  footer: { marginVertical: spacing.lg },
});
