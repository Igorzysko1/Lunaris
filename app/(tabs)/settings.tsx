import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Card, Divider, Pill, SectionLabel } from '@/components/primitives';
import { Toggle } from '@/components/Toggle';
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
