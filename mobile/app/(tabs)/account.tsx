import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth/context';
import { API_URL } from '@/lib/api/client';
import { radius, spacing, useTheme } from '@/theme';

export default function AccountScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  if (loading) return <ActivityIndicator style={styles.center} />;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
    >
      {user ? (
        <>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.name, { color: theme.foreground }]}>{user.name}</Text>
            <Text style={[styles.meta, { color: theme.mutedForeground }]}>
              {user.email ?? user.phone}
            </Text>
            <View style={styles.roles}>
              {user.roles.map((role) => (
                <View key={role} style={[styles.role, { backgroundColor: theme.muted }]}>
                  <Text style={[styles.roleText, { color: theme.mutedForeground }]}>{role}</Text>
                </View>
              ))}
            </View>
          </View>

          <Text style={[styles.note, { color: theme.mutedForeground }]}>
            Creating and editing listings is on the website for now. This app covers browsing,
            saving and enquiring.
          </Text>

          <Pressable
            onPress={() => void signOut()}
            accessibilityRole="button"
            style={[styles.button, { borderColor: theme.border }]}
          >
            <Ionicons name="log-out-outline" size={18} color={theme.foreground} />
            <Text style={[styles.buttonText, { color: theme.foreground }]}>Sign out</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={[styles.note, { color: theme.mutedForeground }]}>
            Sign in to save listings and see the enquiries you have sent.
          </Text>
          <Pressable
            onPress={() => router.push('/login')}
            accessibilityRole="button"
            style={[styles.button, { backgroundColor: theme.primary, borderColor: theme.primary }]}
          >
            <Text style={[styles.buttonText, { color: theme.primaryForeground }]}>Sign in</Text>
          </Pressable>
        </>
      )}

      <Text style={[styles.footer, { color: theme.mutedForeground }]}>API: {API_URL}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.lg },
  center: { marginTop: spacing.xxl },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  name: { fontSize: 18, fontWeight: '700' },
  meta: { marginTop: 2, fontSize: 14 },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md },
  role: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  roleText: { fontSize: 11, fontWeight: '600' },
  note: { fontSize: 14, lineHeight: 20 },
  button: {
    flexDirection: 'row',
    gap: spacing.sm,
    height: 46,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 15, fontWeight: '600' },
  footer: { fontSize: 11, textAlign: 'center', marginTop: spacing.xl },
});
