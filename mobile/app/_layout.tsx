import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { colors } from '@/constants/theme';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      // Not signed in — redirect to auth
      router.replace('/(auth)');
    } else if (session && inAuthGroup) {
      // Signed in but still on auth screen — redirect to tabs
      router.replace('/(tabs)');
    }
  }, [session, loading, segments, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor={colors.bgPrimary} />
        <AuthGuard>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bgPrimary },
              animation: 'slide_from_right',
            }}
          />
        </AuthGuard>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
