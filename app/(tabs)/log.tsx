import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { BETTER_TODAY, JOURNAL_MONTHS, SUMMARY } from '@/mock/journal';
import { colors, fonts } from '@/theme';
import { Chip, ChipRow, Label, MenuRow, Panel, Screen, Stat, TitleBar } from '@/ui/kit';

/**
 * Dziennik — „co widziałem?". Bez segmentów: jedna historia z podsumowaniem
 * sezonu na górze. Zapis nocy to arkusz, ten sam co z zakładki Noc.
 */
export default function LogScreen() {
  return (
    <Screen>
      <TitleBar
        title="Dziennik"
        right="+ zapisz noc"
        onRightPress={() => router.push('/close-night')}
      />

      <View style={styles.stats}>
        <Panel style={styles.flex}>
          <Stat label={`nocy w ${SUMMARY.year}`} value={String(SUMMARY.nights)} />
        </Panel>
        <Panel style={styles.flex}>
          <Stat label="widzianych" value={String(SUMMARY.seen)} tone="go" />
        </Panel>
        <Panel style={styles.flex}>
          <Stat label="nie wyszło" value={String(SUMMARY.failed)} tone="warn" />
        </Panel>
      </View>

      <MenuRow
        tone="accent"
        title={BETTER_TODAY}
        onPress={() => router.navigate({ pathname: '/', params: { segment: 'sky' } })}
      />

      {JOURNAL_MONTHS.map((month) => (
        <View key={month.label} style={styles.group}>
          <Label>{month.label}</Label>
          {month.entries.map((entry) => (
            <Panel
              key={entry.id}
              onPress={() => router.push({ pathname: '/entry/[id]', params: { id: entry.id } })}
            >
              <View style={styles.head}>
                <Text style={styles.date}>{entry.date}</Text>
                <Text style={styles.meta}>{entry.ratings}</Text>
                <Text style={styles.chevron}>›</Text>
              </View>
              <Text style={styles.meta}>{entry.place}</Text>
              <ChipRow>
                {entry.chips.map(([label, tone]) => (
                  <Chip key={label} label={label} tone={tone} />
                ))}
              </ChipRow>
              <Text style={styles.note}>{entry.note}</Text>
            </Panel>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stats: { flexDirection: 'row', gap: 8 },
  group: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  date: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 16, color: colors.textPrimary },
  meta: { fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary },
  chevron: { fontFamily: fonts.mono, fontSize: 16, color: colors.purple },
  note: { fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 20, color: colors.textPrimary },
});
