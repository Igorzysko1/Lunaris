import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as SunCalc from 'suncalc';

import { Card, SectionLabel } from '@/components/primitives';
import { formatShortDate, formatTime } from '@/lib/date';
import { horizonOf } from '@/lib/horizon';
import {
  EMPTY_JOURNAL,
  describeHistory,
  nightLogId,
  orderByHistory,
  type Journal,
  type NightLog,
  type Outcome,
  type TargetObservation,
} from '@/lib/journal';
import { exportJournalToFile, loadJournal, saveNightLog } from '@/lib/journal-store';
import {
  buildMonthlyReport,
  monthKeyOf,
  monthLabel,
  type MonthlyReport,
} from '@/lib/monthly-report';
import { lastObservedNight } from '@/lib/night-window';
import { nightTargetsForProfiles } from '@/lib/sky-targets';
import { useSettings } from '@/store/settings';
import { HAIRLINE, colors, fonts, radius, touchSlop } from '@/theme';

/**
 * Zapis nocy: co naprawdę było widać.
 *
 * Ekran jest **listą celów, które aplikacja pokazała na tę noc**, a nie pustym
 * formularzem. Wpisywanie czegokolwiek z ręki poza notatką byłoby pracą, której
 * nikt nie wykona o trzeciej nad ranem — a zapis, który nie powstaje, nie
 * kalibruje niczego.
 *
 * Trzy stany przy każdym celu, w tym jeden domyślny: brak odpowiedzi. Milczenie
 * nie jest danymi i nie może udawać, że cel odpadł.
 */
