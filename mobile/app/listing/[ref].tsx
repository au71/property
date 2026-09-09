import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/context';
import { formatArea, formatExactPrice, formatPrice } from '@/lib/format';
import { radius, spacing, useTheme } from '@/theme';
import type { ListingDetail } from '@/lib/api/types';

const { width } = Dimensions.get('window');

interface Contact {
  name: string;
  phone: string;
  viber?: string | null;
}

export default function ListingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ ref: string }>();
  const reference = params.ref;

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!reference) return;
    let cancelled = false;

    apiFetch<ListingDetail>(`/listings/${encodeURIComponent(reference)}`)
      .then((result) => {
        if (cancelled) return;
        setListing(result);
        // Fire-and-forget; a failed counter must not break the screen.
        void apiFetch(`/listings/${encodeURIComponent(reference)}/view`, {
          method: 'POST',
        }).catch(() => undefined);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError && err.status === 404
            ? 'This listing is no longer available.'
            : 'Could not load this listing.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reference]);

  const revealContact = useCallback(async () => {
    if (!reference) return;
    try {
      // The number is never in the listing payload — see the API's
      // /listings/:id/contact endpoint for why.
      setContact(await apiFetch<Contact>(`/listings/${encodeURIComponent(reference)}/contact`));
    } catch {
      Alert.alert('Could not load the contact details', 'Please try again in a moment.');
    }
  }, [reference]);

  const toggleSave = useCallback(async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (!listing?.id) return;

    const next = !saved;
    setSaved(next);
    try {
      if (next) {
        await apiFetch('/me/saved-listings', {
          method: 'POST',
          body: { listingId: listing.id },
          authenticated: true,
        });
      } else {
        await apiFetch(`/me/saved-listings/${listing.id}`, {
          method: 'DELETE',
          authenticated: true,
        });
      }
    } catch {
      setSaved(!next);
      Alert.alert('Could not update your saved listings');
    }
  }, [listing?.id, router, saved, user]);

  if (loading) return <ActivityIndicator style={styles.center} />;

  if (error || !listing) {
    return (
      <View style={[styles.center, styles.errorBox]}>
        <Text style={{ color: theme.mutedForeground }}>{error ?? 'Not found'}</Text>
      </View>
    );
  }

  const price = listing.price ?? {};
  const attributes = (listing.attributes ?? {}) as Record<string, unknown>;
  const media = listing.media ?? [];
  const area = attributes['floorAreaSqft'] ?? attributes['landAreaSqft'];

  return (
    <>
      <Stack.Screen options={{ title: listing.publicRef ?? '' }} />
      <ScrollView style={{ backgroundColor: theme.background }}>
        {media.length > 0 ? (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
            {media.map((item, index) => (
              <Image
                key={item.id ?? index}
                source={{ uri: item.url }}
                style={{ width, height: width * 0.7 }}
                contentFit="cover"
                transition={150}
                accessibilityLabel={`Photo ${index + 1} of ${media.length}`}
              />
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.noImage, { width, backgroundColor: theme.muted }]} />
        )}

        <View style={styles.body}>
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Text style={[styles.price, { color: theme.foreground }]}>
                {formatPrice(price, 'en')}
              </Text>
              {formatExactPrice(price, 'en') ? (
                <Text style={[styles.meta, { color: theme.mutedForeground }]}>
                  {formatExactPrice(price, 'en')}
                </Text>
              ) : null}
            </View>

            <Pressable
              onPress={() => void toggleSave()}
              accessibilityRole="button"
              accessibilityLabel={saved ? 'Remove from saved' : 'Save this listing'}
              style={[styles.saveButton, { borderColor: theme.border }]}
            >
              <Ionicons
                name={saved ? 'heart' : 'heart-outline'}
                size={22}
                color={saved ? theme.destructive : theme.foreground}
              />
            </Pressable>
          </View>

          <Text style={[styles.title, { color: theme.foreground }]}>{listing.title}</Text>
          <Text style={[styles.meta, { color: theme.mutedForeground }]}>
            {listing.address ??
              [listing.township?.nameEn, listing.township?.city?.nameEn]
                .filter(Boolean)
                .join(', ')}
          </Text>
          {listing.addressHidden ? (
            <Text style={[styles.hint, { color: theme.mutedForeground }]}>
              The exact address is shared after you enquire.
            </Text>
          ) : null}

          <View style={styles.facts}>
            {typeof attributes['bedrooms'] === 'number' ? (
              <Fact icon="bed-outline" label={`${attributes['bedrooms']} bed`} />
            ) : null}
            {typeof attributes['bathrooms'] === 'number' ? (
              <Fact icon="water-outline" label={`${attributes['bathrooms']} bath`} />
            ) : null}
            {typeof area === 'number' ? (
              <Fact icon="resize-outline" label={formatArea(area, 'en') ?? ''} />
            ) : null}
          </View>

          <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Overview</Text>
          <Text style={[styles.description, { color: theme.mutedForeground }]}>
            {listing.description}
          </Text>

          {(listing.amenities?.length ?? 0) > 0 ? (
            <>
              <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Amenities</Text>
              <View style={styles.amenities}>
                {listing.amenities?.map((amenity) => (
                  <View
                    key={amenity.id}
                    style={[styles.amenity, { backgroundColor: theme.muted }]}
                  >
                    <Text style={[styles.amenityText, { color: theme.foreground }]}>
                      {amenity.nameEn}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          <View
            style={[styles.contactCard, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            <Text style={[styles.contactName, { color: theme.foreground }]}>
              {listing.contact?.name}
            </Text>

            {contact ? (
              <>
                <Pressable
                  onPress={() => void Linking.openURL(`tel:${contact.phone}`)}
                  accessibilityRole="button"
                  style={[styles.callButton, { backgroundColor: theme.primary }]}
                >
                  <Ionicons name="call" size={18} color={theme.primaryForeground} />
                  <Text style={[styles.callText, { color: theme.primaryForeground }]}>
                    {contact.phone}
                  </Text>
                </Pressable>
                {contact.viber ? (
                  <Pressable
                    onPress={() =>
                      void Linking.openURL(
                        `viber://chat?number=${encodeURIComponent(contact.viber ?? '')}`,
                      )
                    }
                    accessibilityRole="button"
                    style={[styles.viberButton, { borderColor: theme.border }]}
                  >
                    <Text style={{ color: theme.foreground }}>Viber</Text>
                  </Pressable>
                ) : null}
              </>
            ) : listing.contact?.hasPhone ? (
              <Pressable
                onPress={() => void revealContact()}
                accessibilityRole="button"
                style={[styles.callButton, { backgroundColor: theme.primary }]}
              >
                <Ionicons name="call-outline" size={18} color={theme.primaryForeground} />
                <Text style={[styles.callText, { color: theme.primaryForeground }]}>
                  Show phone number
                </Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={[styles.footer, { color: theme.mutedForeground }]}>
            {listing.publicRef} · {listing.viewCount ?? 0} views
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

function Fact({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.fact, { borderColor: theme.border }]}>
      <Ionicons name={icon} size={16} color={theme.mutedForeground} />
      <Text style={{ color: theme.foreground, fontSize: 13 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { marginTop: spacing.xxl },
  errorBox: { alignItems: 'center', padding: spacing.xl },
  noImage: { height: 200 },
  body: { padding: spacing.md, gap: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headerText: { flex: 1 },
  price: { fontSize: 24, fontWeight: '700' },
  title: { fontSize: 17, fontWeight: '600', marginTop: spacing.sm },
  meta: { fontSize: 14 },
  hint: { fontSize: 12, fontStyle: 'italic' },
  saveButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: spacing.lg },
  description: { fontSize: 14, lineHeight: 21 },
  amenities: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  amenity: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.sm },
  amenityText: { fontSize: 13 },
  contactCard: {
    marginTop: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  contactName: { fontSize: 16, fontWeight: '600' },
  callButton: {
    flexDirection: 'row',
    gap: spacing.sm,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callText: { fontSize: 15, fontWeight: '600' },
  viberButton: {
    height: 42,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { fontSize: 12, textAlign: 'center', marginTop: spacing.lg, marginBottom: spacing.xl },
});
