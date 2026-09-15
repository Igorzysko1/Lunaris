import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { saveEntryTimeline, useJournal } from '@/hooks/use-journal';
import { formatTime } from '@/lib/date';
import { TIMELINE_ROW_LABELS, failureWhy, nightSpanOfLog, timeOnNight } from '@/lib/journal-text';
import {
  TIMELINE_STEPS,
  plannedStep,
  setStepTimes,
  type TimelineStep,
} from '@/lib/session-timeline';
import { targetLabel } from '@/lib/sky-targets';
import { colors, fonts } from '@/theme';
import { Body, Field, Label, Note, Notice, Panel, Screen, Stat, TitleBar } from '@/ui/kit';

type Times = Record<TimelineStep, string>;

const clock = (iso: string | null | undefined) => (iso ? formatTime(new Date(iso)) : '');

/**
 * 14b: wpis nocy. Nieudane podejście ma własny kolor, powód i warunki, bo tylko
 * ono mówi, gdzie silnik obiecał za dużo. Zmierzone godziny stoją obok
 * planowanych; brakujące da się dopisać z pamięci.
 */
export default function EntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { journal, loaded } = useJournal();
  const [editing, setEditing] = useState(false);
  const [times, setTimes] = useState<Times>({ departed: '', arrived: '', packing: '', home: '' });
  const [error, setError] = useState<string | null>(null);

  const log = journal.logs.find((entry) => entry.id === id);

  if (!log) {
    return (
      <Screen>
        <TitleBar back title="Wpis nocy" />
        <Note>{loaded ? 'Nie ma wpisu z tej nocy.' : 'Wczytuję dziennik…'}</Note>
      </Screen>
    );
  }

  const entry = log;
  const timeline = entry.timeline ?? null;
  const planned = timeline?.planned ?? null;

  function startEditing() {
    setTimes(
      Object.fromEntries(TIMELINE_STEPS.map((step) => [step, clock(timeline?.[step])])) as Times,
    );
    setError(null);
    setEditing(true);
  }

  async function finish() {
    const changes: Partial<Record<TimelineStep, Date>> = {};

    for (const step of TIMELINE_STEPS) {
      const text = times[step].trim();
      if (text === clock(timeline?.[step])) continue;
      if (!text) {
        setError('Zapisanej godziny nie da się wyczyścić — popraw ją albo zostaw.');
        return;
      }

      const at = timeOnNight(entry.id, text);
      if (!at) {
        setError(`„${TIMELINE_ROW_LABELS[step]}": wpisz godzinę jako 21:48.`);
        return;
      }
      changes[step] = at;
    }

    if (Object.keys(changes).length > 0) {
      const next = setStepTimes(timeline, changes, new Date());
      if (!next) {
        setError(
          'Godziny muszą iść po kolei — wyjazd, na miejscu, zwijanie, w domu — i żadna nie może być w przyszłości.',
        );
        return;
      }

      const saved = await saveEntryTimeline(
        {
          id: entry.id,
          nightFrom: entry.nightFrom,
          siteId: entry.siteId,
          siteName: entry.siteName,
        },
        next,
      );
      if (!saved) {
        setError('Nie udało się zapisać godzin — poprzedni zapis został nietknięty.');
        return;
      }
    }

    setError(null);
    setEditing(false);
  }

  return (
    <Screen>
      <TitleBar
        back
        title={nightSpanOfLog(entry)}
        subtitle={entry.siteName}
        right="Edytuj"
        onRightPress={() => router.push({ pathname: '/close-night', params: { id: entry.id } })}
      />

      <View style={styles.row}>
        <Panel style={styles.flex}>
          <Stat
            label="przejrzystość"
            value={entry.transparency !== null ? `${entry.transparency} / 5` : '—'}
          />
        </Panel>
        <Panel style={styles.flex}>
          <Stat label="spokój" value={entry.seeing !== null ? `${entry.seeing} / 5` : '—'} />
        </Panel>
      </View>

      <Label>Cele tej nocy</Label>
      {entry.observations.length === 0 ? (
        <Note>Bez odhaczonych celów — tej nocy zapisano tylko przebieg albo oceny.</Note>
      ) : null}
      {entry.observations.map((observation) => {
        const seen = observation.outcome === 'seen';

        return (
          <Panel key={observation.targetId} tone={seen ? undefined : 'warn'} style={styles.target}>
            <Text style={[styles.mark, { color: seen ? colors.green : colors.amber }]}>
              {seen ? '✓' : '✕'}
            </Text>
            <View style={styles.flex}>
              <Text style={styles.targetName}>
                {targetLabel(observation.targetId).replace(' — ', ' ')}
              </Text>
              {seen ? (
                observation.seenAt ? (
                  <Text style={styles.why}>
                    {`odhaczony o ${formatTime(new Date(observation.seenAt))}`}
                  </Text>
                ) : null
              ) : (
                <Text style={styles.why}>
                  {failureWhy(observation.conditions, observation.reason)}
                </Text>
              )}
            </View>
          </Panel>
        );
      })}

      <Panel>
        <View style={styles.between}>
          <Label flush>Przebieg nocy</Label>
          <Pressable
            onPress={editing ? () => void finish() : startEditing}
            hitSlop={12}
            accessibilityRole="button"
          >
            <Text style={styles.link}>{editing ? 'Gotowe' : 'Popraw godziny'}</Text>
          </Pressable>
        </View>
        {TIMELINE_STEPS.map((step) => {
          const actual = clock(timeline?.[step]);
          const plan = clock(plannedStep(planned, step));

          return (
            <View key={step} style={styles.timeRow}>
              <Text style={styles.timeLabel}>{TIMELINE_ROW_LABELS[step]}</Text>
              {editing ? (
                <Field
                  value={times[step]}
                  onChangeText={(value) => setTimes((all) => ({ ...all, [step]: value }))}
                  placeholder="--:--"
                  keyboardType="numbers-and-punctuation"
                  style={styles.timeField}
                />
              ) : (
                <View style={[styles.timeBox, !actual && styles.timeBoxEmpty]}>
                  <Text style={styles.timeValue}>{actual || '--:--'}</Text>
                </View>
              )}
              <Text style={styles.plan}>
                {plan ? `plan ${plan}` : actual ? 'bez planu' : 'nie zmierzono'}
              </Text>
            </View>
          );
        })}
        {error ? <Notice tone="bad">{error}</Notice> : null}
        <Note>
          Godziny stoją obok planu z chwili wyjazdu, żeby było widać, gdzie plan się rozjechał.
          Dopisana z pamięci trafia w to samo miejsce co złapana w terenie.
        </Note>
      </Panel>

      {entry.note ? (
        <>
          <Label>Notatka</Label>
          <Panel>
            <Body>{entry.note}</Body>
          </Panel>
        </>
      ) : null}
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
