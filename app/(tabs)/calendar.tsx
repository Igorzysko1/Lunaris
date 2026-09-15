import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  useCalendarTab,
  useObservationEditor,
  type CalendarObservation,
  type CalendarView,
} from '@/hooks/use-calendar-tab';
import { useEventsList, type EventRow } from '@/hooks/use-events';
import { colors, fonts, hexA } from '@/theme';
import {
  Button,
  Chip,
  ChipRow,
  Field,
  Label,
  Note,
  Notice,
  Panel,
  Screen,
  Segments,
  TitleBar,
} from '@/ui/kit';

type Segment = 'month' | 'events';

const SEGMENTS: readonly (readonly [Segment, string])[] = [
  ['month', 'Miesiąc'],
  ['events', 'Eventy'],
];

/**
 * Kalendarz — „kiedy?". Eventy tracą zakładkę, a nie adres: to ta sama oś
 * czasu co siatka miesiąca, tylko w innym porządku.
 */
export default function CalendarScreen() {
  const params = useLocalSearchParams<{ segment?: string }>();
  const [segment, setSegment] = useState<Segment>(params.segment === 'events' ? 'events' : 'month');
  const [requested, setRequested] = useState(params.segment);
  const calendar = useCalendarTab();

  // Chip „następny event" w Noc › Niebo otwiera od razu listę zjawisk.
  if (params.segment !== requested) {
    setRequested(params.segment);
    if (params.segment === 'events') setSegment('events');
  }

  return (
    <Screen>
      <TitleBar
        title="Kalendarz"
        right={calendar.place}
        onRightPress={() => router.push('/location')}
      />
      <Segments items={SEGMENTS} value={segment} onChange={setSegment} />
      {segment === 'month' ? <Month calendar={calendar} /> : <Events />}
    </Screen>
  );
}

function Month({ calendar }: { calendar: CalendarView }) {
  return (
    <>
      {calendar.google === 'unavailable' ? (
        <Notice tone="neutral" mark="·">
          Kalendarz Google działa tylko we własnym buildzie na Androida. Werdykty nocy widać
          poniżej, ale bez wpisów z kalendarza.
        </Notice>
      ) : null}
      {calendar.google === 'disconnected' ? (
        <Panel>
          <Note>
            Połącz Kalendarz Google, żeby zobaczyć tu swoje wydarzenia, propozycje sesji i zapisane
            obserwacje.
          </Note>
          <Button
            label={calendar.connecting ? 'Łączę…' : 'Połącz z Google'}
            tone="accent"
            disabled={calendar.connecting}
            onPress={calendar.connect}
          />
        </Panel>
      ) : null}

      <View style={styles.monthNav}>
        <Pressable
          onPress={calendar.prevMonth}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Poprzedni miesiąc"
          style={styles.navButton}
        >
          <Text style={styles.chevron}>‹</Text>
        </Pressable>
        <Text style={styles.month}>{calendar.monthLabel}</Text>
        <Pressable
          onPress={calendar.nextMonth}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Następny miesiąc"
          style={styles.navButton}
        >
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {calendar.weekdays.map((day) => (
          <Text key={day} style={styles.weekday}>
            {day}
          </Text>
        ))}
        {calendar.cells.map((cell, i) => (
          <Pressable
            key={cell.key}
            onPress={() => calendar.select(i)}
            accessibilityRole="button"
            accessibilityLabel={cell.label}
            accessibilityState={{ selected: cell.selected }}
            style={[
              styles.cell,
              cell.inMonth && styles.cellInMonth,
              cell.selected && styles.cellSelected,
            ]}
          >
            <Text
              style={[
                styles.cellDay,
                !cell.inMonth && styles.cellOutside,
                cell.today && styles.cellToday,
              ]}
            >
              {cell.day}
            </Text>
            <View style={styles.dots}>
              {cell.observation ? <View style={[styles.dot, styles.dotObservation]} /> : null}
              {cell.proposal ? <View style={[styles.dot, styles.dotProposal]} /> : null}
              {cell.other ? <View style={[styles.dot, styles.dotOther]} /> : null}
            </View>
          </Pressable>
        ))}
      </View>

      <View style={styles.legend}>
        <LegendDot style={styles.dotObservation} label="obserwacja" />
        <LegendDot style={styles.dotProposal} label="propozycja" />
        <LegendDot style={styles.dotOther} label="inne" />
      </View>
      <View style={styles.hairline} />

      {calendar.loading ? <Note>Wczytuję kalendarz…</Note> : null}
      {calendar.error ? (
        <Panel tone="bad">
          <Note>Nie udało się pobrać kalendarza.</Note>
          <Button label="Spróbuj ponownie" tone="accent" onPress={calendar.reload} />
        </Panel>
      ) : null}

      <Label>{calendar.dayLabel}</Label>
      {calendar.verdict ? (
        <Text style={[styles.verdictLine, calendar.verdict.go && styles.go]}>
          {calendar.verdict.text}
        </Text>
      ) : null}
      {calendar.proposals.map((proposal) => (
        <ProposalCard key={proposal.id} proposal={proposal} />
      ))}
      {calendar.observations.map((observation) => (
        <ObservationCard key={observation.key} observation={observation} />
      ))}
      {calendar.others.map((other) => (
        <View key={other.id} style={styles.otherRow}>
          <Text style={styles.otherTime}>{other.time}</Text>
          <Text style={styles.otherTitle}>{other.title}</Text>
        </View>
      ))}
      {calendar.empty ? <Note>Nic w kalendarzu tego dnia.</Note> : null}
      {calendar.isToday ? (
        <Button label="Idź do Nocy" tone="accent" onPress={() => router.navigate('/')} />
      ) : null}
    </>
  );
}

