import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { useJournal } from '@/hooks/use-journal';
import { useRetryTonight } from '@/hooks/use-retry-tonight';
import { yearStats } from '@/lib/journal';
import { exportJournalToFile } from '@/lib/journal-store';
import {
  entryChips,
  logsByMonth,
  nightSpanOfLog,
  ratingsLabel,
  retryLine,
} from '@/lib/journal-text';
import { colors, fonts } from '@/theme';
import {
  Chip,
  ChipRow,
  Label,
  MenuRow,
  Note,
  Notice,
  Panel,
  Screen,
  Stat,
  TitleBar,
} from '@/ui/kit';
import { themedStyles } from '@/ui/theme';

/**
 * Dziennik — „co widziałem?". Bez segmentów: jedna historia z podsumowaniem
 * roku na górze. Zapis nocy to arkusz, ten sam co z zakładki Noc.
 */
export default function LogScreen() {
  const { journal, readable, loaded } = useJournal();
  const retry = useRetryTonight(journal);
  const [year] = useState(() => new Date().getFullYear());
  const [exported, setExported] = useState<string | null>(null);

  const stats = yearStats(journal, year);
  const months = logsByMonth(journal.logs);

  async function exportAll() {
    const path = await exportJournalToFile();
    setExported(
      path ? `Zapisano kopię: ${path}` : 'Eksport się nie powiódł — dziennik jest nietknięty.',
    );
  }

  return (
    <Screen>
      <TitleBar
        title="Dziennik"
        right="+ zapisz noc"
        onRightPress={() => router.push('/close-night')}
      />

      {!readable ? (
        <Notice tone="bad">
          Zapisanego dziennika nie da się odczytać. Nic go nie nadpisze, dopóki się to nie zmieni —
          zapis zostaje na dysku nietknięty.
        </Notice>
      ) : null}

      <View style={styles.stats}>
        <Panel style={styles.flex}>
          <Stat label={`nocy w ${year}`} value={String(stats.nights)} />
        </Panel>
        <Panel style={styles.flex}>
          <Stat label="widzianych" value={String(stats.seen)} tone="go" />
        </Panel>
        <Panel style={styles.flex}>
          <Stat label="nie wyszło" value={String(stats.failed)} tone="warn" />
        </Panel>
      </View>

      {retry ? (
        <MenuRow
          tone="accent"
          title={retryLine(retry)}
          onPress={() => router.navigate({ pathname: '/', params: { segment: 'sky' } })}
        />
      ) : null}

      {loaded && journal.logs.length === 0 ? (
        <Panel dashed>
          <Text style={styles.note}>
            Jeszcze żadnej zapisanej nocy. Po wyjeździe „+ zapisz noc” — cele tej nocy są już na
            liście, wystarczy je odhaczyć.
          </Text>
        </Panel>
      ) : null}

      {months.map((month) => (
        <View key={month.heading} style={styles.group}>
          <Label>{month.heading}</Label>
          {month.logs.map((log) => (
            <Panel
              key={log.id}
              onPress={() => router.push({ pathname: '/entry/[id]', params: { id: log.id } })}
            >
              <View style={styles.head}>
                <Text style={styles.date}>{nightSpanOfLog(log)}</Text>
                <Text style={styles.meta}>{ratingsLabel(log)}</Text>
                <Text style={styles.chevron}>›</Text>
              </View>
              <Text style={styles.meta}>{log.siteName}</Text>
              {entryChips(log).length > 0 ? (
                <ChipRow>
                  {entryChips(log).map((chip) => (
                    <Chip key={chip.label} label={chip.label} tone={chip.tone} />
                  ))}
                </ChipRow>
              ) : null}
              {log.note ? (
                <Text style={styles.note} numberOfLines={2}>
                  {log.note}
                </Text>
              ) : null}
            </Panel>
          ))}
        </View>
      ))}

      {journal.logs.length > 0 ? (
        <MenuRow
          dashed
          title="Eksportuj dziennik"
          subtitle="plik JSON w dokumentach telefonu — da się go wczytać z powrotem"
          chevron="↓"
          onPress={() => void exportAll()}
        />
      ) : null}
      {exported ? <Note>{exported}</Note> : null}
    </Screen>
  );
}

const styles = themedStyles(() => ({
  flex: { flex: 1 },
  stats: { flexDirection: 'row', gap: 8 },
  group: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  date: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 16, color: colors.textPrimary },
  meta: { fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary },
  chevron: { fontFamily: fonts.mono, fontSize: 16, color: colors.purple },
  note: { fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 20, color: colors.textPrimary },
}));
