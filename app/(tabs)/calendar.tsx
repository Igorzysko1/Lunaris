import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ObservationCard, OtherEventRow, ProposalCard } from '@/components/calendar-cards';
import { Card, SectionLabel } from '@/components/primitives';
import { eventsOnDay, monthCells, unbookedNights, type MonthCell } from '@/lib/calendar-view';
import { WEEKDAYS_SHORT, formatLongDate, formatMonth, formatTime, isSameDay } from '@/lib/date';
import { googleAccessToken } from '@/lib/google-account';
import { deleteBooking, patchObservation, upsertBooking } from '@/lib/google-calendar';
import { bookingFor, bookingId } from '@/lib/session-booking';
import { describeRejection } from '@/lib/session-text';
import { rankedTargets } from '@/lib/sky-targets';
import { useBookingSite } from '@/hooks/use-booking-site';
import { useCalendarMonth } from '@/hooks/use-calendar-month';
import { useSessions } from '@/hooks/use-sessions';
import { useGoogle } from '@/store/google';
import { useSettings } from '@/store/settings';
import { HAIRLINE, colors, fonts, hexA, radius } from '@/theme';

/** Ile celów wymieniamy w opisie rezerwacji — tyle samo co przy karcie nocy. */
const TARGETS_IN_BOOKING = 5;

/**
 * Kalendarz: co jest zajęte, które noce warto zająć i edycja zapisanych obserwacji.
 *
 * Trzy rodzaje wpisów muszą się odróżniać na pierwszy rzut oka, bo tylko
 * z jednym wolno coś zrobić: obserwacje są kontrastowe i edytowalne,
 * propozycje sesji to sam zarys z ✓, a cudze wydarzenia są wyciszone i tylko
 * do odczytu — aplikacja nie rusza cudzych spotkań.
 */