function LegendDot({ style, label }: { style: object; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, style]} />
      <Text style={styles.small}>{label}</Text>
    </View>
  );
}

/**
 * Propozycja z werdyktu „jedź" to zarys bez wypełnienia; ✓ robi to samo, co
 * rezerwacja z Planu — ten sam wpis, ten sam identyfikator.
 */
function ProposalCard({ proposal }: { proposal: CalendarView['proposals'][number] }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function confirm() {
    setBusy(true);
    setFailed(false);
    const ok = await proposal.confirm();
    setBusy(false);
    setFailed(!ok);
  }

  return (
    <Panel tone="teal" dashed style={styles.proposal}>
      <View style={styles.flex}>
        <Text style={[styles.entryTitle, styles.teal]}>{proposal.title}</Text>
        <Text style={styles.entryTime}>{proposal.time}</Text>
        <Text style={styles.entryNote}>{proposal.note}</Text>
        {failed ? (
          <Text style={[styles.entryNote, styles.bad]}>
            Nie udało się zarezerwować. Spróbuj ponownie.
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={() => void confirm()}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={`Zarezerwuj: ${proposal.title}`}
        accessibilityState={{ disabled: busy }}
        style={[styles.approve, busy && styles.disabled]}
      >
        <Ionicons name="checkmark" size={28} color={colors.teal} />
      </Pressable>
    </Panel>
  );
}

function ObservationCard({ observation }: { observation: CalendarObservation }) {
  const editor = useObservationEditor(observation);

  function confirmRemove() {
    Alert.alert('Usunąć obserwację?', `„${editor.title}" zniknie z Kalendarza Google.`, [
      { text: 'Zostaw', style: 'cancel' },
      { text: 'Usuń', style: 'destructive', onPress: () => void editor.remove() },
    ]);
  }

  return (
    <Panel tone="accent">
      <Pressable
        onPress={editor.toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: editor.open }}
        style={styles.observationHead}
      >
        <View style={styles.flex}>
          <Text style={styles.entryTitle}>{editor.title}</Text>
          <Text style={styles.entryTime}>{editor.span}</Text>
          {!editor.open && editor.note ? (
            <Text style={styles.entryNote} numberOfLines={2}>
              {editor.note}
            </Text>
          ) : null}
        </View>
        <Text style={styles.chevron}>{editor.open ? '⌃' : '✎'}</Text>
      </Pressable>
      {editor.open ? (
        <>
          <Stepper label="Początek" value={editor.start} />
          <Stepper label="Koniec" value={editor.end} />
          <Field
            value={editor.draftNote}
            onChangeText={editor.setNote}
            placeholder="Notatka — widoczna też w Google Calendar"
            multiline
          />
          {editor.problem ? <Notice tone="bad">{editor.problem}</Notice> : null}
          <View style={styles.row}>
            <Button
              label={editor.busy ? 'Zapisuję…' : 'Zapisz'}
              tone="teal"
              disabled={editor.busy || editor.problem !== null}
              onPress={() => void editor.save()}
              style={styles.flex}
            />
            <Button
              label="Usuń"
              tone="bad"
              disabled={editor.busy}
              onPress={confirmRemove}
              style={styles.flex}
            />
          </View>
        </>
      ) : null}
      {editor.failure ? <Notice tone="bad">{editor.failure}</Notice> : null}
    </Panel>
  );
}

/** Edycja godziny krokiem po kwadransie. */
function Stepper({
  label,
  value,
}: {
  label: string;
  value: { time: string; date: string; earlier: () => void; later: () => void };
}) {
  return (
    <View style={styles.stepper}>
      <Text style={[styles.entryTitle, styles.flex]}>{label}</Text>
      <Pressable
        onPress={value.earlier}
        accessibilityRole="button"
        accessibilityLabel={`${label} o kwadrans wcześniej`}
        style={styles.stepButton}
      >
        <Text style={styles.stepSign}>−</Text>
      </Pressable>
      <View style={styles.stepValue}>
        <Text style={styles.stepTime}>{value.time}</Text>
        <Text style={styles.small}>{value.date}</Text>
      </View>
      <Pressable
        onPress={value.later}
        accessibilityRole="button"
        accessibilityLabel={`${label} o kwadrans później`}
        style={styles.stepButton}
      >
        <Text style={styles.stepSign}>+</Text>
      </Pressable>
    </View>
  );
}

/**
 * 15a: granica prognozy widoczna w układzie — zjawiska w zasięgu mają werdykt
 * nocy i pełną ramkę, dalsze ramkę przerywaną i słowo „zapowiedź".
 */
function Events() {
  const list = useEventsList();

  return (
    <>
      <Note>{list.note}</Note>
      {list.inForecast.length > 0 ? <Label>W zasięgu prognozy</Label> : null}
      {list.inForecast.map((event) => (
        <SkyEventCard key={event.id} event={event} />
      ))}
      <Label>Dalej niż prognoza</Label>
      {list.beyond.map((event) => (
        <SkyEventCard key={event.id} event={event} dashed />
      ))}
    </>
  );
}

function SkyEventCard({ event, dashed }: { event: EventRow; dashed?: boolean }) {
  return (
    <Panel
      tone={event.chips[0]?.tone === 'go' ? 'go' : undefined}
      dashed={dashed}
      onPress={() => router.push({ pathname: '/event/[id]', params: { id: event.id } })}
      style={event.quiet ? styles.quiet : undefined}
    >
      <View style={styles.eventHead}>
        <Text style={[styles.entryTitle, styles.flex]}>{event.title}</Text>
        <Text style={styles.entryTime}>{event.when}</Text>
        <Text style={styles.chevron}>›</Text>
      </View>
      {event.chips.length ? (
        <ChipRow>
          {event.chips.map((chip) => (
            <Chip key={chip.label} label={chip.label} tone={chip.tone} />
          ))}
        </ChipRow>
      ) : null}
      <Text style={styles.entryNote}>{event.description}</Text>
      {event.note ? <Text style={styles.small}>{event.note}</Text> : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 8 },
  hairline: { height: 1, backgroundColor: colors.border },
  chevron: { fontFamily: fonts.mono, fontSize: 18, color: colors.purple },
  small: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 16, color: colors.textMuted },
  teal: { color: colors.teal },
  go: { color: colors.green },
  bad: { color: colors.coral },
  disabled: { opacity: 0.4 },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    minHeight: 44,
  },
  navButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  month: { fontFamily: fonts.sansMedium, fontSize: 17, color: colors.textPrimary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 4 },
  weekday: {
    width: '14.2857%',
    textAlign: 'center',
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
    paddingBottom: 4,
  },
  cell: {
    width: '14.2857%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cellInMonth: { backgroundColor: 'rgba(255,255,255,0.02)' },
  cellSelected: { backgroundColor: hexA(colors.purple, 0.18), borderColor: colors.purple },
  cellDay: { fontFamily: fonts.mono, fontSize: 13, color: colors.textPrimary },
  cellOutside: { color: colors.textMuted },
  cellToday: { fontFamily: fonts.monoSemiBold, color: colors.purple },
  dots: { flexDirection: 'row', gap: 3, minHeight: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotObservation: { backgroundColor: colors.purple },
  dotProposal: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.teal },
  dotOther: { backgroundColor: colors.textMuted },
  legend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  verdictLine: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  proposal: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  approve: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryTitle: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.textPrimary },
  entryTime: { fontFamily: fonts.mono, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  entryNote: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    marginTop: 4,
  },
  observationHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepButton: {
    width: 48,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepSign: { fontFamily: fonts.mono, fontSize: 18, color: colors.purple },
  stepValue: { width: 64, alignItems: 'center' },
  stepTime: { fontFamily: fonts.monoSemiBold, fontSize: 17, color: colors.textPrimary },
  otherRow: {
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  otherTime: { width: 80, fontFamily: fonts.mono, fontSize: 12.5, color: colors.textMuted },
  otherTitle: { flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.textSecondary },
  eventHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  quiet: { opacity: 0.6 },
});
