import { router, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { useEventDetail } from '@/hooks/use-events';
import { STALE_BOOKING } from '@/lib/plan-text';
import { Body, Button, Chip, ChipRow, Label, MenuRow, Note, Notice, Panel, Sheet } from '@/ui/kit';

/** 15b: zjawisko — co to znaczy stąd, kiedy się odezwie i rezerwacja jego nocy. */
export default function EventSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useEventDetail(id);

  if (!detail.found) {
    return (
      <Sheet title="Zjawisko">
        <Note>Tego zjawiska nie ma już w horyzoncie 60 dni.</Note>
      </Sheet>
    );
  }

  const { booking, show } = detail;

  function openShow() {
    if (!show) return;
    if (show.kind === 'constellation') {
      router.push({ pathname: '/constellation/[id]', params: { id: show.id } });
    } else if (show.kind === 'target') {
      router.push({ pathname: '/target/[id]', params: { id: show.id } });
    } else {
      router.push('/moon');
    }
  }

  function confirmCancel() {
    Alert.alert('Odwołać rezerwację?', 'Wpis tej nocy zniknie z Kalendarza Google.', [
      { text: 'Zostaw', style: 'cancel' },
      { text: 'Odwołaj', style: 'destructive', onPress: booking.cancel },
    ]);
  }

  return (
    <Sheet title={detail.title} subtitle={detail.subtitle}>
      <Panel tone={detail.status.tone}>
        <Label flush tone={detail.status.tone}>
          {detail.status.label}
        </Label>
        <Body>{detail.status.text}</Body>
      </Panel>

      <Panel>
        <Label flush>Co to znaczy stąd</Label>
        <Body>{detail.meaning}</Body>
        {detail.facts.length ? (
          <ChipRow>
            {detail.facts.map((fact) => (
              <Chip key={fact} label={fact} />
            ))}
          </ChipRow>
        ) : null}
      </Panel>

      <Panel>
        <Label flush>Powiadomienie</Label>
        <Body>{detail.notify.text}</Body>
        {detail.notify.note ? <Note>{detail.notify.note}</Note> : null}
      </Panel>

      {booking.hidden ? null : !booking.connected ? (
        booking.canBook ? (
          <MenuRow
            title="Połącz Kalendarz Google, żeby zarezerwować"
            value={booking.connecting ? 'łączę…' : undefined}
            onPress={booking.connect}
          />
        ) : null
      ) : (
        <>
          {booking.stale ? <Notice>{STALE_BOOKING}</Notice> : null}
          {booking.canBook ? (
            <Button
              label={booking.booked ? 'Zaktualizuj wpis' : detail.bookLabel}
              variant="primary"
              disabled={booking.busy || booking.checking}
              onPress={booking.book}
            />
          ) : detail.cannotBook ? (
            <Note>{detail.cannotBook}</Note>
          ) : null}
          {booking.booked ? (
            <Button
              label="Odwołaj rezerwację"
              tone="bad"
              disabled={booking.busy}
              onPress={confirmCancel}
            />
          ) : null}
          {booking.message ? (
            <Notice
              tone={booking.message.error ? 'bad' : 'go'}
              mark={booking.message.error ? '!' : '✓'}
            >
              {booking.message.text}
            </Notice>
          ) : null}
          {detail.bookNote && booking.canBook ? <Note>{detail.bookNote}</Note> : null}
        </>
      )}

      <View style={styles.row}>
        {show ? <Button label={show.label} onPress={openShow} style={styles.flex} /> : null}
        <Button
          label={detail.muted ? 'Przywróć powiadomienie' : 'Wycisz to zjawisko'}
          onPress={detail.toggleMute}
          style={styles.flex}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 8 },
});
