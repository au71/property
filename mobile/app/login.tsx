import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/context';
import { ApiError } from '@/lib/api/client';
import { radius, spacing, useTheme } from '@/theme';

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { signIn } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await signIn(identifier.trim(), password);
      router.back();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not sign in. Check your connection.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: theme.background }]}
    >
      <View style={styles.form}>
        <Text style={[styles.label, { color: theme.foreground }]}>Email or phone number</Text>
        <TextInput
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
          style={[styles.input, { borderColor: theme.border, color: theme.foreground }]}
          accessibilityLabel="Email or phone number"
        />

        <Text style={[styles.label, { color: theme.foreground }]}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
          onSubmitEditing={() => void submit()}
          returnKeyType="go"
          style={[styles.input, { borderColor: theme.border, color: theme.foreground }]}
          accessibilityLabel="Password"
        />

        {error ? (
          <Text accessibilityRole="alert" style={[styles.error, { color: theme.destructive }]}>
            {error}
          </Text>
        ) : null}

        <Pressable
          onPress={() => void submit()}
          disabled={pending}
          accessibilityRole="button"
          style={[styles.button, { backgroundColor: theme.primary, opacity: pending ? 0.7 : 1 }]}
        >
          {pending ? (
            <ActivityIndicator color={theme.primaryForeground} />
          ) : (
            <Text style={[styles.buttonText, { color: theme.primaryForeground }]}>Sign in</Text>
          )}
        </Pressable>

        <Text style={[styles.hint, { color: theme.mutedForeground }]}>
          New accounts are created on the website.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  form: { padding: spacing.lg, gap: spacing.sm },
  label: { fontSize: 13, fontWeight: '600', marginTop: spacing.sm },
  input: {
    height: 46,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 15,
  },
  error: { fontSize: 13, marginTop: 4 },
  button: {
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  buttonText: { fontSize: 15, fontWeight: '600' },
  hint: { fontSize: 12, textAlign: 'center', marginTop: spacing.md },
});
