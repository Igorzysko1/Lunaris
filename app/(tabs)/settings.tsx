import { useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Card, Divider, Pill, SectionLabel } from '@/components/primitives';
import { Toggle } from '@/components/Toggle';
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
    optics,
    updateOptics,
    retryGps,
  } = useSettings();

  const gpsFailed = active.gpsStatus === 'denied' || active.gpsStatus === 'unavailable';

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
            value={optics.aperture}
            limits={OPTICS_LIMITS.aperture}
            onCommit={(aperture) => updateOptics({ aperture })}
          />
          <Divider />
          <NumberRow
            label="Powiększenie"
            unit="x"
            value={optics.magnification}
            limits={OPTICS_LIMITS.magnification}
            onCommit={(magnification) => updateOptics({ magnification })}
          />
          <Divider />
          <NumberRow
            label="Pole widzenia"
            unit="°"
            value={optics.fieldOfView}
            limits={OPTICS_LIMITS.fieldOfView}
            onCommit={(fieldOfView) => updateOptics({ fieldOfView })}
          />
          <Divider />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Montaż</Text>
            <View style={styles.mountPills}>
              <Pill
                label="Statyw"
                active={optics.mount === 'tripod'}
                onPress={() => updateOptics({ mount: 'tripod' })}
              />
              <Pill
                label="Z ręki"
                active={optics.mount === 'handheld'}
                onPress={() => updateOptics({ mount: 'handheld' })}
              />
            </View>
          </View>
          <Divider />
          <View style={styles.subRow}>
            <Text style={styles.subLabel}>{describeOptics(optics)}</Text>
            <Text style={styles.subValue}>źrenica {exitPupil(optics).toFixed(1)} mm</Text>
          </View>
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

/**
 * Liczba edytowana ręcznie. Stan tekstowy jest lokalny, bo w trakcie pisania pole
 * bywa puste albo niedokończone („7", zanim padnie „70") — do konfiguracji trafia
 * dopiero gotowa wartość, a niepoprawny wpis cofa się do ostatniej dobrej.
 *
 * Przycinamy tu, a nie dopiero w konfiguracji, żeby pole pokazywało wartość
 * faktycznie zapisaną: po wpisaniu apertury 5000 mm ma zostać 400, a nie 5000.
 */
function NumberRow({
  label,
  unit,
  value,
  limits,
  onCommit,
}: {
  label: string;
  unit: string;
  value: number;
  limits: { min: number; max: number };
  onCommit: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));

  const commit = () => {
    const parsed = Number(text.replace(',', '.'));

    if (!Number.isFinite(parsed)) {
      setText(String(value));
      return;
    }

    const clamped = Math.min(limits.max, Math.max(limits.min, parsed));
    setText(String(clamped));
    onCommit(clamped);
  };

  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.numberField}>
        <TextInput
          value={text}
          onChangeText={setText}
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType="decimal-pad"
          returnKeyType="done"
          selectTextOnFocus
          style={styles.numberInput}
          accessibilityLabel={label}
        />
        <Text style={styles.numberUnit}>{unit}</Text>
      </View>
    </View>
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
  mountPills: {
    flexDirection: 'row',
    gap: 8,
  },
  numberField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  numberInput: {
    minWidth: 54,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: HAIRLINE,
    borderColor: colors.border,
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.textPrimary,
    textAlign: 'right',
  },
  numberUnit: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.textMuted,
    minWidth: 20,
  },
  leadPills: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
});