export default function JournalScreen() {
  const router = useRouter();
  const { active, config } = useSettings();

  const [journal, setJournal] = useState<Journal>(EMPTY_JOURNAL);
  const [readable, setReadable] = useState(true);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [transparency, setTransparency] = useState<number | null>(null);
  const [seeing, setSeeing] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState<string | null>(null);

  // Podgląd bieżącego miesiąca liczony tym samym rachunkiem co pełny raport
  // z CLI — inaczej po pierwszej poprawce zestawienia rozjechałyby się.
  const month = useMemo(() => buildMonthlyReport(journal, monthKeyOf(new Date())), [journal]);

  const { lat, lon } = active.coords;

  // Noc, która właśnie się skończyła albo właśnie trwa — nie ta nadchodząca.
  const night = useMemo(() => lastObservedNight(new Date(), { lat, lon }), [lat, lon]);
  const moonIllumination = Math.round(SunCalc.getMoonIllumination(night.from).fraction * 100);

  const targets = useMemo(
    () =>
      nightTargetsForProfiles(
        night,
        { lat, lon },
        config.opticsProfiles,
        active.bortle,
        horizonOf(active.horizonMask, active.horizonOverrides),
      ).filter((t) => t.visible),
    [
      night,
      lat,
      lon,
      config.opticsProfiles,
      active.bortle,
      active.horizonMask,
      active.horizonOverrides,
    ],
  );

  const ordered = useMemo(
    () => orderByHistory(targets, journal, { bortle: active.bortle, moonIllumination }),
    [targets, journal, active.bortle, moonIllumination],
  );

  useEffect(() => {
    void loadJournal().then(({ journal: stored, readable: ok }) => {
      setJournal(stored);
      setReadable(ok);

      // Noc już zapisana wraca do edycji z tym, co w niej stoi — uzupełnienie
      // po tygodniu jest normalne i nie może zaczynać od pustej listy.
      const existing = stored.logs.find((l) => l.id === nightLogId(night.from));
      if (!existing) return;

      setOutcomes(Object.fromEntries(existing.observations.map((o) => [o.targetId, o.outcome])));
      setTransparency(existing.transparency);
      setSeeing(existing.seeing);
      setNote(existing.note);
    });
  }, [night]);

  const toggle = (targetId: string, outcome: Outcome) =>
    setOutcomes((current) => {
      const next = { ...current };
      // Ponowne dotknięcie tego samego stanu wraca do „nie próbowałem".
      if (next[targetId] === outcome) delete next[targetId];
      else next[targetId] = outcome;
      return next;
    });

  const save = async () => {
    const observations: TargetObservation[] = ordered
      .filter(({ target }) => outcomes[target.id])
      .map(({ target }) => ({
        targetId: target.id,
        outcome: outcomes[target.id],
        conditions: {
          bortle: active.bortle,
          altitude: target.maxAltitude,
          moonIllumination,
        },
        profileId: target.profileId,
      }));

    const log: NightLog = {
      id: nightLogId(night.from),
      nightFrom: night.from.toISOString(),
      siteId: config.sites.find((s) => s.name === active.label)?.id ?? null,
      siteName: active.label,
      observations,
      transparency,
      seeing,
      note,
      savedAt: new Date().toISOString(),
    };

    const updated = await saveNightLog(log);
    if (updated) {
      setJournal(updated);
      setSaved(`Zapisano ${observations.length} obserwacji.`);
    } else {
      setSaved('Nie udało się zapisać — poprzednie wpisy zostały nietknięte.');
    }
  };

  const exportAll = async () => {
    const path = await exportJournalToFile();
    setSaved(path ? `Wyeksportowano do ${path}` : 'Eksport się nie powiódł.');
  };

  const nights = journal.logs.length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          accessibilityLabel="Wróć"
          hitSlop={touchSlop(34)}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Dziennik</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!readable && (
          <Card style={styles.gap}>
            <Text style={styles.warning}>
              Zapisanego dziennika nie dało się odczytać. Nic nie zostanie nadpisane, dopóki się to
              nie zmieni — zapis pozostaje na dysku nietknięty.
            </Text>
          </Card>
        )}

        <Text style={styles.nightLabel}>
          Noc {formatShortDate(night.from)} · {formatTime(night.from)}–{formatTime(night.to)}
        </Text>
        <Text style={styles.nightSub}>
          {active.label} · Bortle {active.bortle} · Księżyc {moonIllumination}%
        </Text>

        <SectionLabel style={styles.sectionLabel}>Cele tej nocy</SectionLabel>
        {ordered.length === 0 ? (
          <Card style={styles.gap}>
            <Text style={styles.empty}>
              Aplikacja nie wskazała tej nocy żadnego celu w zasięgu sprzętu.
            </Text>
          </Card>
        ) : (
          <Card style={styles.gap}>
            {ordered.map(({ target, rank, history }, i) => (
              <View
                key={`${target.profileId}-${target.id}`}
                style={[styles.targetRow, i > 0 && styles.targetRowGap]}
              >
                <View style={styles.targetText}>
                  <Text style={styles.targetName} numberOfLines={1}>
                    {target.name}
                  </Text>
                  <Text style={styles.targetDetail}>
                    {rank === 'retry' ? 'lepsze warunki niż wtedy · ' : ''}
                    {describeHistory(history) ?? target.detail}
                  </Text>
                </View>
                <View style={styles.outcomes}>
                  <OutcomeButton
                    icon="eye-outline"
                    label="widziałem"
                    active={outcomes[target.id] === 'seen'}
                    tone={colors.teal}
                    onPress={() => toggle(target.id, 'seen')}
                  />
                  <OutcomeButton
                    icon="close-outline"
                    label="nie wyszło"
                    active={outcomes[target.id] === 'failed'}
                    tone={colors.amber}
                    onPress={() => toggle(target.id, 'failed')}
                  />
                </View>
              </View>
            ))}
          </Card>
        )}

        <SectionLabel style={styles.sectionLabel}>Jak było</SectionLabel>
        <Card style={styles.gap}>
          <Scale label="Przejrzystość" value={transparency} onChange={setTransparency} />
          <Scale label="Spokój obrazu" value={seeing} onChange={setSeeing} />
          <TextInput
            style={styles.note}
            value={note}
            onChangeText={setNote}
            placeholder="Notatka — jedno zdanie wystarczy"
            placeholderTextColor={colors.textMuted}
            multiline
          />
        </Card>

        <Pressable accessibilityRole="button" onPress={save} style={[styles.action, styles.gap]}>
          <Ionicons name="save-outline" size={17} color={colors.bg} />
          <Text style={styles.actionText}>Zapisz noc</Text>
        </Pressable>

        {saved && <Text style={styles.saved}>{saved}</Text>}

        <SectionLabel style={styles.sectionLabel}>Ten miesiąc</SectionLabel>
        <MonthSummary report={month} />

        <SectionLabel style={styles.sectionLabel}>Cały dziennik</SectionLabel>
        <Card style={styles.gap}>
          <Text style={styles.summary}>
            {nights === 0
              ? 'Jeszcze żadnej zapisanej nocy.'
              : `${nights} ${nights === 1 ? 'zapisana noc' : 'zapisanych nocy'}.`}
          </Text>
          <Pressable accessibilityRole="button" onPress={exportAll} style={styles.exportRow}>
            <Ionicons name="download-outline" size={16} color={colors.purple} />
            <Text style={styles.exportText}>Eksportuj do pliku</Text>
          </Pressable>
          {/* Pełny raport — z notatkami i listą obiektów — renderuje CLI
              z wyeksportowanego pliku, nie z pamięci telefonu. Dzięki temu da
              się go zrobić z kopii sprzed pół roku i wyjdzie identyczny. */}
          <Text style={styles.exportHint}>
            Pełny raport miesięczny: npm run report -- --journal &lt;plik&gt;
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Podgląd bieżącego miesiąca.
 *
 * Świadomie **skrót, nie raport**: liczby, które mówią, czy miesiąc idzie dobrze,
 * bez notatek i bez list obiektów. Pełny render robi CLI z wyeksportowanego
 * pliku — telefon w rękawicach nie jest miejscem na czytanie trzech ekranów
 * tekstu, a plik da się otworzyć rano przy kawie.
 */
