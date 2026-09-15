import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { DEEP_SKY_OBJECTS } from '@/data/deep-sky';
import { colors, fonts, hexA } from '@/theme';
import { Body, Button, Label, MenuRow, Note, Panel, Sheet, todo } from '@/ui/kit';

const MONTHS = [
  'styczeń',
  'luty',
  'marzec',
  'kwiecień',
  'maj',
  'czerwiec',
  'lipiec',
  'sierpień',
  'wrzesień',
  'październik',
  'listopad',
  'grudzień',
];

/** Pole widzenia lornetki 15x70 z profilu. W makiecie stała; docelowo z `optics.ts`. */
const BINO_FOV_DEG = 4.4;
const FOV_DIAMETER = 132;

/** Werdykt zasięgu bez rachunku — przy podpinaniu wyniki wzorów z `optics.ts`. */
const MOCK_REACH = [
  { label: 'Lornetka 15x70', why: 'do policzenia: jasność graniczna, powierzchniowa i rozmiar' },
  { label: 'SCT 8″', why: 'do policzenia: jasność graniczna, powierzchniowa i rozmiar' },
];

function num(value: number, digits: number) {
  return value.toFixed(digits).replace('.', ',');
}

function sizeLabel(arcmin: number) {
  return arcmin >= 60 ? `${num(arcmin / 60, 1)}°` : `${num(arcmin, 1)}′`;
}

/**
 * 12a: profil celu w bibliotece — „czym i kiedykolwiek", w odróżnieniu od
 * panelu celu w Nocy, który odpowiada „czy dziś i o której".
 */
export default function TargetProfileSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const object = DEEP_SKY_OBJECTS.find((o) => o.id === id) ?? DEEP_SKY_OBJECTS[0];

  // Przybliżenia z projektu (tura 12): miesiąc górowania o północy z rektascensji
  // i wysokość w górowaniu dla Zawoi. Dokładność rzędu tygodni — tylko do makiety.
  const bestMonth = MONTHS[Math.floor((((object.raHours + 12) % 24) / 24) * 12 + 2.7) % 12];
  const culmination = Math.round(Math.max(0, 90 - Math.abs(49.6 - object.dec)));
  const fovShare = Math.min(1, object.sizeArcmin / 60 / BINO_FOV_DEG);
  const distance =
    object.distanceLy >= 1_000_000
      ? `${num(object.distanceLy / 1_000_000, 2)} mln lat św.`
      : `${Math.round(object.distanceLy)} lat św.`;

  const facts: [string, string][] = [
    ['jasność wizualna', `${num(object.magnitude, 1)} mag`],
    ['rozmiar kątowy', sizeLabel(object.sizeArcmin)],
    ['odległość', distance],
    ['współrzędne J2000', `RA ${num(object.raHours, 3)} h · dec ${num(object.dec, 2)}°`],
  ];

  return (
    <Sheet
      title={`${object.designation} ${object.name}`}
      subtitle={`${object.kind} · ${num(object.magnitude, 1)} mag · ${sizeLabel(object.sizeArcmin)}`}
    >
      <Panel>
        <Label flush>Czy to zobaczysz</Label>
        {MOCK_REACH.map((reach) => (
          <View key={reach.label} style={styles.reach}>
            <Text style={styles.reachMark}>?</Text>
            <View style={styles.flex}>
              <Text style={styles.title}>{reach.label}</Text>
              <Text style={styles.subtitle}>{reach.why}</Text>
            </View>
          </View>
        ))}
        <Note>Liczone dla nieba Bortle 4.</Note>
      </Panel>

      <Panel>
        <Label flush>Rozmiar w polu widzenia</Label>
        <View style={styles.fov}>
          <View
            style={[
              styles.object,
              {
                width: Math.max(4, FOV_DIAMETER * fovShare),
                height: Math.max(4, FOV_DIAMETER * fovShare),
              },
            ]}
          />
        </View>
        <Body>
          {fovShare >= 1
            ? `Nie mieści się w polu ${num(BINO_FOV_DEG, 1)}° lornetki.`
            : `${Math.round(fovShare * 100)}% średnicy pola ${num(BINO_FOV_DEG, 1)}° (15x70).`}
        </Body>
      </Panel>

      <Panel>
        <Label flush>Kiedy i jak wysoko</Label>
        <Body>Najlepszy miesiąc: {bestMonth} — wtedy góruje około północy.</Body>
        <Body>W górowaniu {culmination}° nad horyzontem z Zawoi.</Body>
      </Panel>

      <Panel>
        <Label flush>Z katalogu</Label>
        {facts.map(([key, value]) => (
          <View key={key} style={styles.fact}>
            <Text style={styles.subtitle}>{key}</Text>
            <Text style={styles.factValue}>{value}</Text>
          </View>
        ))}
      </Panel>

      <MenuRow
        title="Historia zobaczeń"
        value="3 razy · od 11 lipca"
        onPress={() => todo('Historia zobaczeń celu z dziennika')}
      />
      <Button
        label="Dopisz do planu tej nocy"
        variant="primary"
        onPress={() => todo('Dopisanie celu do planu nocy')}
      />
      <Button
        label="Pokaż w Niebie"
        onPress={() => router.navigate({ pathname: '/', params: { segment: 'sky' } })}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  reach: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 4 },
  reachMark: { width: 16, fontFamily: fonts.monoSemiBold, fontSize: 14, color: colors.textMuted },
  title: { fontFamily: fonts.sans, fontSize: 14.5, color: colors.textPrimary },
  subtitle: { fontFamily: fonts.mono, fontSize: 11.5, lineHeight: 16, color: colors.textMuted },
  fov: {
    alignSelf: 'center',
    width: FOV_DIAMETER,
    height: FOV_DIAMETER,
    borderRadius: FOV_DIAMETER / 2,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  object: { borderRadius: 999, backgroundColor: hexA(colors.purple, 0.45) },
  fact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  factValue: { flexShrink: 1, fontFamily: fonts.mono, fontSize: 12.5, color: colors.textPrimary },
});
