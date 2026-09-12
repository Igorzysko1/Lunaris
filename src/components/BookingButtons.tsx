import { useEffect, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { googleAccessToken } from '@/lib/google-account';
import { deleteBooking, fetchBooking, upsertBooking } from '@/lib/google-calendar';
import type { Booking } from '@/lib/session-booking';
import { useGoogle } from '@/store/google';
import { colors, fonts, radius } from '@/theme';

/** Stan wpisu w kalendarzu; `unknown`, gdy nie udało się tego sprawdzić. */
type Presence = 'booked' | 'absent' | 'unknown';

/**
 * Rezerwacja nocy w kalendarzu — zawsze na przycisk, nigdy sama.
 *
 * Wpis zasłania termin w kalendarzu, który widzą inni, więc powstaje dopiero
 * po świadomym naciśnięciu. Odwołanie pyta jeszcze raz, bo usuwa coś z widoku
 * dostępności, na który patrzą inni.
 *
 * `booking` jest `null`, gdy noc nie ma już werdyktu „jedź". Wpis sprzed zmiany
 * prognozy może jednak dalej wisieć — i to jest moment, w którym przycisk
 * odwołania jest najbardziej potrzebny, więc karta pokazuje go i wtedy.
 */
export function BookingButtons({
  bookingId,
  booking,
}: {
  bookingId: string;
  booking: Booking | null;
}) {
  const google = useGoogle();
  const connected = google.connected === true;

  // Oba stany z identyfikatorem, którego dotyczą: karta tej samej pozycji
  // listy dostaje po odświeżeniu inną noc i nie może odziedziczyć „zapisano".
  const [presence, setPresence] = useState<{ id: string; value: Presence } | null>(null);
  const [message, setMessage] = useState<{ id: string; text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!connected) return;

    let active = true;
    void (async () => {
      const auth = await googleAccessToken();
      const found = auth.status === 'ok' ? await fetchBooking(auth.token, bookingId) : null;
      if (!active) return;

      setPresence({
        id: bookingId,
        value: found === null ? 'unknown' : found.exists ? 'booked' : 'absent',
      });
    })();

    return () => {
      active = false;
    };
  }, [connected, bookingId]);

  if (!google.available || google.connected === null) return null;

  if (!connected) {
    if (!booking) return null;

    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => void google.connect()}
        disabled={google.busy}
        style={styles.connect}
      >
        <Ionicons name="calendar-outline" size={15} color={colors.purple} />
        <Text style={styles.connectText}>Połącz Kalendarz Google, żeby zarezerwować</Text>
      </Pressable>
    );
  }

  /** `null` — jeszcze sprawdzamy. */
  const current = presence?.id === bookingId ? presence.value : null;
  const note = message?.id === bookingId ? message : null;

  // Noc odpadła i nic po niej nie zostało: nie ma czego pokazywać.
  if (!booking && current !== 'booked') return null;

  const run = async (action: (token: string) => Promise<string | null>) => {
    setBusy(true);
    try {
      const auth = await googleAccessToken();
      const done = auth.status === 'ok' ? await action(auth.token) : null;

      setMessage(
        done
          ? { id: bookingId, text: done, error: false }
          : {
              id: bookingId,
              text:
                auth.status === 'disconnected'
                  ? 'Konto Google jest odłączone — połącz je ponownie w Ustawieniach.'
                  : 'Nie udało się. Sprawdź połączenie i spróbuj ponownie.',
              error: true,
            },
      );
    } finally {
      setBusy(false);
    }
  };

  const book = (confirmed: Booking) =>
    run(async (token) => {
      const result = await upsertBooking(token, confirmed);
      if (!result) return null;

      setPresence({ id: bookingId, value: 'booked' });
      return result.replaced
        ? 'Wpis zaktualizowany do bieżącej prognozy.'
        : 'Zapisano w kalendarzu.';
    });

  const cancel = () =>
    Alert.alert('Odwołać sesję?', 'Wpis tej nocy zniknie z Kalendarza Google.', [
      { text: 'Zostaw', style: 'cancel' },
      {
        text: 'Odwołaj',
        style: 'destructive',
        onPress: () =>
          void run(async (token) => {
            const result = await deleteBooking(token, bookingId);
            if (!result) return null;

            setPresence({ id: bookingId, value: 'absent' });
            return 'Sesja odwołana — wpis usunięty z kalendarza.';
          }),
      },
    ]);

  const checking = current === null;

  return (
    <View style={styles.wrap}>
      {!booking && (
        <Text style={styles.stale}>
          Ta noc nie przechodzi już progów, a jej rezerwacja wciąż jest w kalendarzu.
        </Text>
      )}

      <View style={styles.row}>
        {booking && (
          <ActionButton
            icon={current === 'booked' ? 'refresh-outline' : 'calendar-outline'}
            label={current === 'booked' ? 'Zaktualizuj wpis' : 'Zarezerwuj w kalendarzu'}
            color={colors.teal}
            onPress={() => void book(booking)}
            disabled={busy || checking}
          />
        )}
        {/* Przy nieznanym stanie też: usunięcie nieistniejącego wpisu jest
            nieszkodliwe, a ukryty przycisk przy wiszącym wpisie — nie. */}
        {(current === 'booked' || current === 'unknown') && (
          <ActionButton
            icon="close-outline"
            label="Odwołaj sesję"
            color={colors.coral}
            onPress={cancel}
            disabled={busy}
          />
        )}
        {(busy || checking) && <ActivityIndicator size="small" color={colors.textMuted} />}
      </View>

      {note && <Text style={[styles.note, note.error && styles.noteError]}>{note.text}</Text>}
    </View>
  );
}

function ActionButton({
  icon,
  label,
  color,
  onPress,
  disabled,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
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
      style={({ pressed }) => [
        styles.button,
        { borderColor: color },
        (pressed || disabled) && styles.dimmed,
      ]}
    >
      <Ionicons name={icon} size={15} color={color} />
      <Text style={[styles.buttonText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  dimmed: {
    opacity: 0.5,
  },
  buttonText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
  },
  connect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    marginTop: 4,
  },
  connectText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.purple,
  },
  stale: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.amber,
  },
  note: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  noteError: {
    color: colors.coral,
  },
});
