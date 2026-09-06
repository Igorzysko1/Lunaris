import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { NumberRow } from '@/components/NumberRow';
import { findPlaceById } from '@/data/places';
import { Card, Divider, Pill, SectionLabel } from '@/components/primitives';
import { Toggle } from '@/components/Toggle';
import { CONFIG_LIMITS } from '@/lib/config';
import { OPTICS_LIMITS, describeOptics, exitPupil } from '@/lib/optics';
import { LEAD_TIMES, useSettings } from '@/store/settings';
import { HAIRLINE, colors, fonts, radius } from '@/theme';

export default function SettingsScreen() {
  const {
    placeName,
    autoLocation,
    active,
    notifications,
    leadTime,
    toggleAutoLocation,
    toggleNotifications,
    setLeadTime,
    config,
    updateConfig,
    retryGps,
  } = useSettings();

  const gpsFailed = active.gpsStatus === 'denied' || active.gpsStatus === 'unavailable';
  const homeId = config.observer.homePlaceId;
  const homeName = homeId ? (findPlaceById(homeId)?.name ?? 'Nie ustawiono') : 'Nie ustawiono';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Ustawienia</Text>

        <SectionLabel style={styles.groupLabel}>Lokalizacja</SectionLabel>
        <Card variant="raised" style={styles.group}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Automatyczna (GPS)</Text>
            <Toggle value={autoLocation} onPress={toggleAutoLocation} />
          </View>

          {autoLocation && !gpsFailed && (
            <>
              <Divider />
              <View style={styles.subRow}>
                <Text style={styles.subLabel}>
                  {active.gpsStatus === 'loading' ? 'Ustalam pozycję…' : 'Wykryto automatycznie'}
                </Text>
                <Text style={styles.subValue}>
                  {active.source === 'gps' ? active.label : '—'}
                </Text>
              </View>
            </>
          )}

          {autoLocation && gpsFailed && (
            <>
              <Divider />
              <View style={styles.errorRow}>
                <Text style={styles.errorText}>
                  {active.gpsStatus === 'denied'
                    ? 'Brak zgody na lokalizację. Włącz ją w ustawieniach systemu.'
                    : 'Nie udało się ustalić pozycji.'}
                </Text>
                <Text style={styles.errorHint}>
                  Używam ostatnio wybranej miejscowości: {active.label}
                </Text>
                <Pressable onPress={retryGps}>
                  <Text style={styles.link}>Spróbuj ponownie</Text>
                </Pressable>
              </View>
            </>
          )}

          {!autoLocation && (
            <>
              <Divider />
              <Link href="/location" asChild>
                <Pressable style={styles.row}>
                  <Text style={styles.rowLabel}>Miejscowość</Text>
                  <View style={styles.rowValue}>
                    <Text style={styles.link}>{placeName}</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </View>
                </Pressable>
              </Link>
            </>
          )}
        </Card>

        <SectionLabel style={styles.groupLabel}>Sprzęt</SectionLabel>
        <Card variant="raised" style={styles.group}>
          <NumberRow
            label="Apertura"
            unit="mm"
            value={config.optics.aperture}
            limits={OPTICS_LIMITS.aperture}
            onCommit={(aperture) => updateConfig('optics', { aperture })}
          />
          <Divider />
          <NumberRow
            label="Powiększenie"
            unit="x"
            value={config.optics.magnification}
            limits={OPTICS_LIMITS.magnification}
            onCommit={(magnification) => updateConfig('optics', { magnification })}
          />
          <Divider />
          <NumberRow
            label="Pole widzenia"
            unit="°"
            value={config.optics.fieldOfView}
            limits={OPTICS_LIMITS.fieldOfView}
            onCommit={(fieldOfView) => updateConfig('optics', { fieldOfView })}
          />
          <Divider />
          <View style={styles.subRow}>
            <Text style={styles.subLabel}>{describeOptics(config.optics)}</Text>
            <Text style={styles.subValue}>źrenica {exitPupil(config.optics).toFixed(1)} mm</Text>
          </View>
        </Card>

        <SectionLabel style={styles.groupLabel}>Profil obserwatora</SectionLabel>
        <Card variant="raised" style={styles.group}>
          <Link href="/location?target=home" asChild>
            <Pressable style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Punkt startowy</Text>
                <Text style={styles.rowHint}>Stąd liczone są czasy dojazdu i powrotu</Text>
              </View>
              <View style={styles.rowValue}>
                <Text style={styles.link}>{homeName}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </View>
            </Pressable>
          </Link>
          <Divider />
          <NumberRow
            label="Tolerancja marszu"
            unit="min"
            value={config.observer.walkToleranceMin}
            limits={CONFIG_LIMITS.observer.walkToleranceMin}
            onCommit={(walkToleranceMin) => updateConfig('observer', { walkToleranceMin })}
          />
          <Divider />
          <NumberRow
            label="Minimum snu"
            unit="h"
            value={config.observer.minSleepHours}
            limits={CONFIG_LIMITS.observer.minSleepHours}
            onCommit={(minSleepHours) => updateConfig('observer', { minSleepHours })}
          />
          <Divider />
          <NumberRow
            label="Bufor pobudki"
            unit="min"
            value={config.observer.wakeBufferMin}
            limits={CONFIG_LIMITS.observer.wakeBufferMin}
            onCommit={(wakeBufferMin) => updateConfig('observer', { wakeBufferMin })}
          />
          <Divider />
          <NumberRow
            label="Pakowanie po sesji"
            unit="min"
            value={config.observer.packUpMin}
            limits={CONFIG_LIMITS.observer.packUpMin}
            onCommit={(packUpMin) => updateConfig('observer', { packUpMin })}
          />
        </Card>

        <SectionLabel style={styles.groupLabel}>Tryb sesji</SectionLabel>
        <Card variant="raised" style={styles.group}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>Nocleg w terenie</Text>
              <Text style={styles.rowHint}>
                {config.session.overnight
                  ? 'Powrót rano — godzina powrotu i pobudki nie są liczone.'
                  : 'Powrót tej samej nocy — stąd liczenie snu i pobudki.'}
              </Text>
            </View>
            <Toggle
              value={config.session.overnight}
              onPress={() => updateConfig('session', { overnight: !config.session.overnight })}
            />
          </View>
          <Divider />
          <NumberRow
            label="Sesja minimum"
            unit="h"
            value={config.session.minDurationHours}
            limits={CONFIG_LIMITS.session.minDurationHours}
            onCommit={(minDurationHours) => updateConfig('session', { minDurationHours })}
          />
          <Divider />
          <NumberRow
            label="Sesja maksimum"
            unit="h"
            value={config.session.maxDurationHours}
            limits={CONFIG_LIMITS.session.maxDurationHours}
            onCommit={(maxDurationHours) => updateConfig('session', { maxDurationHours })}
          />
        </Card>

        <SectionLabel style={styles.groupLabel}>Werdykt nocy</SectionLabel>
        <Card variant="raised" style={styles.group}>
          <Link href="/thresholds" asChild>
            <Pressable style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Progi warunków</Text>
                <Text style={styles.rowHint}>
                  Chmury {config.conditions.maxCloudTotal}% · wiatr{' '}
                  {config.conditions.maxWindGustKmh} km/h · Księżyc{' '}
                  {config.conditions.maxMoonIllumination}%
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          </Link>
        </Card>

        <SectionLabel style={styles.groupLabel}>Powiadomienia</SectionLabel>
        <Card variant="raised" style={styles.group}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Powiadomienia o eventach</Text>
            <Toggle value={notifications} onPress={toggleNotifications} />
          </View>

          {notifications && (
            <>
              <Divider />
              <View style={styles.leadHeader}>
                <Text style={styles.rowLabel}>Wyprzedzenie</Text>
                <Text style={styles.leadValue}>{leadTime}</Text>
              </View>
              <View style={styles.leadPills}>
                {LEAD_TIMES.map((value) => (
                  <Pill
                    key={value}
                    label={value}
                    active={leadTime === value}
                    onPress={() => setLeadTime(value)}
                    fill
                  />
                ))}
              </View>
            </>
          )}
        </Card>

        <SectionLabel style={styles.groupLabel}>O aplikacji</SectionLabel>
        <Card variant="raised" style={styles.group}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Wersja</Text>
            <Text style={styles.subValueMuted}>1.0.0</Text>
          </View>
          <Divider />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Lunaris</Text>
            <Text style={styles.aboutValue}>Aplikacja astronomiczna</Text>
          </View>
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
  content: {
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  title: {
    fontFamily: fonts.sansMedium,
    fontSize: 22,
    color: colors.textPrimary,
    marginBottom: 24,
  },
  groupLabel: {
    marginBottom: 8,
  },
  group: {
    padding: 0,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  rowLabel: {
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.textPrimary,
  },
  rowText: {
    flex: 1,
    paddingRight: 12,
  },
  rowHint: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 3,
    lineHeight: 16,
  },
  rowValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  link: {
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.purple,
  },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  subLabel: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
  },
  subValue: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.textSecondary,
  },
  subValueMuted: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.textMuted,
  },
  errorRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 6,
  },
  errorText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.coral,
  },
  errorHint: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
  },
  aboutValue: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  leadValue: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.purple,
  },
  leadPills: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
});
