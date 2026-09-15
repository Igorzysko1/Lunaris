import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { siteDetail } from '@/mock/where';
import { colors, fonts } from '@/theme';
import { Body, Button, Field, Label, Note, Panel, Sheet, todo, toneColor } from '@/ui/kit';

/** 11b: szczegół miejscówki — arkusz z rankingu albo katalogu. */
export default function SiteSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const site = siteDetail(id);
  const [obstacles, setObstacles] = useState(site.obstacles);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [height, setHeight] = useState('');

  function addObstacle() {
    if (!from || !to || !height) return;
    setObstacles((list) => [...list, `${from}°–${to}°: przeszkoda do ${height}°`]);
    setFrom('');
    setTo('');
    setHeight('');
  }

  return (
    <Sheet title={site.name} subtitle={site.region}>
      <Panel tone={site.verdictTone}>
        <View style={styles.between}>
          <Text style={[styles.verdict, { color: toneColor[site.verdictTone] }]}>
            {site.verdict}
          </Text>
          <Text style={styles.mono}>{site.window}</Text>
        </View>
        <Body>
          {site.summary} <Text style={styles.strong}>{site.explain}</Text>.
        </Body>
      </Panel>

      <Panel>
        <Label flush>Niebo</Label>
        <Body>{site.sky}</Body>
      </Panel>

      <Panel>
        <Label flush>Dojazd</Label>
        <Body>{site.travel}</Body>
        <Note>{site.travelNote}</Note>
      </Panel>

      {site.walk ? (
        <Panel tone={site.walk.warn ? 'warn' : undefined}>
          <Label flush tone={site.walk.warn ? 'warn' : undefined}>
            {site.walk.warn ? '! Podejście' : 'Podejście'}
          </Label>
          <Body>{site.walk.text}</Body>
          {site.walk.note ? <Note>{site.walk.note}</Note> : null}
        </Panel>
      ) : null}

      {site.unique ? (
        <Panel tone="teal">
          <Label flush tone="teal">
            Tylko stąd
          </Label>
          <Body>{site.unique}</Body>
        </Panel>
      ) : null}

      <Panel>
        <Label flush>Horyzont</Label>
        <Body>{site.horizonNote}</Body>
        {obstacles.map((obstacle, i) => (
          <Panel key={`${obstacle}-${i}`} tone="warn" style={styles.obstacle}>
            <Text style={styles.obstacleText}>{obstacle}</Text>
            <Pressable
              onPress={() => setObstacles((list) => list.filter((_, j) => j !== i))}
              hitSlop={12}
              accessibilityRole="button"
            >
              <Text style={styles.remove}>usuń</Text>
            </Pressable>
          </Panel>
        ))}
        <View style={styles.form}>
          <Field
            value={from}
            onChangeText={setFrom}
            placeholder="od°"
            keyboardType="number-pad"
            style={styles.flex}
          />
          <Field
            value={to}
            onChangeText={setTo}
            placeholder="do°"
            keyboardType="number-pad"
            style={styles.flex}
          />
          <Field
            value={height}
            onChangeText={setHeight}
            placeholder="wys.°"
            keyboardType="number-pad"
            style={styles.flex}
          />
          <Button label="+" tone="accent" onPress={addObstacle} style={styles.add} />
        </View>
      </Panel>

      <Label>Notatki z wyjazdów</Label>
      <Panel>
        <Body>{site.notes}</Body>
      </Panel>

      <Button
        label="Obserwuj stąd tej nocy"
        variant="primary"
        onPress={() => todo('Zmiana miejsca obserwacji na tę miejscówkę')}
      />
      <View style={styles.row}>
        <Button
          label="Nawiguj ↗"
          onPress={() => todo('Nawigacja do miejscówki')}
          style={styles.flex}
        />
        <Button
          label="Usuń miejsce"
          onPress={() => todo('Usuwanie miejscówki')}
          style={styles.flex}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 8 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  verdict: { fontFamily: fonts.monoMedium, fontSize: 13, letterSpacing: 2 },
  mono: { fontFamily: fonts.mono, fontSize: 12.5, color: colors.textSecondary },
  strong: { fontFamily: fonts.monoMedium },
  obstacle: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  obstacleText: { flex: 1, fontFamily: fonts.mono, fontSize: 12.5, color: colors.amber },
  remove: { fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted },
  form: { flexDirection: 'row', gap: 6 },
  add: { width: 52, paddingHorizontal: 0 },
});
