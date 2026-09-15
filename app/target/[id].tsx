import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HOUR_AXIS, targetDetail } from '@/mock/night';
import { useMock } from '@/mock/state';
import { colors, fonts } from '@/theme';
import {
  Body,
  Button,
  CheckBox,
  Chip,
  ChipRow,
  Label,
  MenuRow,
  Note,
  Notice,
  Panel,
  Sheet,
  Strong,
  todo,
} from '@/ui/kit';
import { HourBars, WindowBar } from '@/ui/night';

/**
 * Panel celu — „czy dziś i o której". Jeden panel w dwóch stanach danych:
 * 6a — sesja trwa, odhaczenie stoi na samej górze, bo to jedyna rzecz, którą
 * się tu robi; 6b — poza sesją panel nie udaje, że można coś odhaczyć.
 * „Nie wyszło" zbiera się dopiero w arkuszu zamknięcia nocy, z powodem.
 */
export default function TargetSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const target = targetDetail(id);
  const { session } = useMock();
  const live = session === 'live';
  const [seenAt, setSeenAt] = useState<string | null>(live ? target.seenAt : null);

  return (
    <Sheet title={target.name} subtitle={target.meta}>
      {target.firstTime ? (
        <ChipRow>
          <Chip label="1. RAZ" tone="warn" />
        </ChipRow>
      ) : null}

      {live ? (
        <Panel tone="accent" style={styles.row}>
          <CheckBox
            checked={seenAt !== null}
            tone="accent"
            onPress={() => setSeenAt((value) => (value ? null : '23:04'))}
          />
          <View style={styles.flex}>
            <Text style={styles.title}>
              {seenAt ? `Widziałem — ${seenAt}` : 'Odhacz, gdy zobaczysz'}
            </Text>
            <Text style={styles.subtitle}>trafi do zapisu nocy 14/15 września</Text>
          </View>
          {seenAt ? (
            <Pressable onPress={() => setSeenAt(null)} hitSlop={12} accessibilityRole="button">
              <Text style={styles.link}>cofnij</Text>
            </Pressable>
          ) : null}
        </Panel>
      ) : null}

      <Panel>
        <Label flush right={`${target.visibility} w oknie`}>
          Widoczność tej nocy
        </Label>
        <WindowBar {...target.bar} now={live ? target.bar.now : undefined} />
        {target.overlapWarning ? <Notice>{target.overlapWarning}</Notice> : null}
        {target.altitude.length ? (
          <>
            <HourBars
              values={target.altitude}
              max={90}
              highlight={[2, 6]}
              axis={HOUR_AXIS}
              height={56}
            />
            <View style={styles.between}>
              <Text style={styles.subtitle}>
                wysokość · najwyżej <Strong>{target.highest}</Strong> o{' '}
                <Strong>{target.highestAt}</Strong>
              </Text>
              <Text style={styles.subtitle}>azymut {target.azimuth}</Text>
            </View>
          </>
        ) : null}
      </Panel>

      <Label right={target.sightingsSummary}>Historia zobaczeń</Label>
      {target.sightings.length ? (
        target.sightings.map((sighting) => (
          <Panel
            key={sighting.date}
            onPress={() => router.push({ pathname: '/entry/[id]', params: { id: '2026-09-14' } })}
            style={styles.row}
          >
            <View style={styles.flex}>
              <Text style={styles.title}>{sighting.date}</Text>
              <Text style={styles.subtitle}>{sighting.place}</Text>
              <Text style={styles.subtitle}>{sighting.note}</Text>
            </View>
            <Text style={styles.rate}>{sighting.rate}</Text>
            <Text style={styles.chevron}>›</Text>
          </Panel>
        ))
      ) : (
        <Panel dashed>
          <Body>Jeszcze nie widziany. Po zapisaniu nocy pojawi się tu pierwszy wpis.</Body>
        </Panel>
      )}

      {!live && target.optics ? (
        <>
          <Label>W tym zestawie</Label>
          <Panel>
            <Text style={styles.title}>{target.optics.label}</Text>
            <Text style={styles.subtitle}>{target.optics.detail}</Text>
          </Panel>
        </>
      ) : null}

      {live ? (
        <MenuRow
          dashed
          title="Dopisz do planu tej nocy"
          chevron="+"
          onPress={() => todo('Dopisanie celu do planu nocy')}
        />
      ) : (
        <>
          <Button
            label="dopisz do planu tej nocy"
            tone="accent"
            onPress={() => todo('Dopisanie celu do planu nocy')}
          />
          <Note>Odhaczenie pojawia się po rozpoczęciu sesji.</Note>
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  between: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  title: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.textPrimary },
  subtitle: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  link: { fontFamily: fonts.sans, fontSize: 13, color: colors.purple },
  rate: { fontFamily: fonts.monoMedium, fontSize: 13, color: colors.textPrimary },
  chevron: { fontFamily: fonts.mono, fontSize: 16, color: colors.purple },
});
