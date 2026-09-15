import { router } from 'expo-router';

import { MenuRow, Note, Screen, TitleBar } from '@/ui/kit';

/**
 * Ekrany sprzed przebudowy. Działają na prawdziwych danych i zostają dostępne,
 * dopóki nowe widoki są makietą — każdy znika po podpięciu swojego następcy.
 */
export default function LegacyScreens() {
  return (
    <Screen>
      <TitleBar back title="Stare ekrany" subtitle="działające, do czasu podpięcia nowych" />
      <MenuRow
        title="Noc"
        subtitle="werdykt, karty, zdjęcie dnia NASA"
        onPress={() => router.push('/legacy/night')}
      />
      <MenuRow
        title="Ustawienia"
        subtitle="sprzęt, profil, Google, powiadomienia"
        onPress={() => router.push('/legacy/settings')}
      />
      <Note>Nowe ekrany są makietą: dane są stałe, a przyciski bez logiki mówią to wprost.</Note>
    </Screen>
  );
}
