import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { formatArea, formatPrice, type Locale } from '@/lib/format';
import { radius, spacing, useTheme } from '@/theme';
import type { ListingSummary } from '@/lib/api/types';

export function ListingCard({
  listing,
  locale = 'en',
}: {
  listing: ListingSummary;
  locale?: Locale;
}) {
  const theme = useTheme();
  const area = listing.floorAreaSqft ?? listing.landAreaSqft;
  const place = locale === 'my' ? listing.township?.nameMy : listing.township?.nameEn;
  const category = locale === 'my' ? listing.category?.nameMy : listing.category?.nameEn;

  return (
    <Link href={{ pathname: '/listing/[ref]', params: { ref: listing.publicRef } }} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${listing.title}. ${formatPrice(listing.price ?? {}, locale)}`}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <View style={[styles.imageWrap, { backgroundColor: theme.muted }]}>
          {listing.coverImage?.url ? (
            <Image
              source={{ uri: listing.coverImage.url }}
              style={styles.image}
              contentFit="cover"
              transition={150}
            />
          ) : null}

          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: theme.primary }]}>
              <Text style={[styles.badgeText, { color: theme.primaryForeground }]}>
                {listing.dealType === 'SALE' ? 'Sale' : 'Rent'}
              </Text>
            </View>

            {listing.isFeatured ? (
              <View style={[styles.badge, { backgroundColor: theme.success }]}>
                <Text style={[styles.badgeText, { color: theme.successForeground }]}>Featured</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.body}>
          <Text style={[styles.price, { color: theme.foreground }]}>
            {formatPrice(listing.price ?? {}, locale)}
          </Text>
          <Text numberOfLines={2} style={[styles.title, { color: theme.foreground }]}>
            {listing.title}
          </Text>
          <Text numberOfLines={1} style={[styles.meta, { color: theme.mutedForeground }]}>
            {[place, category].filter(Boolean).join(' · ')}
          </Text>

          <View style={styles.facts}>
            {listing.bedrooms != null ? (
              <Fact label={`${listing.bedrooms} bed`} color={theme.mutedForeground} />
            ) : null}
            {listing.bathrooms != null ? (
              <Fact label={`${listing.bathrooms} bath`} color={theme.mutedForeground} />
            ) : null}
            {area != null ? (
              <Fact label={formatArea(area, locale) ?? ''} color={theme.mutedForeground} />
            ) : null}
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

function Fact({ label, color }: { label: string; color: string }) {
  return <Text style={[styles.fact, { color }]}>{label}</Text>;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  imageWrap: { aspectRatio: 4 / 3, position: 'relative' },
  image: { width: '100%', height: '100%' },
  // One absolutely-positioned row holding both badges. Positioning each badge
  // separately with `left` and `right` stretches it across the card instead of
  // sizing it to its text.
  badges: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
  body: { padding: spacing.md },
  price: { fontSize: 18, fontWeight: '700' },
  title: { marginTop: 4, fontSize: 14, fontWeight: '500', lineHeight: 20 },
  meta: { marginTop: 2, fontSize: 13 },
  facts: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  fact: { fontSize: 12 },
});
