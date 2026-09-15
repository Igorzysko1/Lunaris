import { ApodCard } from '@/components/ApodCard';
import { useApod } from '@/hooks/use-apod';
import { Note, Screen, TitleBar } from '@/ui/kit';

/**
 * Więcej › Zdjęcie dnia NASA. Poza drogą do werdyktu — ozdoba, więc bez stanu
 * błędu: jedyne, co może się nie udać, to jej nieobecność.
 */
export default function ApodScreen() {
  const apod = useApod();

  return (
    <Screen>
      <TitleBar back title="Zdjęcie dnia NASA" />
      {apod ? (
        <ApodCard apod={apod} />
      ) : (
        <Note>
          Zdjęcie dnia jeszcze się nie wczytało — bez sieci go nie ma, a nic od niego nie zależy.
        </Note>
      )}
    </Screen>
  );
}
