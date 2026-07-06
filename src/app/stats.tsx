import { Redirect, useRouter } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../features/auth/AuthContext';
import { StatsScreen } from '../features/stats/StatsScreen';
import { colors } from '../theme';

export default function StatsRoute() {
  const router = useRouter();
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}
      >
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }
  if (!session) return <Redirect href="/login" />;

  return <StatsScreen onBack={() => router.back()} />;
}
