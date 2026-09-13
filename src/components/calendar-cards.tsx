import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { checkObservationTimes, type CalendarEvent } from '@/lib/calendar-view';
import { formatShortDate, formatTime } from '@/lib/date';
import type { Booking } from '@/lib/session-booking';
import { HAIRLINE, colors, fonts, hexA, radius } from '@/theme';

/** Krok przestawiania godzin. Kwadrans wystarcza, a nie wymaga natywnego wybieraka. */
const STEP_MINUTES = 15;
const MINUTE_MS = 60_000;

const span = (start: Date, end: Date) => `${formatTime(start)} → ${formatTime(end)}`;

/**
 * Propozycja sesji — zarys wpisu, którego w Google jeszcze nie ma.
 *
 * Przerywana ramka bez wypełnienia, bo to jest cała informacja: werdykt mówi
 * „jedź", ale czas nie jest jeszcze zajęty. ✓ robi to samo, co przycisk
 * rezerwacji na karcie nocy — ten sam wpis, ten sam identyfikator.
 */
export function ProposalCard({
  booking,
  onConfirm,
}: {
  booking: Booking;
  onConfirm: () => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const confirm = async () => {
    setBusy(true);
    setFailed(false);
    const ok = await onConfirm();
    setBusy(false);
    setFailed(!ok);
  };

  return (
    <View style={styles.proposal}>
      <View style={styles.cardText}>
        <Text style={styles.proposalTitle}>{booking.title}</Text>
        <Text style={styles.time}>{span(booking.start, booking.end)}</Text>
        <Text style={styles.hint}>
          {'Propozycja z werdyktu „jedź" — w kalendarzu jej jeszcze nie ma.'}
        </Text>
        {failed && <Text style={styles.error}>Nie udało się zarezerwować. Spróbuj ponownie.</Text>}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Zarezerwuj: ${booking.title}`}
        accessibilityState={{ disabled: busy }}
        onPress={() => void confirm()}
        disabled={busy}
        style={styles.confirm}
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.teal} />
        ) : (
          <Ionicons name="checkmark" size={22} color={colors.teal} />
        )}
      </Pressable>
    </View>
  );
}

/**
 * Zapisana obserwacja — kontrastowa, z edycją godzin, notatki i usunięciem.
 *
 * Godziny przestawia się krokiem po kwadransie zamiast wybierakiem: natywny
 * wybierak daty to nowy moduł, czyli nowy build, a do przesunięcia wyjazdu
 * o pół godziny wystarczą dwa dotknięcia.
 */
export function ObservationCard({
  event,
  onSave,
  onDelete,
}: {
  event: CalendarEvent;
  onSave: (change: { start: Date; end: Date; note: string }) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(event.start);
  const [end, setEnd] = useState(event.end);
  const [note, setNote] = useState(event.note);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const problem = checkObservationTimes(start, end);
  const changed =
    start.getTime() !== event.start.getTime() ||
    end.getTime() !== event.end.getTime() ||
    note.trim() !== event.note.trim();

  const reset = () => {
    setStart(event.start);
    setEnd(event.end);
    setNote(event.note);
    setFailure(null);
    setEditing(false);
  };

  const save = async () => {
    setBusy(true);
    setFailure(null);
    const ok = await onSave({ start, end, note });
    setBusy(false);
    if (ok) setEditing(false);
    else setFailure('Nie udało się zapisać zmian.');
  };

  const remove = () =>
    Alert.alert('Usunąć obserwację?', `„${event.title}" zniknie z Kalendarza Google.`, [
      { text: 'Zostaw', style: 'cancel' },
      {
        text: 'Usuń',
        style: 'destructive',
        onPress: () =>
          void (async () => {
            setBusy(true);
            const ok = await onDelete();
            setBusy(false);
            if (!ok) setFailure('Nie udało się usunąć wpisu.');
          })(),
      },
    ]);

  return (
    <View style={styles.observation}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: editing }}
        onPress={() => (editing ? reset() : setEditing(true))}
        style={styles.observationHeader}
      >
        <View style={styles.cardText}>
          <Text style={styles.observationTitle}>{event.title}</Text>
          <Text style={styles.time}>{span(event.start, event.end)}</Text>
          {!!event.note && !editing && (
            <Text style={styles.note} numberOfLines={2}>
              {event.note}
            </Text>
          )}
        </View>
        <Ionicons
          name={editing ? 'chevron-up' : 'create-outline'}
          size={18}
          color={colors.purple}
        />
      </Pressable>

      {editing && (
        <View style={styles.editor}>
          <TimeStepper
            label="Początek"
            value={start}
            onShift={(steps) =>
              setStart(new Date(start.getTime() + steps * STEP_MINUTES * MINUTE_MS))
            }
          />
          <TimeStepper
            label="Koniec"
            value={end}
            onShift={(steps) => setEnd(new Date(end.getTime() + steps * STEP_MINUTES * MINUTE_MS))}
          />
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Notatka — widoczna też w Google Calendar"
            placeholderTextColor={colors.textMuted}
            multiline
            style={styles.noteInput}
            accessibilityLabel="Notatka do obserwacji"
          />
          {(problem || failure) && <Text style={styles.error}>{problem ?? failure}</Text>}
          <View style={styles.actions}>
            <ActionButton
              label="Zapisz"
              color={colors.teal}
              onPress={() => void save()}
              disabled={busy || problem !== null || !changed}
            />
            <ActionButton label="Usuń" color={colors.coral} onPress={remove} disabled={busy} />
            {busy && <ActivityIndicator size="small" color={colors.textMuted} />}
          </View>
        </View>
      )}
    </View>
  );
}

