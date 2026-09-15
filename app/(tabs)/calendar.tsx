import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  EVENTS_BEYOND,
  EVENTS_IN_FORECAST,
  MONTH_CELLS,
  MONTH_LABEL,
  SELECTED_DAY,
  TODAY,
  WEEKDAYS,
  type DayMark,
  type SkyEvent,
} from '@/mock/calendar';
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
  todo,
  type Tone,
} from '@/ui/kit';

type Segment = 'month' | 'events';

const SEGMENTS: readonly (readonly [Segment, string])[] = [
  ['month', 'Miesiąc'],
  ['events', 'Eventy'],
];

const MARK_COLOR: Record<Exclude<DayMark, null>, string> = {
  observation: colors.purple,
  proposal: colors.teal,
  other: colors.textMuted,
};

/**
 * Kalendarz — „kiedy?". Eventy tracą zakładkę, a nie adres: to ta sama oś
 * czasu co siatka miesiąca, tylko w innym porządku.
 */
export default function CalendarScreen() {
  const params = useLocalSearchParams<{ segment?: string }>();
  const [segment, setSegment] = useState<Segment>(params.segment === 'events' ? 'events' : 'month');
  const [requested, setRequested] = useState(params.segment);

  // Chip „następny event" w Noc › Niebo otwiera od razu listę zjawisk.
  if (params.segment !== requested) {
    setRequested(params.segment);
    if (params.segment === 'events') setSegment('events');
  }

  return (
    <Screen>
      <TitleBar title="Kalendarz" right="Zawoja ▾" onRightPress={() => router.push('/location')} />
      <Segments items={SEGMENTS} value={segment} onChange={setSegment} />
      {segment === 'month' ? <Month /> : <Events />}
    </Screen>
  );
}

