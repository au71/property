import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ListingCard } from '@/components/listing-card';
import { apiFetch } from '@/lib/api/client';
import { radius, spacing, useTheme } from '@/theme';
import type { DealType, ListingSummary, Page } from '@/lib/api/types';

const LAKH = 100_000;

const PRICE_BANDS: Array<{ label: string; min?: number; max?: number }> = [
  { label: 'Any' },
  { label: 'Under 500 lakh', max: 500 * LAKH },
  { label: '500–2,000 lakh', min: 500 * LAKH, max: 2000 * LAKH },
  { label: '2,000–5,000 lakh', min: 2000 * LAKH, max: 5000 * LAKH },
  { label: 'Over 5,000 lakh', min: 5000 * LAKH },
];

export default function SearchScreen() {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [dealType, setDealType] = useState<DealType | undefined>(undefined);
  const [bedrooms, setBedrooms] = useState<number | undefined>(undefined);
  const [band, setBand] = useState(0);
  const [results, setResults] = useState<ListingSummary[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    Keyboard.dismiss();
    setLoading(true);
    setSearched(true);
    try {
      const selected = PRICE_BANDS[band]!;
      const page = await apiFetch<Page<ListingSummary>>('/listings', {
        query: {
          q: query.trim() || undefined,
          dealType,
          bedroomsMin: bedrooms,
          minPrice: selected.min,
          maxPrice: selected.max,
          limit: 30,
        },
      });
      setResults(page.data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [band, bedrooms, dealType, query]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <View style={styles.filters}>
        <View style={[styles.searchRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="search" size={18} color={theme.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => void run()}
            returnKeyType="search"
            placeholder="Area, street or keyword"
            placeholderTextColor={theme.mutedForeground}
            style={[styles.input, { color: theme.foreground }]}
            accessibilityLabel="Search listings"
          />
        </View>

        <ChipRow
          label="Buy or rent"
          options={[
            { key: 'any', label: 'Any', active: dealType === undefined },
            { key: 'SALE', label: 'Buy', active: dealType === 'SALE' },
            { key: 'RENT', label: 'Rent', active: dealType === 'RENT' },
          ]}
          onSelect={(key) => setDealType(key === 'any' ? undefined : (key as DealType))}
        />

        <ChipRow
          label="Bedrooms"
          options={[
            { key: 'any', label: 'Any', active: bedrooms === undefined },
            ...[1, 2, 3, 4].map((n) => ({
              key: String(n),
              label: `${n}+`,
              active: bedrooms === n,
            })),
          ]}
          onSelect={(key) => setBedrooms(key === 'any' ? undefined : Number(key))}
        />

        <ChipRow
          label="Price"
          options={PRICE_BANDS.map((b, i) => ({
            key: String(i),
            label: b.label,
            active: band === i,
          }))}
          onSelect={(key) => setBand(Number(key))}
        />

        <Pressable
          onPress={() => void run()}
          accessibilityRole="button"
          style={[styles.button, { backgroundColor: theme.primary }]}
        >
          <Text style={[styles.buttonText, { color: theme.primaryForeground }]}>Search</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.center} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ListingCard listing={item} />}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            searched ? (
              <Text style={[styles.empty, { color: theme.mutedForeground }]}>
                No listings match these filters. Try widening the price range.
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

function ChipRow({
  label,
  options,
  onSelect,
}: {
  label: string;
  options: Array<{ key: string; label: string; active: boolean }>;
  onSelect: (key: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.chipRow}>
      <Text style={[styles.chipLabel, { color: theme.mutedForeground }]}>{label}</Text>
      <View style={styles.chips}>
        {options.map((option) => (
          <Pressable
            key={option.key}
            onPress={() => onSelect(option.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: option.active }}
            style={[
              styles.chip,
              {
                borderColor: option.active ? theme.primary : theme.border,
                backgroundColor: option.active ? theme.primary : 'transparent',
              },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                { color: option.active ? theme.primaryForeground : theme.foreground },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  filters: { padding: spacing.md, gap: spacing.sm },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  input: { flex: 1, fontSize: 15 },
  chipRow: { gap: 4 },
  chipLabel: { fontSize: 12, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  chipText: { fontSize: 13 },
  button: {
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonText: { fontSize: 15, fontWeight: '600' },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  center: { marginTop: spacing.xl },
  empty: { textAlign: 'center', marginTop: spacing.xl, fontSize: 14, paddingHorizontal: spacing.xl },
});
