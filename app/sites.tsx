import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Badge, Card, SectionLabel } from '@/components/primitives';
import { type ObservingSite } from '@/data/observing-sites';
import { bortleMeta, distanceKm, formatDistance } from '@/lib/astro';
import { skyQualityAt } from '@/lib/sky-map';
import { compassLabel, type HorizonOverride } from '@/lib/horizon';
import { capturePosition, type PositionFix } from '@/hooks/use-device-location';
import { findPlaceById, type Coords } from '@/data/places';
import { useSettings } from '@/store/settings';
import { HAIRLINE, colors, fonts, radius } from '@/theme';

/**
 * Katalog miejscówek: dokąd realnie się jeździ i co o tych miejscach wiadomo.
 *
 * Czas dojazdu jest **liczony**, a nie zapisany — z odległości i średniej prędkości
 * z profilu obserwatora. Zapisany osobno rozjechałby się przy pierwszej korekcie
 * prędkości i pokazywałby co innego niż plan wyjazdu w werdykcie nocy.
 */
type Capture =
  | { state: 'idle' }
  | { state: 'locating' }
  | { state: 'failed'; reason: 'denied' | 'unavailable' }
  | { state: 'caught'; fix: PositionFix };

export default function SitesScreen() {
  const router = useRouter();
  const {
    config,
    updateSiteNotes,
    addSiteAt,
    moveSite,
    removeSite,
    addHorizonOverride,
    removeHorizonOverride,
    selectPlace,
  } = useSettings();
  const [capture, setCapture] = useState<Capture>({ state: 'idle' });
  const [name, setName] = useState('');

  const catchPosition = async () => {
    setCapture({ state: 'locating' });
    const result = await capturePosition();
    setCapture(
      result.ok ? { state: 'caught', fix: result.fix } : { state: 'failed', reason: result.reason },
    );
  };

  const saveAsNew = (fix: PositionFix) => {
    const id = addSiteAt(name, fix.coords, fix.accuracyM);
    // Zapisany punkt od razu staje się miejscem obserwacji — po to się go
    // zapisuje, stojąc na nim.
    selectPlace(id);
    setName('');
    setCapture({ state: 'idle' });
  };

  const overwrite = (site: ObservingSite, fix: PositionFix) => {
    moveSite(site.id, fix.coords, fix.accuracyM);
    setName('');
    setCapture({ state: 'idle' });
  };

  const homePlace = config.observer.homePlaceId ? findPlaceById(config.observer.homePlaceId) : null;
  const home: Coords | null = homePlace ? { lat: homePlace.lat, lon: homePlace.lon } : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Wróć" style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Miejscówki</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SectionLabel style={styles.groupLabel}>
          {home ? `Dojazd z: ${homePlace?.name}` : 'Ustaw punkt startowy, żeby zobaczyć dojazd'}
        </SectionLabel>

        <CaptureCard
          capture={capture}
          name={name}
          sites={config.sites}
          onName={setName}
          onCatch={catchPosition}
          onCancel={() => setCapture({ state: 'idle' })}
          onSaveNew={saveAsNew}
          onOverwrite={overwrite}
        />

        {config.sites.map((site) => (
          <SiteCard
            key={site.id}
            site={site}
            home={home}
            speedKmh={config.observer.averageSpeedKmh}
            walkToleranceMin={config.observer.walkToleranceMin}
            onNotes={(notes) => updateSiteNotes(site.id, notes)}
            onRemove={() => removeSite(site.id)}
            onAddOverride={(o) => addHorizonOverride(site.id, o)}
            onRemoveOverride={(i) => removeHorizonOverride(site.id, i)}
          />
        ))}

        <Text style={styles.note}>
          Współrzędne są orientacyjne — środki obszarów, nie zweryfikowane parkingi. Bortle i czas
          podejścia to szacunki. Notatki są po to, żeby je poprawiać po wyjazdach.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Gest „jestem tutaj": łapie pozycję i pozwala zapisać ją jako nowe miejsce
 * albo poprawić współrzędne istniejącego.
 *
 * Dokładność fixa jest pokazana zawsze, bo pozycja złapana pod drzewami potrafi
 * mieć kilkadziesiąt metrów błędu — lepiej powtórzyć pomiar niż zapisać go na
 * stałe. Przy nadpisywaniu widać przesunięcie względem starego punktu:
 * „parking" i „stanowisko" dzieli często kilometr i to jest informacja.
 */
function CaptureCard({
  capture,
  name,
  sites,
  onName,
  onCatch,
  onCancel,
  onSaveNew,
  onOverwrite,
}: {
  capture: Capture;
  name: string;
  sites: ObservingSite[];
  onName: (value: string) => void;
  onCatch: () => void;
  onCancel: () => void;
  onSaveNew: (fix: PositionFix) => void;
  onOverwrite: (site: ObservingSite, fix: PositionFix) => void;
}) {
  if (capture.state === 'idle' || capture.state === 'failed') {
    return (
      <>
        <Pressable onPress={onCatch} style={styles.hereButton}>
          <Ionicons name="location" size={17} color={colors.purple} />
          <Text style={styles.hereLabel}>Jestem tutaj — zapisz to miejsce</Text>
        </Pressable>
        {capture.state === 'failed' && (
          <Text style={styles.failed}>
            {capture.reason === 'denied'
              ? 'Bez zgody na lokalizację nie odczytam pozycji.'
              : 'Nie udało się złapać pozycji. Spróbuj pod otwartym niebem.'}
          </Text>
        )}
      </>
    );
  }

  if (capture.state === 'locating') {
    return (
      <Card variant="raised" style={styles.card}>
        <Text style={styles.muted}>Szukam pozycji…</Text>
      </Card>
    );
  }

  const { fix } = capture;

  return (
    <Card variant="raised" style={styles.card}>
      <Text style={styles.name}>
        {fix.coords.lat.toFixed(5)}, {fix.coords.lon.toFixed(5)}
      </Text>
      <Text style={[styles.meta, fix.accuracyM !== null && fix.accuracyM > 30 && styles.warn]}>
        {fix.accuracyM === null
          ? 'dokładność nieznana'
          : `dokładność ±${Math.round(fix.accuracyM)} m${fix.accuracyM > 30 ? ' — słaby fix, warto powtórzyć' : ''}`}
      </Text>

      <TextInput
        style={styles.nameInput}
        value={name}
        onChangeText={onName}
        placeholder="Nazwa miejsca, np. „Błędowska, wjazd od Klucz”"
        placeholderTextColor={colors.textMuted}
      />

      <Pressable onPress={() => onSaveNew(fix)} style={styles.primary}>
        <Text style={styles.primaryLabel}>Zapisz jako nowe miejsce</Text>
      </Pressable>

      {sites.length > 0 && (
        <>
          <Text style={styles.orLabel}>albo popraw współrzędne istniejącego:</Text>
          {sites.map((site) => {
            const shiftKm = distanceKm(site, fix.coords);
            return (
              <Pressable
                key={site.id}
                onPress={() => onOverwrite(site, fix)}
                style={styles.moveRow}
              >
                <Text style={styles.moveName} numberOfLines={1}>
                  {site.name}
                </Text>
                <Text style={styles.moveShift}>
                  {shiftKm < 1 ? `${Math.round(shiftKm * 1000)} m` : formatDistance(shiftKm)} stąd
                </Text>
              </Pressable>
            );
          })}
        </>
      )}

      <Pressable onPress={onCancel}>
        <Text style={styles.cancel}>Anuluj</Text>
      </Pressable>
    </Card>
  );
}

function SiteCard({
  site,
  home,
  speedKmh,
  walkToleranceMin,
  onNotes,
  onRemove,
  onAddOverride,
  onRemoveOverride,
}: {
  site: ObservingSite;
  home: Coords | null;
  speedKmh: number;
  walkToleranceMin: number;
  onNotes: (notes: string) => void;
  onRemove: () => void;
  onAddOverride: (override: HorizonOverride) => void;
  onRemoveOverride: (index: number) => void;
}) {
  // Notatka trzymana lokalnie w trakcie pisania; do konfiguracji trafia po
  // wyjściu z pola, żeby każdy znak nie wywoływał zapisu na dysk.
  const [draft, setDraft] = useState(site.notes);

  // Wartość z katalogu jest szacunkiem z rozpoznania; mapa zna ten punkt.
  const sky = skyQualityAt(site.lat, site.lon, site.bortle);
  const bortle = bortleMeta(sky.bortle);
  const km = home ? distanceKm(home, site) : null;
  const driveMin = km === null ? null : Math.round((km / speedKmh) * 60);
  const walkTooLong = site.walkMinutes > walkToleranceMin;

  return (
    <Card variant="raised" style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.name} numberOfLines={1}>
          {site.name}
        </Text>
        <Badge label={bortle.label} color={bortle.color} />
        <Pressable onPress={onRemove} accessibilityLabel={`Usuń ${site.name}`} hitSlop={8}>
          <Ionicons name="trash-outline" size={15} color={colors.textMuted} />
        </Pressable>
      </View>

      <Text style={styles.meta}>
        {km === null ? site.region : `${formatDistance(km)} · ok. ${driveMin} min jazdy`}
      </Text>

      {/* Skąd wzięło się niebo: policzone dla punktu i odziedziczone po
          miejscowości to dwie różne wiarygodności. */}
      {site.accuracyM !== null && (
        <Text style={styles.meta}>
          zapisane z terenu, dokładność ±{Math.round(site.accuracyM)} m
        </Text>
      )}

      <Text style={styles.sky}>
        {sky.source === 'map'
          ? `Bortle ${sky.bortle} · ${sky.mpsas?.toFixed(2)} mag/arcsec² policzone dla tego punktu`
          : `Bortle ${sky.bortle} — szacunek, punkt poza wgraną mapą nieba`}
      </Text>

      <View style={styles.walkRow}>
        <Ionicons
          name="walk-outline"
          size={14}
          color={walkTooLong ? colors.amber : colors.textMuted}
        />
        <Text style={[styles.walk, walkTooLong && { color: colors.amber }]}>
          {site.walkMinutes === 0
            ? 'stanowisko przy samochodzie'
            : `${Math.round(site.walkMinutes)} min od parkingu`}
          {walkTooLong && ` — powyżej tolerancji ${walkToleranceMin} min`}
        </Text>
      </View>

      <HorizonRow site={site} onAddOverride={onAddOverride} onRemoveOverride={onRemoveOverride} />

      <TextInput
        style={styles.notes}
        value={draft}
        onChangeText={setDraft}
        onBlur={() => onNotes(draft.trim())}
        placeholder="Notatki z wyjazdu: gdzie zaparkować, jaki teren, co przeszkadza"
        placeholderTextColor={colors.textMuted}
        multiline
      />
    </Card>
  );
}

