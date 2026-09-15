import { Alert, StyleSheet, Text, View } from 'react-native';

import { NumberRow } from '@/components/NumberRow';
import { OPTICS_LIMITS, describeOptics, exitPupil } from '@/lib/optics';
import { useSettings } from '@/store/settings';
import { colors, fonts } from '@/theme';
import { Button, Chip, ChipRow, Field, Label, Note, Panel, Screen, TitleBar } from '@/ui/kit';

/**
 * Więcej › Sprzęt: zestawy optyki. Nazwa jest wyłącznie etykietą — nie wchodzi
 * do rachunku, więc pusta jest w porządku: pod spodem i tak widać opis z liczb.
 */
export default function EquipmentScreen() {
  const { config, addOpticsProfile, updateOpticsProfile, removeOpticsProfile } = useSettings();
  const profiles = config.opticsProfiles;

  function confirmRemove(id: string, label: string) {
    Alert.alert('Usunąć zestaw?', `„${label || 'bez nazwy'}" zniknie z listy celów i z werdyktu.`, [
      { text: 'Zostaw', style: 'cancel' },
      { text: 'Usuń', style: 'destructive', onPress: () => removeOpticsProfile(id) },
    ]);
  }

  return (
    <Screen>
      <TitleBar back title="Sprzęt" subtitle="zasięg celów liczy się dla każdego zestawu osobno" />

      {profiles.map((profile) => (
        <View key={profile.id} style={styles.group}>
          <Label>{profile.label || describeOptics(profile.optics)}</Label>
          <Panel>
            <Field
              value={profile.label}
              onChangeText={(label) => updateOpticsProfile(profile.id, { label })}
              placeholder="Nazwa zestawu, np. Lornetka 15x70"
              accessibilityLabel="Nazwa zestawu"
            />
            <NumberRow
              label="Apertura"
              unit="mm"
              value={profile.optics.aperture}
              limits={OPTICS_LIMITS.aperture}
              onCommit={(aperture) => updateOpticsProfile(profile.id, { optics: { aperture } })}
            />
            <NumberRow
              label="Powiększenie"
              unit="x"
              value={profile.optics.magnification}
              limits={OPTICS_LIMITS.magnification}
              onCommit={(magnification) =>
                updateOpticsProfile(profile.id, { optics: { magnification } })
              }
            />
            <NumberRow
              label="Pole widzenia"
              unit="°"
              value={profile.optics.fieldOfView}
              limits={OPTICS_LIMITS.fieldOfView}
              onCommit={(fieldOfView) =>
                updateOpticsProfile(profile.id, { optics: { fieldOfView } })
              }
            />
            <ChipRow>
              <Chip
                label="statyw"
                tone={profile.optics.mount === 'tripod' ? 'accent' : 'neutral'}
                onPress={() => updateOpticsProfile(profile.id, { optics: { mount: 'tripod' } })}
              />
              <Chip
                label="z ręki"
                tone={profile.optics.mount === 'handheld' ? 'accent' : 'neutral'}
                onPress={() => updateOpticsProfile(profile.id, { optics: { mount: 'handheld' } })}
              />
            </ChipRow>
            <Text style={styles.summary}>
              {`${describeOptics(profile.optics)} · źrenica ${exitPupil(profile.optics).toFixed(1).replace('.', ',')} mm`}
            </Text>
          </Panel>
          {profiles.length > 1 ? (
            <Button
              label="Usuń zestaw"
              tone="bad"
              onPress={() => confirmRemove(profile.id, profile.label)}
            />
          ) : null}
        </View>
      ))}

      <Button label="Dodaj zestaw" icon="add" tone="accent" onPress={addOpticsProfile} />
      <Note>
        Montaż z ręki ma własny próg wiatru w Progach warunków. Ostatniego zestawu nie da się usunąć
        — bez sprzętu dobór celów nie ma czego liczyć.
      </Note>
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  summary: { fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary },
});