function Month() {
  const [selected, setSelected] = useState(SELECTED_DAY.day);

  return (
    <>
      <View style={styles.monthNav}>
        <Pressable
          onPress={() => todo('Poprzedni miesiąc')}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Poprzedni miesiąc"
        >
          <Text style={styles.chevron}>‹</Text>
        </Pressable>
        <Text style={styles.month}>{MONTH_LABEL}</Text>
        <Pressable
          onPress={() => todo('Następny miesiąc')}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Następny miesiąc"
        >
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {WEEKDAYS.map((day) => (
          <Text key={day} style={styles.weekday}>
            {day}
          </Text>
        ))}
        {MONTH_CELLS.map((cell, i) => {
          const isSelected = cell.day === selected;
          const isToday = cell.day === TODAY;

          return (
            <Pressable
              key={i}
              disabled={cell.day === null}
              onPress={() => cell.day !== null && setSelected(cell.day)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              style={[
                styles.cell,
                cell.day !== null && styles.cellInMonth,
                isSelected && styles.cellSelected,
              ]}
            >
              <Text style={[styles.cellDay, isToday && styles.cellToday]}>{cell.day ?? ''}</Text>
              {cell.mark ? (
                <View style={[styles.dot, { backgroundColor: MARK_COLOR[cell.mark] }]} />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.legend}>
        <LegendDot color={MARK_COLOR.observation} label="obserwacja" />
        <LegendDot color={MARK_COLOR.proposal} label="propozycja" />
        <LegendDot color={MARK_COLOR.other} label="inne" />
      </View>
      <View style={styles.hairline} />

      {selected === SELECTED_DAY.day ? <SelectedDay /> : <EmptyDay day={selected} />}
    </>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.small}>{label}</Text>
    </View>
  );
}

/**
 * 10a/10b: propozycja z werdyktu „jedź" to zarys bez wypełnienia; ✓ robi
 * to samo, co rezerwacja z Planu — ten sam wpis, ten sam identyfikator.
 */
function SelectedDay() {
  const [booked, setBooked] = useState(false);
  const { proposal, observation, others } = SELECTED_DAY;

  return (
    <>
      <Label>{SELECTED_DAY.label}</Label>
      {booked ? (
        <>
          <Notice mark="✓" tone="go">
            Zapisano w kalendarzu.
          </Notice>
          <ObservationCard
            title={proposal.title}
            start="21:05"
            startDate="15.09"
            end="03:25"
            endDate="16.09"
            note=""
            initiallyOpen
          />
        </>
      ) : (
        <Panel tone="teal" dashed style={styles.proposal}>
          <View style={styles.flex}>
            <Text style={[styles.entryTitle, { color: colors.teal }]}>{proposal.title}</Text>
            <Text style={styles.entryTime}>{proposal.time}</Text>
            <Text style={styles.entryNote}>{proposal.note}</Text>
          </View>
          <Pressable
            onPress={() => setBooked(true)}
            accessibilityRole="button"
            accessibilityLabel="Zarezerwuj propozycję"
            style={styles.approve}
          >
            <Ionicons name="checkmark" size={28} color={colors.teal} />
          </Pressable>
        </Panel>
      )}

      <ObservationCard {...observation} />

      {others.map((event) => (
        <View key={event.title} style={styles.otherRow}>
          <Text style={styles.otherTime}>{event.time}</Text>
          <Text style={styles.otherTitle}>{event.title}</Text>
        </View>
      ))}
    </>
  );
}

function shiftTime(time: string, minutes: number) {
  const [h, m] = time.split(':').map(Number);
  const total = (h * 60 + m + minutes + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function ObservationCard({
  title,
  start,
  startDate,
  end,
  endDate,
  note,
  initiallyOpen = false,
}: {
  title: string;
  start: string;
  startDate: string;
  end: string;
  endDate: string;
  note: string;
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [from, setFrom] = useState(start);
  const [to, setTo] = useState(end);
  const [text, setText] = useState(note);

  return (
    <Panel tone="accent">
      <Pressable
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        style={styles.observationHead}
      >
        <View style={styles.flex}>
          <Text style={styles.entryTitle}>{title}</Text>
          <Text style={styles.entryTime}>
            {from} → {to}
          </Text>
          {!open && text ? <Text style={styles.entryNote}>{text}</Text> : null}
        </View>
        <Text style={styles.chevron}>{open ? '⌃' : '✎'}</Text>
      </Pressable>
      {open ? (
        <>
          <Stepper label="Początek" value={from} date={startDate} onChange={setFrom} />
          <Stepper label="Koniec" value={to} date={endDate} onChange={setTo} />
          <Field
            value={text}
            onChangeText={setText}
            placeholder="Notatka — widoczna też w Google Calendar"
            multiline
          />
          <View style={styles.row}>
            <Button
              label="Zapisz"
              tone="teal"
              onPress={() => {
                setOpen(false);
                todo('Zapis zmian wpisu w Kalendarzu Google');
              }}
              style={styles.flex}
            />
            <Button
              label="Usuń"
              tone="bad"
              onPress={() => todo('Usunięcie wpisu z Kalendarza Google')}
              style={styles.flex}
            />
          </View>
        </>
      ) : null}
    </Panel>
  );
}

/** Edycja godzin krokiem po kwadransie. */
function Stepper({
  label,
  value,
  date,
  onChange,
}: {
  label: string;
  value: string;
  date: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={[styles.entryTitle, styles.flex]}>{label}</Text>
      <Pressable
        onPress={() => onChange(shiftTime(value, -15))}
        accessibilityRole="button"
        accessibilityLabel={`${label} o kwadrans wcześniej`}
        style={styles.stepButton}
      >
        <Text style={styles.stepSign}>−</Text>
      </Pressable>
      <View style={styles.stepValue}>
        <Text style={styles.stepTime}>{value}</Text>
        <Text style={styles.small}>{date}</Text>
      </View>
      <Pressable
        onPress={() => onChange(shiftTime(value, 15))}
        accessibilityRole="button"
        accessibilityLabel={`${label} o kwadrans później`}
        style={styles.stepButton}
      >
        <Text style={styles.stepSign}>+</Text>
      </Pressable>
    </View>
  );
}

function EmptyDay({ day }: { day: number }) {
  return (
    <>
      <Label>{`${day} września`}</Label>
      <Note>Nic w kalendarzu tego dnia.</Note>
      {day === TODAY ? (
        <Button label="Idź do Nocy" tone="accent" onPress={() => router.navigate('/')} />
      ) : null}
    </>
  );
}

/**
 * 15a: granica prognozy widoczna w układzie — zjawiska w zasięgu mają werdykt
 * nocy i pełną ramkę, dalsze ramkę przerywaną i słowo „zapowiedź".
 */
function Events() {
  return (
    <>
      <Note>Policzone dla tego miejsca · prognoza sięga 7 nocy</Note>
      <Label>W zasięgu prognozy</Label>
      {EVENTS_IN_FORECAST.map((event) => (
        <SkyEventCard
          key={event.id}
          event={event}
          tone={event.chips[0]?.[1] === 'go' ? 'go' : undefined}
        />
      ))}
      <Label>Dalej niż prognoza</Label>
      {EVENTS_BEYOND.map((event) => (
        <SkyEventCard key={event.id} event={event} dashed />
      ))}
    </>
  );
}

function SkyEventCard({ event, tone, dashed }: { event: SkyEvent; tone?: Tone; dashed?: boolean }) {
  return (
    <Panel
      tone={tone}
      dashed={dashed}
      onPress={
        event.quiet
          ? undefined
          : () => router.push({ pathname: '/event/[id]', params: { id: event.id } })
      }
      style={event.quiet ? styles.quiet : undefined}
    >
      <View style={styles.eventHead}>
        <Text style={[styles.entryTitle, styles.flex]}>{event.title}</Text>
        <Text style={styles.entryTime}>{event.when}</Text>
        {event.quiet ? null : <Text style={styles.chevron}>›</Text>}
      </View>
      {event.chips.length ? (
        <ChipRow>
          {event.chips.map(([label, chipTone]) => (
            <Chip key={label} label={label} tone={chipTone} />
          ))}
        </ChipRow>
      ) : null}
      <Text style={styles.entryNote}>{event.description}</Text>
    </Panel>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 8 },
  hairline: { height: 1, backgroundColor: colors.border },
  chevron: { fontFamily: fonts.mono, fontSize: 18, color: colors.purple },
  small: { fontFamily: fonts.mono, fontSize: 11, color: colors.textMuted },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    minHeight: 44,
  },
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
  cellToday: { fontFamily: fonts.monoSemiBold, color: colors.purple },
  dot: { width: 6, height: 6, borderRadius: 3 },
  legend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
