import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans';
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';

import { ForecastProvider } from '@/store/forecast';
import { SettingsProvider, useSettings } from '@/store/settings';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <SettingsProvider>
      <StatusBar style="light" />
      <AppStack />
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
        <Stack.Screen name="location" />
        <Stack.Screen name="moon" />
        <Stack.Screen name="thresholds" />
        <Stack.Screen name="sites" />
        <Stack.Screen name="review" />
      </Stack>
    </ForecastProvider>
  );
}