export default function CalendarScreen() {
  const google = useGoogle();
  const { active, config } = useSettings();
  const site = useBookingSite();
  const { sessions } = useSessions(active.coords, active.bortle, config, active.walkMinutes);

  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date>(today);

  const month = useCalendarMonth(cursor, config.calendar.calendarIds);

  const cells = useMemo(() => monthCells(cursor.getFullYear(), cursor.getMonth()), [cursor]);
  const weeks = useMemo(
    () => Array.from({ length: 6 }, (_, i) => cells.slice(i * 7, i * 7 + 7)),
    [cells],
  );

  // Te same rezerwacje, które buduje karta nocy — identyfikator i treść liczone
  // z tego samego miejsca, więc ✓ tutaj i przycisk tam trafiają w jeden wpis.
  const nights = useMemo(
    () =>
      sessions.map((session) => {
        const booking = bookingFor({
          verdict: session.verdict,
          site,
          rating: session.rating,
          targets: rankedTargets(session.targets, TARGETS_IN_BOOKING).map((t) => t.name),
        });
        return {
          session,
          booking,
          bookingId: bookingId(session.verdict.night, site.id),
          bookable: booking !== null,
        };
      }),
    [sessions, site],
  );

  // Zarysy tylko wtedy, gdy wiadomo, co jest w kalendarzu — inaczej propozycja
  // stanęłaby obok rezerwacji, której jeszcze nie pobraliśmy.
  const proposals = month.known ? unbookedNights(nights, month.events) : [];

  const shiftMonth = (delta: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  /** Akcja na koncie Google; udana odświeża miesiąc, żeby ekran pokazał wynik. */
  const withToken = async (action: (token: string) => Promise<boolean>) => {
    const auth = await googleAccessToken();
    const ok = auth.status === 'ok' && (await action(auth.token));
    if (ok) month.reload();
    return ok;
  };

  const dayEvents = eventsOnDay(month.events, selected);
  const dayProposals = proposals.filter((p) => p.booking && isSameDay(p.booking.start, selected));
  const dayNight = nights.find((n) => isSameDay(n.session.verdict.night.from, selected));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Kalendarz</Text>

        {!google.available ? (
          <Card variant="raised" style={styles.notice}>
            <Text style={styles.noticeText}>
              Kalendarz Google działa tylko we własnym buildzie na Androida. Werdykty nocy widać
              poniżej, ale bez wpisów z kalendarza.
            </Text>
          </Card>
        ) : google.connected === false ? (
          <Card variant="raised" style={styles.notice}>
            <Text style={styles.noticeText}>
              Połącz Kalendarz Google, żeby zobaczyć tu swoje wydarzenia, propozycje sesji i
              zapisane obserwacje.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void google.connect()}
              disabled={google.busy}
              style={styles.connect}
            >
              <Text style={styles.connectText}>{google.busy ? 'Łączę…' : 'Połącz z Google'}</Text>
            </Pressable>
          </Card>
        ) : null}

        <View style={styles.monthNav}>
          <Pressable
            accessibilityRole="button"
            onPress={() => shiftMonth(-1)}
            accessibilityLabel="Poprzedni miesiąc"
            style={styles.navButton}
          >
            <Ionicons name="chevron-back" size={20} color={colors.purple} />
          </Pressable>
          <Text style={styles.monthLabel}>{formatMonth(cursor)}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => shiftMonth(1)}
            accessibilityLabel="Następny miesiąc"
            style={styles.navButton}
          >
            <Ionicons name="chevron-forward" size={20} color={colors.purple} />
          </Pressable>
        </View>

        <View style={styles.weekdays}>
          {WEEKDAYS_SHORT.map((day) => (
            <Text key={day} style={styles.weekday}>
              {day}
            </Text>
          ))}
        </View>

        {weeks.map((week, i) => (
          <View key={`week-${i}`} style={styles.week}>
            {week.map((cell) => {
              const events = eventsOnDay(month.events, cell.date);
              return (
                <DayCell
                  key={cell.date.toISOString()}
                  cell={cell}
                  isToday={isSameDay(cell.date, today)}
                  isSelected={isSameDay(cell.date, selected)}
                  observation={events.some((e) => e.observation)}
                  other={events.some((e) => !e.observation)}
                  proposal={proposals.some(
                    (p) => p.booking && isSameDay(p.booking.start, cell.date),
                  )}
                  onPress={() => setSelected(cell.date)}
                />
              );
            })}
          </View>
        ))}

        <View style={styles.legend}>
          <Legend style={styles.dotObservation} label="Obserwacja" />
          <Legend style={styles.dotProposal} label="Propozycja" />
          <Legend style={styles.dotOther} label="Inne" />
        </View>

        {month.status === 'loading' && !month.known && (
          <Text style={styles.muted}>Wczytuję kalendarz…</Text>
        )}
        {month.status === 'error' && (
          <View style={styles.errorRow}>
            <Text style={styles.errorText}>Nie udało się pobrać kalendarza.</Text>
            <Pressable accessibilityRole="button" onPress={month.reload}>
              <Text style={styles.retry}>Spróbuj ponownie</Text>
            </Pressable>
          </View>
        )}

        <SectionLabel style={styles.dayLabel}>{formatLongDate(selected)}</SectionLabel>

        {dayNight && (
          <Text
            style={dayNight.session.verdict.status === 'go' ? styles.verdictGo : styles.verdictNo}
          >
            {dayNight.session.verdict.status === 'go' && dayNight.session.verdict.window
              ? `Noc: jedź · okno ${formatTime(dayNight.session.verdict.window.from)}–${formatTime(dayNight.session.verdict.window.to)}`
              : `Noc: odpuść — ${
                  dayNight.session.verdict.rejection
                    ? describeRejection(dayNight.session.verdict.rejection)
                    : 'brak okna.'
                }`}
          </Text>
        )}

        {dayProposals.map(
          (proposal) =>
            proposal.booking && (
              <ProposalCard
                key={proposal.bookingId}
                booking={proposal.booking}
                onConfirm={() =>
                  withToken(
                    async (token) => (await upsertBooking(token, proposal.booking!)) !== null,
                  )
                }
              />
            ),
        )}

        {dayEvents.map((event) =>
          event.observation ? (
            <ObservationCard
              // Klucz z godzinami i notatką: po zapisie edytor ma wystartować
              // z nowych wartości, a nie z tych sprzed zmiany.
              key={`${event.id}-${event.start.getTime()}-${event.end.getTime()}-${event.note}`}
              event={event}
              onSave={(change) => withToken((token) => patchObservation(token, event, change))}
              onDelete={() =>
                withToken(async (token) => (await deleteBooking(token, event.id)) !== null)
              }
            />
          ) : (
            <OtherEventRow key={event.id} event={event} />
          ),
        )}

        {!dayNight && dayProposals.length === 0 && dayEvents.length === 0 && month.known && (
          <Text style={styles.muted}>Pusty dzień.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DayCell({
  cell,
  isToday,
  isSelected,
  observation,
  other,
  proposal,
  onPress,
}: {
  cell: MonthCell;
  isToday: boolean;
  isSelected: boolean;
  observation: boolean;
  other: boolean;
  proposal: boolean;
  onPress: () => void;
}) {
  const marks = [observation && 'obserwacja', proposal && 'propozycja sesji', other && 'wydarzenia']
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${formatLongDate(cell.date)}${marks ? `: ${marks}` : ''}`}
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={[styles.cell, isSelected && styles.cellSelected]}
    >
      <Text
        style={[
          styles.cellDay,
          !cell.inMonth && styles.cellDayOutside,
          isToday && styles.cellDayToday,
        ]}
      >
        {cell.date.getDate()}
      </Text>
      <View style={styles.dots}>
        {observation && <View style={[styles.dot, styles.dotObservation]} />}
        {proposal && <View style={[styles.dot, styles.dotProposal]} />}
        {other && <View style={[styles.dot, styles.dotOther]} />}
      </View>
    </Pressable>
  );
}

function Legend({ style, label }: { style: object; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, style]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingTop: 20, paddingHorizontal: 16, paddingBottom: 32 },
  title: {
    fontFamily: fonts.sansMedium,
    fontSize: 22,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  notice: { padding: 14, marginBottom: 12, gap: 10 },
  noticeText: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  connect: { minHeight: 44, justifyContent: 'center' },
  connectText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.purple },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontFamily: fonts.sansMedium, fontSize: 17, color: colors.textPrimary },
  weekdays: { flexDirection: 'row', marginTop: 4, marginBottom: 4 },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
  },
  week: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  cell: {
    flex: 1,
    aspectRatio: 0.86,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: radius.md,
    borderWidth: HAIRLINE,
    borderColor: 'transparent',
  },
  cellSelected: { backgroundColor: hexA(colors.purple, 0.2), borderColor: colors.purple },
  cellDay: { fontFamily: fonts.mono, fontSize: 13, color: colors.textPrimary },
  cellDayOutside: { color: colors.textMuted },
  cellDayToday: { color: colors.purple, fontFamily: fonts.monoSemiBold },
  dots: { flexDirection: 'row', gap: 3, minHeight: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotObservation: { backgroundColor: colors.purple },
  dotProposal: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.teal },
  dotOther: { backgroundColor: colors.textMuted },
  legend: { flexDirection: 'row', gap: 16, marginTop: 8, marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted },
  muted: { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted, marginBottom: 8 },
  errorRow: { gap: 4, marginBottom: 8 },
  errorText: { fontFamily: fonts.sans, fontSize: 13, color: colors.coral },
  retry: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.purple,
    textDecorationLine: 'underline',
  },
  dayLabel: { marginTop: 8, marginBottom: 8 },
  verdictGo: { fontFamily: fonts.sans, fontSize: 13, color: colors.teal, marginBottom: 8 },
  verdictNo: { fontFamily: fonts.sans, fontSize: 13, color: colors.textSecondary, marginBottom: 8 },
});