function MonthSummary({ report }: { report: MonthlyReport }) {
  const { nightsOut, observations, firstTimes, bestNight } = report;

  if (nightsOut === 0) {
    return (
      <Card style={styles.gap}>
        <Text style={styles.summary}>{monthLabel(report.month)} — ani jednej zapisanej nocy.</Text>
      </Card>
    );
  }

  return (
    <Card style={styles.gap}>
      <View style={styles.monthRow}>
        <MonthStat value={String(nightsOut)} label={nightsOut === 1 ? 'noc' : 'nocy'} />
        <MonthStat value={String(observations.seen)} label="trafionych" />
        {/* Pierwsze razy to jedyna miara postępu, jaką te dane niosą: liczba
            podejść rośnie od samego wyjeżdżania. */}
        <MonthStat value={String(firstTimes.length)} label="pierwszy raz" />
      </View>

      {bestNight && (
        <Text style={styles.monthBest}>
          Najlepsza noc: {formatShortDate(new Date(`${bestNight.id}T12:00:00`))},{' '}
          {bestNight.siteName}
          {' — '}
          {bestNight.seen} {bestNight.seen === 1 ? 'obiekt' : 'obiektów'}.
        </Text>
      )}
    </Card>
  );
}

function MonthStat({ value, label }: { value: string; label: string }) {
  return (
    <View accessible accessibilityLabel={`${value} ${label}`} style={styles.monthStat}>
      <Text style={styles.monthValue}>{value}</Text>
      <Text style={styles.monthLabel}>{label}</Text>
    </View>
  );
}

function OutcomeButton({
  icon,
  label,
  active,
  tone,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  tone: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      hitSlop={touchSlop(36)}
      style={[styles.outcome, active && { borderColor: tone, backgroundColor: `${tone}22` }]}
    >
      <Ionicons name={icon} size={16} color={active ? tone : colors.textMuted} />
    </Pressable>
  );
}

/** Skala 1–5 — krótka, bo w rękawicach o trzeciej w nocy dłuższej nikt nie użyje. */
function Scale({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <View style={styles.scaleRow}>
      <Text style={styles.scaleLabel}>{label}</Text>
      <View style={styles.scaleDots}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            accessibilityRole="button"
            key={n}
            onPress={() => onChange(value === n ? null : n)}
            accessibilityLabel={`${label} ${n}`}
            accessibilityState={{ selected: n === value }}
            // Zapas w poziomie tylko do połowy odstępu (6 pt), bo kropki stoją
            // w rzędzie — szerszy nachodziłby na sąsiednią i tapnięcie w szew
            // przestawałoby być jednoznaczne.
            hitSlop={{ top: 7, bottom: 7, left: 3, right: 3 }}
            style={[styles.scaleDot, value !== null && n <= value && styles.scaleDotOn]}
          >
            <Text
              style={[styles.scaleNumber, value !== null && n <= value && styles.scaleNumberOn]}
            >
              {n}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.sansMedium, fontSize: 17, color: colors.textPrimary },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  gap: { marginBottom: 16 },
  nightLabel: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.textPrimary },
  nightSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, marginTop: 3 },
  sectionLabel: { marginTop: 18, marginBottom: 8 },
  empty: { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted },
  warning: { fontFamily: fonts.sans, fontSize: 13, color: colors.amber, lineHeight: 18 },
  targetRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  targetRowGap: { marginTop: 12 },
  targetText: { flex: 1 },
  targetName: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.textPrimary },
  targetDetail: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  outcomes: { flexDirection: 'row', gap: 6 },
  outcome: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: HAIRLINE,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthRow: {
    flexDirection: 'row',
    // Zawijanie, a nie trzy sztywne kolumny: przy podkręconej czcionce
    // systemowej liczby schodzą do drugiego rzędu zamiast się przycinać.
    flexWrap: 'wrap',
    rowGap: 12,
  },
  monthStat: {
    flexGrow: 1,
    flexBasis: '33%',
  },
  monthValue: {
    fontFamily: fonts.monoMedium,
    fontSize: 22,
    color: colors.teal,
  },
  monthLabel: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  monthBest: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
    marginTop: 14,
  },
  exportHint: {
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
    marginTop: 10,
  },
  scaleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  scaleLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.textSecondary },
  scaleDots: { flexDirection: 'row', gap: 6 },
  scaleDot: {
    // Minimum, a nie sztywny rozmiar: w środku stoi cyfra, więc przy podkręconej
    // czcionce systemowej kwadrat ma urosnąć razem z nią, a nie ją przyciąć.
    minWidth: 30,
    minHeight: 30,
    paddingHorizontal: 6,
    borderRadius: radius.md,
    borderWidth: HAIRLINE,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleDotOn: { backgroundColor: colors.purple, borderColor: colors.purple },
  scaleNumber: { fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted },
  scaleNumberOn: { color: colors.bg },
  note: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textPrimary,
    borderWidth: HAIRLINE,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 10,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: radius.md,
    backgroundColor: colors.purple,
  },
  actionText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.bg },
  saved: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, marginBottom: 8 },
  summary: { fontFamily: fonts.sans, fontSize: 13, color: colors.textSecondary },
  exportRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  exportText: { fontFamily: fonts.sans, fontSize: 13, color: colors.purple },
});