/** Cudze wydarzenie — tylko do odczytu, wyciszone, żeby obserwacje było widać od razu. */
export function OtherEventRow({ event }: { event: CalendarEvent }) {
  return (
    <View style={styles.other}>
      <Text style={styles.otherTime}>{event.allDay ? 'cały dzień' : formatTime(event.start)}</Text>
      <Text style={styles.otherTitle} numberOfLines={2}>
        {event.title}
      </Text>
    </View>
  );
}

/**
 * Godzina z przyciskami „wcześniej" i „później". Wspólna dla edycji obserwacji
 * w kalendarzu i poprawek przebiegu nocy — różni je tylko krok.
 */
export function TimeStepper({
  label,
  value,
  onShift,
  stepMinutes = STEP_MINUTES,
  canShift = () => true,
}: {
  label: string;
  value: Date;
  onShift: (steps: number) => void;
  stepMinutes?: number;
  /** Czy przesunięcie o tyle kroków ma sens — inaczej przycisk jest wyłączony. */
  canShift?: (steps: number) => boolean;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${stepMinutes} minut wcześniej`}
        accessibilityState={{ disabled: !canShift(-1) }}
        onPress={() => onShift(-1)}
        disabled={!canShift(-1)}
        style={[styles.stepButton, !canShift(-1) && styles.dimmed]}
      >
        <Ionicons name="remove" size={18} color={colors.purple} />
      </Pressable>
      <View style={styles.stepperValue}>
        <Text style={styles.stepperTime}>{formatTime(value)}</Text>
        {/* Dzień, bo koniec nocnej obserwacji wypada zwykle już następnego. */}
        <Text style={styles.stepperDate}>{formatShortDate(value)}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${stepMinutes} minut później`}
        accessibilityState={{ disabled: !canShift(1) }}
        onPress={() => onShift(1)}
        disabled={!canShift(1)}
        style={[styles.stepButton, !canShift(1) && styles.dimmed]}
      >
        <Ionicons name="add" size={18} color={colors.purple} />
      </Pressable>
    </View>
  );
}

function ActionButton({
  label,
  color,
  onPress,
  disabled,
}: {
  label: string;
  color: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={[styles.action, { borderColor: color }, disabled && styles.dimmed]}
    >
      <Text style={[styles.actionText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardText: {
    flex: 1,
    gap: 2,
  },
  proposal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.teal,
    borderRadius: radius.lg,
  },
  proposalTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.teal,
  },
  confirm: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  observation: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.purple,
    borderRadius: radius.lg,
    backgroundColor: hexA(colors.purple, 0.12),
  },
  observationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    minHeight: 44,
  },
  observationTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  time: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.textSecondary,
  },
  hint: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  note: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
    marginTop: 2,
  },
  error: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.coral,
  },
  editor: {
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderTopWidth: HAIRLINE,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperLabel: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textPrimary,
  },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    minWidth: 76,
    alignItems: 'center',
  },
  stepperTime: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  stepperDate: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
  },
  noteInput: {
    minHeight: 64,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    color: colors.textPrimary,
    fontFamily: fonts.sans,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  action: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
  },
  actionText: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
  },
  dimmed: {
    opacity: 0.5,
  },
  other: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: HAIRLINE,
    borderBottomColor: colors.border,
  },
  otherTime: {
    width: 76,
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textMuted,
  },
  otherTitle: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
  },
});
