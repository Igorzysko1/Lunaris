import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useTargetPanel, type TargetPanelParams } from '@/hooks/use-target-panel';
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
} from '@/ui/kit';
import { HourBars, WindowBar } from '@/ui/night';
import { themedStyles } from '@/ui/theme';

/**
 * Panel celu — „czy dziś i o której". Jeden panel w dwóch stanach:
 * 6a — noc trwa, odhaczenie stoi na samej górze, bo to jedyna rzecz, którą się
 * tu robi, i od razu trafia do dziennika z godziną; 6b — przed nocą panel nie
 * udaje, że można coś odhaczyć. „Nie wyszło" zbiera się dopiero w arkuszu
 * zamknięcia nocy, z powodem.
 */
export default function TargetSheet() {
  const params = useLocalSearchParams<TargetPanelParams>();
  const panel = useTargetPanel(params);

  if (!panel.found) {
    return (
      <Sheet title={panel.name}>
        <Note>
          Tego celu nie ma w katalogu — zapis może pochodzić ze starszej wersji aplikacji.
        </Note>
      </Sheet>
    );
  }

  // Odhaczanie stoi otworem od zachodu do wschodu Słońca tej nocy — poza tym
  // oknem nie ma czego odhaczać, bo nikt wtedy nie patrzy w niebo.
  const live = panel.checkOffOpen;

  return (
    <Sheet title={panel.name} subtitle={panel.meta}>
      {panel.firstTime || panel.picked ? (
        <ChipRow>
          {panel.firstTime ? <Chip label="1. RAZ" tone="warn" /> : null}
          {panel.picked ? <Chip label="w planie tej nocy" tone="accent" /> : null}
        </ChipRow>
      ) : null}

      {live ? (
        <Panel tone="accent" style={styles.row}>
          <CheckBox
            checked={panel.seen !== null}
            tone="accent"
            onPress={panel.seen ? panel.unmark : panel.mark}
          />
          <View style={styles.flex}>
            <Text style={styles.title}>{panel.seen ?? 'Odhacz, gdy zobaczysz'}</Text>
            <Text style={styles.subtitle}>
              {panel.failed ?? `trafi do zapisu nocy ${panel.nightSpan}`}
            </Text>
          </View>
          {panel.seen ? (
            <Pressable onPress={panel.unmark} hitSlop={12} accessibilityRole="button">
              <Text style={styles.link}>cofnij</Text>
            </Pressable>
          ) : null}
        </Panel>
      ) : null}
      {!panel.readable ? (
        <Notice tone="bad">
          Zapisanego dziennika nie da się odczytać — odhaczenie nie zapisze się, żeby go nie
          nadpisać.
        </Notice>
      ) : panel.saveFailed ? (
        <Notice tone="bad">Nie udało się zapisać — dziennik jest nietknięty.</Notice>
      ) : null}
      {panel.outOfReach ? <Notice>{panel.outOfReach}</Notice> : null}

      <Panel>
        <Label flush right={panel.visibility}>
          Widoczność tej nocy
        </Label>
        <WindowBar {...panel.bar} now={live ? panel.nowOnBar : undefined} />
        {panel.overlapWarning ? <Notice>{panel.overlapWarning}</Notice> : null}
        {panel.altitude ? (
          <>
            <HourBars
              values={panel.altitude.values}
              max={90}
              highlight={panel.altitude.highlight}
              axis={panel.altitude.axis}
              height={56}
            />
            <View style={styles.between}>
              <Text style={styles.subtitle}>
                wysokość · najwyżej <Strong>{panel.altitude.highest}</Strong> o{' '}
                <Strong>{panel.altitude.highestAt}</Strong>
              </Text>
              <Text style={styles.subtitle}>{panel.altitude.azimuth}</Text>
            </View>
          </>
        ) : null}
      </Panel>

      <Label right={panel.historySummary}>Historia zobaczeń</Label>
      {panel.sightings.length ? (
        panel.sightings.map((sighting) => (
          <Panel
            key={sighting.logId}
            onPress={() => router.push({ pathname: '/entry/[id]', params: { id: sighting.logId } })}
            style={styles.row}
          >
            <View style={styles.flex}>
              <Text style={styles.title}>{sighting.date}</Text>
              <Text style={styles.subtitle}>{sighting.place}</Text>
              <Text style={styles.subtitle}>{sighting.detail}</Text>
            </View>
            <Text style={[styles.rate, !sighting.seen && styles.failed]}>{sighting.mark}</Text>
            <Text style={styles.chevron}>›</Text>
          </Panel>
        ))
      ) : (
        <Panel dashed>
          <Body>Jeszcze nie widziany. Po zapisaniu nocy pojawi się tu pierwszy wpis.</Body>
        </Panel>
      )}

      {!live && panel.optics ? (
        <>
          <Label>W tym zestawie</Label>
          <Panel>
            <Text style={styles.title}>{panel.optics.label}</Text>
            <Text style={styles.subtitle}>{panel.optics.detail}</Text>
          </Panel>
        </>
      ) : null}

      {live ? (
        <MenuRow
          dashed
          title={panel.picked ? 'Zdejmij z planu tej nocy' : 'Dopisz do planu tej nocy'}
          chevron={panel.picked ? '−' : '+'}
          onPress={panel.togglePick}
        />
      ) : (
        <>
          <Button
            label={panel.picked ? 'zdejmij z planu tej nocy' : 'dopisz do planu tej nocy'}
            tone="accent"
            onPress={panel.togglePick}
          />
          <Note>Odhaczenie pojawia się od zachodu Słońca tej nocy.</Note>
        </>
      )}
    </Sheet>
  );
}

const styles = themedStyles(() => ({
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
  rate: { fontFamily: fonts.monoMedium, fontSize: 13, color: colors.green },
  failed: { color: colors.amber },
  chevron: { fontFamily: fonts.mono, fontSize: 16, color: colors.purple },
}));
