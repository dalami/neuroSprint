import { useRouter } from 'expo-router';
import { InfiniteMode } from '../features/training/InfiniteMode';

export default function InfiniteScreen() {
  const router = useRouter();
  return <InfiniteMode onExit={() => router.back()} />;
}
