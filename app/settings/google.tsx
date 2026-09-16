import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Toggle } from '@/components/Toggle';
import { useCalendarChoices } from '@/hooks/use-more';
import { useGoogle } from '@/store/google';
import { colors, fonts } from '@/theme';
import { Button, Label, Note, Notice, Panel, Screen, TitleBar } from '@/ui/kit';
import { themedStyles } from '@/ui/theme';

/**
 * Więcej › Kalendarz Google. Mówi wprost, co połączenie zmienia, bo z zewnątrz
 * tego nie widać: karty wyglądają tak samo, tylko pobudka przestaje być założeniem.
 */
export default function GoogleSettingsScreen() {
  const google = useGoogle();
  const [failed, setFailed] = useState(false);
  const choices = useCalendarChoices(google.connected === true);

  async function connect() {
    setFailed((await google.connect()) === 'failed');
  }

  function disconnect() {
    Alert.alert(
      'Odłączyć Kalendarz Google?',
      'Werdykt wróci do założonej godziny pobudki, a przyciski rezerwacji znikną. Zapisane już wpisy zostają w kalendarzu.',
      [
        { text: 'Zostaw', style: 'cancel' },
        { text: 'Odłącz', style: 'destructive', onPress: () => void google.disconnect() },
      ],
    );
  }

  if (!google.available) {
    return (
      <Screen>
        <TitleBar back title="Kalendarz Google" />
        <Notice tone="neutral" mark="·">
          Logowanie do Google działa tylko we własnym buildzie na Androida — w Expo Go
          przekierowanie po zgodzie nie ma dokąd wrócić. Werdykt liczy pobudkę z założenia.
        </Notice>
      </Screen>
    );
  }

  return (
    <Screen>
      <TitleBar back title="Kalendarz Google" />

      <Panel>
        <Text style={styles.title}>
          {google.connected === null
            ? 'Sprawdzam…'
            : google.connected
              ? 'Połączono'
              : 'Nie połączono'}
        </Text>
        <Text style={styles.hint}>
          {google.connected
            ? 'Pobudka liczona z pierwszego porannego wydarzenia, a noce „jedź" mają przycisk rezerwacji.'
            : 'Po połączeniu werdykt liczy pobudkę z prawdziwego kalendarza zamiast z założenia.'}
        </Text>
        {google.connected !== null ? (
          <Button
            label={google.busy ? '…' : google.connected ? 'Odłącz' : 'Połącz z Google'}
            tone={google.connected ? 'bad' : 'accent'}
            disabled={google.busy}
            onPress={google.connected ? disconnect : () => void connect()}
          />
        ) : null}
      </Panel>
      {failed ? (
        <Notice tone="bad">
          Nie udało się połączyć z Google. Sprawdź sieć. Jeśli Google pokazał błąd klienta, klient
          OAuth musi mieć nazwę pakietu com.igormusial.lunaris, odcisk SHA-1 tego buildu i włączony
          niestandardowy schemat URI.
        </Notice>
      ) : null}

      {choices.status === 'loading' ? <Note>Wczytuję listę kalendarzy…</Note> : null}
      {choices.status === 'insufficient-scope' ? (
        <Notice>
          To połączenie powstało przed wyborem kalendarzy. Odłącz i połącz konto ponownie, żeby
          poranki liczyły się ze wszystkich Twoich kalendarzy — do tego czasu liczy się tylko
          główny.
        </Notice>
      ) : null}
      {choices.status === 'failed' ? (
        <Note>
          {`Nie udało się pobrać listy kalendarzy. Poranki liczą się z ${choices.pickedFromConfig ? 'ostatnio wybranych' : 'głównego kalendarza'}.`}
        </Note>
      ) : null}

      {choices.calendars.length > 0 ? (
        <>
          <Label>Kalendarze wyznaczające pobudkę</Label>
          <Panel>
            {choices.calendars.map((calendar) => (
              <View key={calendar.id} style={styles.row}>
                <View style={styles.flex}>
                  <Text style={styles.title} numberOfLines={1}>
                    {calendar.name}
                  </Text>
                  <Text style={styles.hint}>{calendar.hint}</Text>
                </View>
                <Toggle
                  value={calendar.chosen}
                  onPress={calendar.toggle}
                  label={`Kalendarz ${calendar.name}`}
                  disabled={calendar.locked}
                />
              </View>
            ))}
          </Panel>
          {choices.onlyOne ? (
            <Note>Co najmniej jeden kalendarz musi zostać zaznaczony.</Note>
          ) : null}

          <Label>Kalendarz dla rezerwacji</Label>
          <Panel>
            {choices.writable.map((calendar) => (
              <Pressable
                key={calendar.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: calendar.selected }}
                onPress={calendar.choose}
                style={styles.choice}
              >
                <Text style={[styles.title, styles.flex]} numberOfLines={1}>
                  {calendar.name}
                </Text>
                {calendar.selected ? (
                  <Ionicons name="checkmark" size={18} color={colors.purple} />
                ) : null}
              </Pressable>
            ))}
          </Panel>
          <Note>
            Po zmianie kalendarza dla rezerwacji wpisy z poprzedniego przestają być tu widoczne —
            zostają tam, gdzie powstały.
          </Note>
        </>
      ) : null}
    </Screen>
  );
}

const styles = themedStyles(() => ({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  title: { fontFamily: fonts.sans, fontSize: 15, color: colors.textPrimary },
  hint: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    marginTop: 2,
  },
}));