/**
 * Horyzont miejsca: policzona maska i ręczne korekty.
 *
 * Korekta bije maskę, bo jedna linijka wpisana po wyjeździe bije każdy model —
 * nalot lotniczy jest sprzed kilku lat, a las przez ten czas urósł albo został
 * wycięty. Maska bez tej furtki starzeje się w milczeniu.
 */
function HorizonRow({
  site,
  onAddOverride,
  onRemoveOverride,
}: {
  site: ObservingSite;
  onAddOverride: (override: HorizonOverride) => void;
  onRemoveOverride: (index: number) => void;
}) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [altitude, setAltitude] = useState('');

  const add = () => {
    const values = [from, to, altitude].map(Number);
    if (values.some((v) => !Number.isFinite(v))) return;

    onAddOverride({ from: values[0], to: values[1], altitude: values[2] });
    setFrom('');
    setTo('');
    setAltitude('');
  };

  const mask = site.horizonMask;
  const summary = mask
    ? `maska terenu: ${Math.round(Math.min(...mask))}–${Math.round(Math.max(...mask))}°`
    : 'brak maski terenu — obowiązuje próg 15°';

  return (
    <View style={styles.horizonBlock}>
      <Text style={styles.sky}>{summary}</Text>

      {site.horizonOverrides.map((o, i) => (
        <Pressable key={`${o.from}-${o.to}-${i}`} onPress={() => onRemoveOverride(i)}>
          <Text style={styles.override}>
            {compassLabel(o.from)}–{compassLabel(o.to)} ({o.from}°–{o.to}°): przeszkoda do{' '}
            {o.altitude}° · dotknij, aby usunąć
          </Text>
        </Pressable>
      ))}

      <View style={styles.overrideForm}>
        <TextInput
          style={styles.degInput}
          value={from}
          onChangeText={setFrom}
          placeholder="od°"
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
        />
        <TextInput
          style={styles.degInput}
          value={to}
          onChangeText={setTo}
          placeholder="do°"
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
        />
        <TextInput
          style={styles.degInput}
          value={altitude}
          onChangeText={setAltitude}
          placeholder="wys.°"
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
        />
        <Pressable onPress={add} style={styles.addOverride}>
          <Ionicons name="add" size={16} color={colors.purple} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  back: {
    padding: 4,
  },
  title: {
    fontFamily: fonts.sansMedium,
    fontSize: 20,
    color: colors.textPrimary,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  groupLabel: {
    marginBottom: 8,
  },
  card: {
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  name: {
    flex: 1,
    fontFamily: fonts.sansMedium,
    fontSize: 16,
    color: colors.textPrimary,
  },
  meta: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textSecondary,
  },
  hereButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    marginBottom: 12,
    borderRadius: radius.md,
    borderWidth: HAIRLINE,
    borderColor: colors.purple,
    backgroundColor: colors.surfaceRaised,
  },
  hereLabel: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.purple },
  failed: { fontFamily: fonts.sans, fontSize: 12, color: colors.coral, marginBottom: 12 },
  warn: { color: colors.amber },
  muted: { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted },
  nameInput: {
    marginTop: 10,
    borderRadius: 8,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textPrimary,
  },
  primary: {
    marginTop: 10,
    paddingVertical: 11,
    borderRadius: radius.md,
    backgroundColor: colors.purple,
    alignItems: 'center',
  },
  primaryLabel: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.bg },
  orLabel: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 14,
    marginBottom: 4,
  },
  moveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 9,
    borderTopWidth: HAIRLINE,
    borderTopColor: colors.border,
  },
  moveName: { flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.textPrimary },
  moveShift: { fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary },
  cancel: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 14,
  },
  sky: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  horizonBlock: { marginTop: 8 },
  override: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.amber,
    marginTop: 4,
  },
  overrideForm: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  degInput: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textPrimary,
  },
  addOverride: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: HAIRLINE,
    borderColor: colors.purple,
  },
  walkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  walk: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  notes: {
    marginTop: 10,
    minHeight: 54,
    borderRadius: 8,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
  note: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    paddingHorizontal: 2,
    paddingTop: 4,
  },
});
