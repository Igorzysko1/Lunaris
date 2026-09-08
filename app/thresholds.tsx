import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { NumberRow } from '@/components/NumberRow';
import { Card, Divider, SectionLabel } from '@/components/primitives';
import { CONFIG_LIMITS } from '@/lib/config';
import { useSettings } from '@/store/settings';
import { colors, fonts, touchSlop } from '@/theme';

/**
 * Progi decydujące o werdykcie nocy. Osobny ekran, bo jest ich kilkanaście —
 * w ustawieniach przykryłyby wszystko inne, a zagląda się tu rzadko: przy
 * strojeniu po kilku tygodniach porównywania werdyktów z rzeczywistością.
 */
export default function ThresholdsScreen() {
  const router = useRouter();
  const { config, updateConfig } = useSettings();
  const { conditions, calendar, refresh } = config;
  const limits = CONFIG_LIMITS;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          accessibilityLabel="Wróć"
          hitSlop={touchSlop(30)}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Progi warunków</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <SectionLabel style={styles.groupLabel}>Zachmurzenie</SectionLabel>
        <Card variant="raised" style={styles.group}>
          <NumberRow
            label="Całkowite, maks."
            unit="%"
            value={conditions.maxCloudTotal}
            limits={limits.conditions.maxCloudTotal}
            onCommit={(maxCloudTotal) => updateConfig('conditions', { maxCloudTotal })}
          />
          <Divider />
          <NumberRow
            label="Niskie, maks."
            unit="%"
            value={conditions.maxCloudLow}
            limits={limits.conditions.maxCloudLow}
            onCommit={(maxCloudLow) => updateConfig('conditions', { maxCloudLow })}
          />
          <Divider />
          <NumberRow
            label="Wysokie, maks."
            unit="%"
            value={conditions.maxCloudHigh}
            limits={limits.conditions.maxCloudHigh}
            onCommit={(maxCloudHigh) => updateConfig('conditions', { maxCloudHigh })}
          />
          <Divider />
          <Text style={styles.note}>
            Chmury wysokie są tolerowane wyżej niż niskie — nie zasłaniają nieba całkiem, ale
            zabierają kontrast.
          </Text>
        </Card>

        <SectionLabel style={styles.groupLabel}>Noc</SectionLabel>
        <Card variant="raised" style={styles.group}>
          <NumberRow
            label="Porywy wiatru, maks."
            unit="km/h"
            value={conditions.maxWindGustKmh}
            limits={limits.conditions.maxWindGustKmh}
            onCommit={(maxWindGustKmh) => updateConfig('conditions', { maxWindGustKmh })}
          />
          <Divider />
          <NumberRow
            label="Porywy wiatru, z ręki"
            unit="km/h"
            value={conditions.maxWindGustHandheldKmh}
            limits={limits.conditions.maxWindGustHandheldKmh}
            onCommit={(maxWindGustHandheldKmh) =>
              updateConfig('conditions', { maxWindGustHandheldKmh })
            }
          />
          <Divider />
          <NumberRow
            label="Faza Księżyca, maks."
            unit="%"
            value={conditions.maxMoonIllumination}
            limits={limits.conditions.maxMoonIllumination}
            onCommit={(maxMoonIllumination) => updateConfig('conditions', { maxMoonIllumination })}
          />

          <Divider />
          <NumberRow
            label="Ostrzeżenie o rosie"
            unit="°C"
            value={conditions.dewWarningSpreadC}
            limits={limits.conditions.dewWarningSpreadC}
            onCommit={(dewWarningSpreadC) => updateConfig('conditions', { dewWarningSpreadC })}
          />
          <Divider />
          <NumberRow
            label="Noc wyjątkowa od oceny"
            unit="/100"
            value={conditions.exceptionalRating}
            limits={limits.conditions.exceptionalRating}
            onCommit={(exceptionalRating) => updateConfig('conditions', { exceptionalRating })}
          />
          <Divider />
          <Text style={styles.note}>
            Sesja jest domyślnie skracana wstecz od godziny wymuszonej snem, a nie odrzucana —
            jedziesz na krócej, zamiast nie jechać wcale. Powyżej oceny wyjątkowej i przy zjawisku,
            które się nie powtórzy, skracanie nie działa: taką noc zobaczysz w całości, razem z
            informacją, ile snu kosztuje.
          </Text>
          <Divider />
          <Text style={styles.note}>
            Przy większej fazie Księżyca okno liczy się tylko dla celów księżycowych i planetarnych.
            Ostrzeżenie o rosie to różnica temperatury i punktu rosy. Niższy próg wiatru dotyczy
            zestawów trzymanych z ręki — noc oceniana jest łagodniejszym z progów, a o gorszym
            informuje ostrzeżenie.
          </Text>
        </Card>

        <SectionLabel style={styles.groupLabel}>Odświeżanie danych</SectionLabel>
        <Card variant="raised" style={styles.group}>
          <NumberRow
            label="Pobieraj o godzinie"
            unit=":00"
            value={refresh.hourOfDay}
            limits={limits.refresh.hourOfDay}
            onCommit={(hourOfDay) => updateConfig('refresh', { hourOfDay })}
          />
          <Divider />
          <Text style={styles.note}>
            Dane z sieci pobierają się raz na dobę, o porze podejmowania decyzji o wyjeździe; ekrany
            czytają z zapisu i otwierają się bez sieci. Pominięty termin nadrabia się przy następnym
            uruchomieniu aplikacji. Efemerydy, cele i werdykty liczą się na urządzeniu przy każdym
            wejściu, więc zmiana progu działa natychmiast.
          </Text>
        </Card>

        <SectionLabel style={styles.groupLabel}>Kalendarz następnego dnia</SectionLabel>
        <Card variant="raised" style={styles.group}>
          <NumberRow
            label="Odrzuć przed godziną"
            unit=":00"
            value={calendar.rejectBeforeHour}
            limits={limits.calendar.rejectBeforeHour}
            onCommit={(rejectBeforeHour) => updateConfig('calendar', { rejectBeforeHour })}
          />
          <Divider />
          <NumberRow
            label="Tylko dom przed"
            unit=":00"
            value={calendar.homeOnlyBeforeHour}
            limits={limits.calendar.homeOnlyBeforeHour}
            onCommit={(homeOnlyBeforeHour) => updateConfig('calendar', { homeOnlyBeforeHour })}
          />
          <Divider />
          <NumberRow
            label="Warunki wybitne: chmury"
            unit="%"
            value={calendar.exceptionalMaxCloud}
            limits={limits.calendar.exceptionalMaxCloud}
            onCommit={(exceptionalMaxCloud) => updateConfig('calendar', { exceptionalMaxCloud })}
          />
          <Divider />
          <NumberRow
            label="Zakładana pierwsza godzina"
            unit=":00"
            value={calendar.assumedFirstEventHour}
            limits={limits.calendar.assumedFirstEventHour}
            onCommit={(assumedFirstEventHour) =>
              updateConfig('calendar', { assumedFirstEventHour })
            }
          />
          <Divider />
          <Text style={styles.note}>
            Wcześniejsze wydarzenie odrzuca sesję, chyba że noc jest wybitna: zachmurzenie poniżej
            progu, Księżyc pod horyzontem i zjawisko niepowtarzalne w tym miesiącu. Zakładana
            godzina obowiązuje w dni robocze do czasu podpięcia prawdziwego kalendarza.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  back: {
    padding: 4,
  },
  title: {
    fontFamily: fonts.sansMedium,
    fontSize: 20,
    color: colors.textPrimary,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  groupLabel: {
    marginBottom: 8,
  },
  group: {
    padding: 0,
    marginBottom: 20,
  },
  note: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
