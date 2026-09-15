import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { IBMPlexSans_400Regular, IBMPlexSans_500Medium } from '@expo-google-fonts/ibm-plex-sans';
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';

import { MockProvider } from '@/mock/state';
import { ForecastProvider } from '@/store/forecast';
import { GoogleProvider } from '@/store/google';
import { SettingsProvider, useSettings } from '@/store/settings';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();

/**
 * Arkusz od dołu: szybka akcja albo szczegół bez utraty kontekstu. Zamyka się
 * gestem w dół, a to, co było pod spodem, zostaje na miejscu.
 */
const SHEET = {
  presentation: 'formSheet' as const,
  sheetAllowedDetents: [0.92],
  sheetGrabberVisible: true,
  sheetCornerRadius: 18,
  contentStyle: { backgroundColor: colors.surfaceRaised },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <SettingsProvider>
      <StatusBar style="light" />
      {/* Nad cyklem i ekranami: stan konta czytają karty sesji, przegląd
          i Ustawienia, a odłączenie wykryte gdziekolwiek ma dotrzeć wszędzie. */}
      <GoogleProvider>
        <MockProvider>
          <AppStack />
        </MockProvider>
      </GoogleProvider>
    </SettingsProvider>
  );
}

/**
 * Splash zdejmujemy dopiero, gdy znamy zapisane ustawienia — inaczej pierwszy
 * ekran mignąłby domyślną lokalizacją, zanim wczyta się wybór użytkownika.
 */
function AppStack() {
  const { hydrated } = useSettings();

  useEffect(() => {
    if (hydrated) SplashScreen.hideAsync();
  }, [hydrated]);

  if (!hydrated) return null;

  // Cykl dobowy startuje dopiero po wczytaniu ustawień: bez znanej lokalizacji
  // pierwsze pobranie poszłoby dla punktu domyślnego, a więc nie dla tego,
  // który użytkownik wybrał.
  return (
    <ForecastProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />

        {/* Drill-down: szczegół albo edycja. */}
        <Stack.Screen name="location" />
        <Stack.Screen name="moon" />
        <Stack.Screen name="thresholds" />
        <Stack.Screen name="entry/[id]" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="library/targets" />
        <Stack.Screen name="library/constellations" />
        <Stack.Screen name="mock-states" />

        {/* Arkusze z projektu. */}
        <Stack.Screen name="target/[id]" options={SHEET} />
        <Stack.Screen name="library/target/[id]" options={SHEET} />
        <Stack.Screen name="constellation/[id]" options={SHEET} />
        <Stack.Screen name="site/[id]" options={SHEET} />
        <Stack.Screen name="event/[id]" options={SHEET} />
        <Stack.Screen name="close-night" options={SHEET} />
        <Stack.Screen name="night-mode" options={{ ...SHEET, sheetAllowedDetents: [0.8] }} />

        {/* Ekrany sprzed przebudowy — działają, dopóki nowe nie dostaną danych. */}
        <Stack.Screen name="legacy/index" />
        <Stack.Screen name="legacy/night" />
        <Stack.Screen name="legacy/settings" />
      </Stack>
    </ForecastProvider>
  );
}
