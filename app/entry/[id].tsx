import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { journalEntry } from '@/mock/journal';
import { colors, fonts } from '@/theme';
import { Body, Field, Label, Note, Panel, Screen, Stat, TitleBar } from '@/ui/kit';

/**
 * 14b: wpis nocy. Nieudane podejście ma własny kolor i powód, bo tylko ono
 * mówi, gdzie silnik obiecał za dużo. Zmierzone godziny stoją obok planowanych.
 */
export default function EntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entry = journalEntry(id);
  const [editing, setEditing] = useState(false);
  const [times, setTimes] = useState(entry.timeline.map((step) => step.actual ?? ''));

  return (
    <Screen>
      <TitleBar
        back
        title={entry.date}
        subtitle={entry.subtitle}
        right="Edytuj"
        onRightPress={() => router.push('/close-night')}
      />

      <View style={styles.row}>
        <Panel style={styles.flex}>
          <Stat label="przejrzystość" value={entry.transparency} />
        </Panel>
        <Panel style={styles.flex}>
          <Stat label="spokój" value={entry.seeing} />
        </Panel>
      </View>

      <Label>Cele tej nocy</Label>
      {entry.targets.map((target) => (
        <Panel key={target.name} tone={target.seen ? undefined : 'warn'} style={styles.target}>
          <Text style={[styles.mark, { color: target.seen ? colors.green : colors.amber }]}>
            {target.seen ? '✓' : '✕'}
          </Text>
          <View style={styles.flex}>
            <Text style={styles.targetName}>{target.name}</Text>
            {target.why ? <Text style={styles.why}>{target.why}</Text> : null}
          </View>
        </Panel>
      ))}

      <Panel>
        <View style={styles.between}>
          <Label flush>Przebieg nocy</Label>
          <Pressable
            onPress={() => setEditing((value) => !value)}
            hitSlop={12}
            accessibilityRole="button"
          >
            <Text style={styles.link}>{editing ? 'Gotowe' : 'Popraw godziny'}</Text>
          </Pressable>
        </View>
        {entry.timeline.map((step, i) => (
          <View key={step.label} style={styles.timeRow}>
            <Text style={styles.timeLabel}>{step.label}</Text>
            {editing ? (
              <Field
                value={times[i]}
                onChangeText={(value) =>
                  setTimes((all) => all.map((time, j) => (j === i ? value : time)))
                }
                placeholder="--:--"
                keyboardType="numbers-and-punctuation"
                style={styles.timeField}
              />
            ) : (
              <View style={[styles.timeBox, !times[i] && styles.timeBoxEmpty]}>
                <Text style={styles.timeValue}>{times[i] || '--:--'}</Text>
              </View>
            )}
            <Text style={styles.plan}>{step.plan}</Text>
          </View>
        ))}
        <Note>{entry.timelineNote}</Note>
      </Panel>

      <Label>Notatka</Label>
      <Panel>
        <Body>{entry.note}</Body>
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 8 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  target: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  mark: { fontFamily: fonts.monoSemiBold, fontSize: 16, lineHeight: 20 },
  targetName: { fontFamily: fonts.sans, fontSize: 14.5, lineHeight: 20, color: colors.textPrimary },
  why: {
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
    marginTop: 4,
  },
  link: { fontFamily: fonts.sans, fontSize: 13, color: colors.purple },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  timeLabel: { width: 84, fontFamily: fonts.mono, fontSize: 12.5, color: colors.textSecondary },
  timeBox: {
    width: 64,
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeBoxEmpty: { borderStyle: 'dashed', borderColor: colors.purple },
  timeField: { width: 72, minHeight: 40, textAlign: 'center' },
  timeValue: { fontFamily: fonts.monoMedium, fontSize: 14, color: colors.textPrimary },
  plan: {
    flex: 1,
    textAlign: 'right',
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textMuted,
  },
});
