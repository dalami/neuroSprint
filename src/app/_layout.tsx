import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AuthProvider } from '../features/auth/AuthContext';
import { initAds } from '../lib/ads';
import { initSounds } from '../lib/sounds';
import { colors } from '../theme';

const queryClient = new QueryClient();

export default function RootLayout() {
  useEffect(() => {
    initSounds();
    initAds();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
