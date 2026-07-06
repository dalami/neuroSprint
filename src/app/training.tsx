import { useRouter } from 'expo-router';
import { TrainingSession } from '../features/training/TrainingSession';

export default function TrainingScreen() {
  const router = useRouter();
  return <TrainingSession onExit={() => router.back()} />;
}
