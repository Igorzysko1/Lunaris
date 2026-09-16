import { useEffect } from 'react';
import { Stack, router, usePathname } from 'expo-router';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { IBMPlexSans_400Regular, IBMPlexSans_500Medium } from '@expo-google-fonts/ibm-plex-sans';
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';

import { ForecastProvider } from '@/store/forecast';
import { GoogleProvider } from '@/store/google';
import { SettingsProvider, useSettings } from '@/store/settings';
import { colors } from '@/theme';
import { ThemeProvider, themedStyles, useTheme } from '@/ui/theme';

SplashScreen.preventAutoHideAsync();

/** Arkusz trybu nocnego otwierany gestem — wszędzie ta sama ścieżka. */
const NIGHT_MODE = '/night-mode';

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
      {/* Motyw nad wszystkim, co rysuje: paletę trzeba wybrać, zanim pierwszy
          ekran zbuduje z niej swoje style. */}
      <ThemeProvider>
        <StatusBar style="light" />
        {/* Nad cyklem i ekranami: stan konta czytają karty sesji, przegląd
            i Ustawienia, a odłączenie wykryte gdziekolwiek ma dotrzeć wszędzie. */}
        <GoogleProvider>
          <AppStack />
        </GoogleProvider>
      </ThemeProvider>
    </SettingsProvider>
  );
}

/**
 * Splash zdejmujemy dopiero, gdy znamy zapisane ustawienia — inaczej pierwszy
 * ekran mignąłby domyślną lokalizacją, zanim wczyta się wybór użytkownika.
 */
function AppStack() {
  const { hydrated } = useSettings();
  const { mode } = useTheme();
  const pathname = usePathname();

  useEffect(() => {
    if (hydrated) SplashScreen.hideAsync();
  }, [hydrated]);

  if (!hydrated) return null;

  /**
   * Arkusz od dołu: szybka akcja albo szczegół bez utraty kontekstu. Zamyka się
   * gestem w dół, a to, co było pod spodem, zostaje na miejscu.
   *
   * Powstaje w renderze, a nie obok modułu, bo tło arkusza bierze kolor
   * z palety — a ta zmienia się w trakcie działania aplikacji.
   */
  const sheet = {
    presentation: 'formSheet' as const,
    sheetAllowedDetents: [0.92],
    sheetGrabberVisible: true,
    sheetCornerRadius: 18,
    contentStyle: { backgroundColor: colors.surfaceRaised },
  };

  /**
   * Trzy palce otwierają tryb nocny z każdego ekranu.
   *
   * Przechwytywanie, a nie zwykły responder: chcemy zobaczyć dotknięcie, zanim
   * zajmie się nim przycisk pod spodem — ale `false` znaczy „nie przejmuję",
   * więc gest do niczego się nie wtrąca. Trzy palce, bo dwoma się przewija
   * i przybliża, a w rękawicach trafienie w konkretny przycisk po ciemku jest
   * dokładnie tym, czego ten skrót ma oszczędzić.
   */
  const watchForThreeFingers = (event: { nativeEvent: { touches: unknown[] } }) => {
    if (event.nativeEvent.touches.length >= 3 && pathname !== NIGHT_MODE) {
      router.push(NIGHT_MODE);
    }
    return false;
  };

  // Cykl dobowy startuje dopiero po wczytaniu ustawień: bez znanej lokalizacji
  // pierwsze pobranie poszłoby dla punktu domyślnego, a więc nie dla tego,
  // który użytkownik wybrał.
  return (
    <ForecastProvider>
      <View style={styles.root} onStartShouldSetResponderCapture={watchForThreeFingers}>
        {/* Klucz na trybie: zmiana palety montuje ekrany od nowa. Bez tego
            ekran już otwarty zostałby w starych kolorach — arkusz stylów
            przeliczy się sam, ale kolor wpisany wprost w JSX-ie dopiero przy
            kolejnym renderze, a tego nikt tym ekranom nie zleci. Cena jest
            jedna: przełączenie wraca na korzeń zakładki. */}
        <Stack
          key={mode}
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
          <Stack.Screen name="settings/equipment" />
          <Stack.Screen name="settings/observer" />
          <Stack.Screen name="settings/google" />
          <Stack.Screen name="settings/location" />
          <Stack.Screen name="apod" />
          <Stack.Screen name="about" />
          <Stack.Screen name="forecasts" />

          {/* Arkusze z projektu. */}
          <Stack.Screen name="target/[id]" options={sheet} />
          <Stack.Screen name="library/target/[id]" options={sheet} />
          <Stack.Screen name="constellation/[id]" options={sheet} />
          <Stack.Screen name="site/[id]" options={sheet} />
          <Stack.Screen name="event/[id]" options={sheet} />
          <Stack.Screen name="close-night" options={sheet} />
          <Stack.Screen name="night-mode" options={{ ...sheet, sheetAllowedDetents: [0.8] }} />
        </Stack>
      </View>
    </ForecastProvider>
  );
}

const styles = themedStyles(() => ({
  root: { flex: 1, backgroundColor: colors.bg },
}));
