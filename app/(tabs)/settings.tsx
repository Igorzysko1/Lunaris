import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { NumberRow } from '@/components/NumberRow';
import { findPlaceById } from '@/data/places';
import { Card, Divider, Pill, SectionLabel } from '@/components/primitives';
import { Toggle } from '@/components/Toggle';
import { CONFIG_LIMITS } from '@/lib/config';
import {
  OPTICS_LIMITS,
  describeOptics,
  exitPupil,
  type Optics,
  type OpticsProfile,
} from '@/lib/optics';
import { formatAge } from '@/lib/forecast-cache';
import { useForecast } from '@/store/forecast';
import { LEAD_TIMES, useSettings } from '@/store/settings';
import { colors, fonts } from '@/theme';

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
    addOpticsProfile,
    updateOpticsProfile,
    removeOpticsProfile,
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
                <Text style={styles.subValue}>{active.source === 'gps' ? active.label : '—'}</Text>
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
        {config.opticsProfiles.map((profile) => (
          <OpticsProfileCard
            key={profile.id}
            profile={profile}
            canRemove={config.opticsProfiles.length > 1}
            onChange={(patch) => updateOpticsProfile(profile.id, patch)}
            onRemove={() => removeOpticsProfile(profile.id)}
          />
        ))}
        <Pressable onPress={addOpticsProfile} style={styles.addProfile}>
          <Ionicons name="add" size={17} color={colors.purple} />
          <Text style={styles.link}>Dodaj zestaw</Text>
        </Pressable>

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

        <SectionLabel style={styles.groupLabel}>Miejscówki</SectionLabel>
        <Card variant="raised" style={styles.group}>
          <Link href="/sites" asChild>
            <Pressable style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Katalog miejsc obserwacyjnych</Text>
                <Text style={styles.rowHint}>
                  {config.sites.length} {config.sites.length === 1 ? 'miejsce' : 'miejsc'} · dojazd,
                  dojście, notatki
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          </Link>
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

        <SectionLabel style={styles.groupLabel}>Odświeżanie danych</SectionLabel>
        <RefreshStatusCard />

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

/**
 * Znaczniki cyklu dobowego.
 *
 * Cykl, który po cichu przestał działać, jest gorszy niż jego brak: aplikacja
 * wygląda normalnie i pokazuje dane sprzed tygodnia. Dlatego obok siebie stoją
 * **próba** i **sukces** — dopiero różnica między nimi mówi, że coś się psuje —
 * a przy nich powód ostatniego niepowodzenia.
 */
function RefreshStatusCard() {
  const { cycle, refresh, refreshing } = useForecast();

  return (
    <Card variant="raised" style={styles.group}>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Ostatnie pobranie</Text>
        <Text style={styles.subValueMuted}>
          {cycle.lastSuccessAt ? formatAge(cycle.lastSuccessAt) : 'jeszcze nie było'}
        </Text>
      </View>
      <Divider />
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Ostatnia próba</Text>
        <Text style={styles.subValueMuted}>
          {cycle.lastAttemptAt ? formatAge(cycle.lastAttemptAt) : 'jeszcze nie było'}
        </Text>
      </View>
      {cycle.lastError && (
        <>
          <Divider />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Powód niepowodzenia</Text>
            <Text style={styles.aboutValue}>{cycle.lastError}</Text>
          </View>
        </>
      )}
      <Divider />
      <Pressable onPress={refresh} style={styles.row} accessibilityLabel="Odśwież dane teraz">
        <Text style={styles.rowLabel}>Odśwież teraz</Text>
        <Text style={styles.subValue}>{refreshing ? 'pobieram…' : 'pobierz'}</Text>
      </Pressable>
    </Card>
  );
}

/**
 * Jeden zestaw sprzętu. Nazwa jest wyłącznie etykietą — nie wchodzi do żadnego
 * rachunku, więc pusta jest w porządku: pod spodem i tak widnieje opis z liczb.
 */
function OpticsProfileCard({
  profile,
  canRemove,
  onChange,
  onRemove,
}: {
  profile: OpticsProfile;
  canRemove: boolean;
  onChange: (patch: { label?: string; optics?: Partial<Optics> }) => void;
  onRemove: () => void;
}) {
  return (
    <Card variant="raised" style={styles.group}>
      <View style={styles.profileHeader}>
        <TextInput
          value={profile.label}
          onChangeText={(label) => onChange({ label })}
          placeholder="Nazwa zestawu"
          placeholderTextColor={colors.textMuted}
          style={styles.profileName}
          accessibilityLabel="Nazwa zestawu"
        />
        {canRemove && (
          <Pressable onPress={onRemove} accessibilityLabel="Usuń zestaw" style={styles.remove}>
            <Ionicons name="trash-outline" size={17} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
      <Divider />
      <NumberRow
        label="Apertura"
        unit="mm"
        value={profile.optics.aperture}
        limits={OPTICS_LIMITS.aperture}
        onCommit={(aperture) => onChange({ optics: { aperture } })}
      />
      <Divider />
      <NumberRow
        label="Powiększenie"
        unit="x"
        value={profile.optics.magnification}
        limits={OPTICS_LIMITS.magnification}
        onCommit={(magnification) => onChange({ optics: { magnification } })}
      />
      <Divider />
      <NumberRow
        label="Pole widzenia"
        unit="°"
        value={profile.optics.fieldOfView}
        limits={OPTICS_LIMITS.fieldOfView}
        onCommit={(fieldOfView) => onChange({ optics: { fieldOfView } })}
      />
      <Divider />
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Montaż</Text>
        <View style={styles.mountPills}>
          <Pill
            label="Statyw"
            active={profile.optics.mount === 'tripod'}
            onPress={() => onChange({ optics: { mount: 'tripod' } })}
          />
          <Pill
            label="Z ręki"
            active={profile.optics.mount === 'handheld'}
            onPress={() => onChange({ optics: { mount: 'handheld' } })}
          />
        </View>
      </View>
      <Divider />
      <View style={styles.subRow}>
        <Text style={styles.subLabel}>{describeOptics(profile.optics)}</Text>
        <Text style={styles.subValue}>źrenica {exitPupil(profile.optics).toFixed(1)} mm</Text>
      </View>
    </Card>
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
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 6,
  },
  profileName: {
    flex: 1,
    paddingVertical: 12,
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  remove: {
    padding: 8,
  },
  addProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginBottom: 20,
  },
  mountPills: {
    flexDirection: 'row',
    gap: 8,
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
