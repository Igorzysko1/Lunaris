import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { eventDetail } from '@/mock/calendar';
import { Body, Button, Chip, ChipRow, Label, Note, Panel, Sheet, todo } from '@/ui/kit';

/** 15b: zjawisko — co to znaczy stąd i kiedy się odezwie. */
export default function EventSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = eventDetail(id);

  return (
    <Sheet title={event.title} subtitle={event.subtitle}>
      <Panel tone={event.status.tone}>
        <Label flush tone={event.status.tone}>
          {event.status.label}
        </Label>
        <Body>{event.status.text}</Body>
      </Panel>

      <Panel>
        <Label flush>Co to znaczy stąd</Label>
        <Body>{event.meaning}</Body>
        {event.facts.length ? (
          <ChipRow>
            {event.facts.map((fact) => (
              <Chip key={fact} label={fact} />
            ))}
          </ChipRow>
        ) : null}
      </Panel>

      <Panel>
        <Label flush>Powiadomienie</Label>
        <Body>{event.notify.text}</Body>
        {event.notify.note ? <Note>{event.notify.note}</Note> : null}
      </Panel>

      <Button
        label="Zarezerwuj tę noc w kalendarzu"
        variant="primary"
        onPress={() => todo('Rezerwacja nocy zjawiska w kalendarzu')}
      />
      <View style={styles.row}>
        <Button label={event.showLabel} onPress={() => todo(event.showLabel)} style={styles.flex} />
        <Button
          label="Wycisz to zjawisko"
          onPress={() => todo('Wyciszenie pojedynczego zjawiska')}
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
