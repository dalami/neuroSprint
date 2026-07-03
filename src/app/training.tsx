import { useRouter } from 'expo-router';
import { TrainingSession } from '../features/training/TrainingSession';

export default function TrainingScreen() {
  const router = useRouter();
  return (
    <TrainingSession
      onExit={() => router.back()}
      // replace: al salir del infinito, "atrás" vuelve al home (no a la sesión terminada)
      onContinue={() => router.replace('/infinite')}
    />
  );
}
