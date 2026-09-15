import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { useSiteDetail } from '@/hooks/use-where';
import { colors, fonts } from '@/theme';
import { Body, Button, Field, Label, Note, Panel, Sheet, toneColor } from '@/ui/kit';

/**
 * 11b: szczegół miejscówki — arkusz z rankingu albo katalogu. Werdykt dla nocy
 * wybranej w rankingu, niebo i dojazd policzone dla punktu, horyzont i notatki
 * edytowane tam, gdzie się je czyta.
 */
export default function SiteSheet() {
  const { id, night } = useLocalSearchParams<{ id: string; night?: string }>();
  const detail = useSiteDetail(id, Number(night) || 0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [height, setHeight] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [notes, setNotes] = useState<string | null>(null);

  if (!detail.site) {
    return (
      <Sheet title="Miejsce">
        <Note>Tego miejsca nie ma już w katalogu.</Note>
      </Sheet>
    );
  }

  function addObstacle() {
    if (!detail.site) return;
    const added = detail.addObstacle(from, to, height);
    setInvalid(!added);
    if (!added) return;
    setFrom('');
    setTo('');
    setHeight('');
  }

  function saveNotes() {
    if (notes === null || !detail.site) return;
    detail.saveNotes(notes);
    setNotes(null);
  }

  function confirmRemove() {
    if (!detail.site) return;
    Alert.alert('Usunąć miejsce?', detail.removeWarning, [
      { text: 'Zostaw', style: 'cancel' },
      {
        text: 'Usuń',
        style: 'destructive',
        onPress: () => {
          detail.remove();
          router.back();
        },
      },
    ]);
  }

  const { verdict } = detail;

  return (
    <Sheet title={detail.site.name} subtitle={detail.subtitle}>
      <Panel tone={verdict.tone}>
        <View style={styles.between}>
          <Text style={[styles.verdict, { color: toneColor[verdict.tone] }]}>{verdict.word}</Text>
          {verdict.window ? <Text style={styles.mono}>{verdict.window}</Text> : null}
        </View>
        <Body>
          {verdict.summary}
          {verdict.explain ? <Text style={styles.strong}> {verdict.explain}</Text> : null}
        </Body>
      </Panel>

      <Panel>
        <Label flush>Niebo</Label>
        <Body>{detail.sky}</Body>
        {detail.accuracy ? <Note>{detail.accuracy}</Note> : null}
      </Panel>

      <Panel>
        <Label flush>Dojazd</Label>
        <Body>{detail.travel}</Body>
        {detail.travelNote ? <Note>{detail.travelNote}</Note> : null}
      </Panel>

      <Panel tone={detail.walkWarn ? 'warn' : undefined}>
        <Label flush tone={detail.walkWarn ? 'warn' : undefined}>
          {detail.walkWarn ? '! Podejście' : 'Podejście'}
        </Label>
        <Body>{detail.walk}</Body>
      </Panel>

      {detail.unique ? (
        <Panel tone="teal">
          <Label flush tone="teal">
            Tylko stąd
          </Label>
          <Body>{detail.unique}</Body>
        </Panel>
      ) : null}

      <Panel>
        <Label flush>Horyzont</Label>
        <Body>{detail.horizon}</Body>
        {detail.obstacles.map((obstacle, i) => (
          <Panel key={`${obstacle}-${i}`} tone="warn" style={styles.obstacle}>
            <Text style={styles.obstacleText}>{obstacle}</Text>
            <Pressable
              onPress={() => detail.removeObstacle(i)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={`Usuń przeszkodę ${obstacle}`}
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
            keyboardType="numbers-and-punctuation"
            style={styles.flex}
          />
          <Field
            value={to}
            onChangeText={setTo}
            placeholder="do°"
            keyboardType="numbers-and-punctuation"
            style={styles.flex}
          />
          <Field
            value={height}
            onChangeText={setHeight}
            placeholder="wys.°"
            keyboardType="numbers-and-punctuation"
            style={styles.flex}
          />
          <Button label="+" tone="accent" onPress={addObstacle} style={styles.add} />
        </View>
        {invalid ? (
          <Note>
            Azymuty od 0 do 360°, wysokość od 0 do 90° — sektor może przechodzić przez północ.
          </Note>
        ) : null}
      </Panel>

      <Label>Notatki z wyjazdów</Label>
      <Field
        value={notes ?? detail.notes}
        onChangeText={setNotes}
        onEndEditing={saveNotes}
        placeholder="Gdzie zaparkować, jaki teren, co przeszkadza"
        multiline
      />

      <Button
        label={detail.observing ? 'Noc liczy już dla tego miejsca' : 'Obserwuj stąd tej nocy'}
        variant="primary"
        disabled={detail.observing}
        onPress={() => {
          detail.observeHere();
          router.navigate('/');
        }}
      />
      <View style={styles.row}>
        <Button label="Nawiguj ↗" onPress={detail.navigate} style={styles.flex} />
        <Button label="Usuń miejsce" tone="bad" onPress={confirmRemove} style={styles.flex} />
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
