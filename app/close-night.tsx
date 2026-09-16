import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { saveLog, useJournal } from '@/hooks/use-journal';
import { MAX_DAYS_BACK, useNightLog } from '@/hooks/use-night-log';
import { CONFIG_LIMITS } from '@/lib/config';
import { formatNightSpan, formatTime } from '@/lib/date';
import {
  FAILURE_REASONS,
  OTHER_REASON,
  customReasons,
  dewThresholdSuggestion,
  nightLogId,
  type NightLog,
  type Outcome,
  type TargetObservation,
} from '@/lib/journal';
import { describeDewSuggestion } from '@/lib/journal-text';
import { targetLabel } from '@/lib/sky-targets';
import { useSettings } from '@/store/settings';
import { colors, fonts, hexA } from '@/theme';
import {
  Button,
  CheckBox,
  Chip,
  ChipRow,
  Field,
  Label,
  MenuRow,
  Note,
  Notice,
  Panel,
  Sheet,
} from '@/ui/kit';
import { themedStyles } from '@/ui/theme';

type Draft = {
  outcomes: Record<string, Outcome>;
  reasons: Record<string, string>;
  transparency: number | null;
  seeing: number | null;
  note: string;
};

/** Ile celów z góry listy stoi od razu; resztę dopisuje się z rozwijanej listy. */
const PLAN_SIZE = 5;

function draftOf(log: NightLog | undefined): Draft {
  const observations = log?.observations ?? [];

  return {
    outcomes: Object.fromEntries(observations.map((o) => [o.targetId, o.outcome])),
    reasons: Object.fromEntries(
      observations.flatMap((o) => (o.reason ? [[o.targetId, o.reason]] : [])),
    ),
    transparency: log?.transparency ?? null,
    seeing: log?.seeing ?? null,
    note: log?.note ?? '',
  };
}

const isEmpty = (draft: Draft) =>
  Object.keys(draft.outcomes).length === 0 &&
  draft.transparency === null &&
  draft.seeing === null &&
  draft.note.trim() === '';

const shortName = (name: string) => name.replace(' — ', ' ');

/**
 * 4a/4b: arkusz zamknięcia nocy — ten sam z Nocy, z Dziennika i z „Edytuj"
 * we wpisie. Cele są już wpisane z tego, co aplikacja pokazała na tę noc.
 * Odhaczenie ma trzy stany: puste, widziałem, nie wyszło — w trzecim dochodzi
 * powód jednym słowem. Szkic zapisuje się od pierwszej zmiany, więc arkusz
 * zamknięty w rękawicach w pół ruchu nie gubi nocy.
 */
export default function CloseNightSheet() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { journal, readable, loaded } = useJournal();
  const { active, config, updateConfig } = useSettings();
  const [daysBack, setDaysBack] = useState(0);
  const view = useNightLog(id, daysBack, journal);

  const logId = nightLogId(view.night.from);
  const existing = journal.logs.find((log) => log.id === logId);

  const [draft, setDraft] = useState<Draft>(() => draftOf(undefined));
  const [draftFor, setDraftFor] = useState<string | null>(null);
  const [extra, setExtra] = useState<string[]>([]);
  const [showMore, setShowMore] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [otherText, setOtherText] = useState('');
  const [failedSave, setFailedSave] = useState(false);
  const [raisedTo, setRaisedTo] = useState<number | null>(null);

  // Zmiana nocy albo pierwsze wczytanie dziennika zaczyna formularz od wpisu tej
  // nocy albo od zera. Stan poprzedniej nocy przeniesiony do tej zapisałby się
  // jako obserwacja, której nie było.
  if (loaded && draftFor !== logId) {
    setDraftFor(logId);
    setDraft(draftOf(existing));
    setExtra([]);
    setShowMore(false);
    setEditing(null);
  }

  const known = new Set(view.targets.map((item) => item.target.id));
  const listed = view.targets.filter(
    (item, i) =>
      i < PLAN_SIZE ||
      draft.outcomes[item.target.id] !== undefined ||
      extra.includes(item.target.id),
  );
  const more = view.targets.filter((item) => !listed.includes(item));
  // Cele z wpisu, których dziś nie ma w zasięgu — inne miejsce albo inny sprzęt.
  // Zostają na liście i w zapisie, zamiast cicho znikać przy edycji.
  const orphans = Object.keys(draft.outcomes).filter((targetId) => !known.has(targetId));
  const seenCount = Object.values(draft.outcomes).filter((o) => o === 'seen').length;
  const rows = listed.length + orphans.length;

  const reasonChoices: string[] = [
    ...FAILURE_REASONS.filter((reason) => reason !== OTHER_REASON),
    ...customReasons(journal),
    OTHER_REASON,
  ];

  const failedReasons = Object.entries(draft.outcomes).flatMap(([targetId, outcome]) =>
    outcome === 'failed' && draft.reasons[targetId] ? [draft.reasons[targetId]] : [],
  );
  const proposed = dewThresholdSuggestion({
    reasons: failedReasons,
    forecastMinSpread: view.forecastMinSpread,
    threshold: config.conditions.dewWarningSpreadC,
    max: CONFIG_LIMITS.conditions.dewWarningSpreadC.max,
  });

  function buildLog(next: Draft): NightLog {
    const observations = Object.entries(next.outcomes).flatMap(
      ([targetId, outcome]): TargetObservation[] => {
        const previous = existing?.observations.find((o) => o.targetId === targetId);
        const item = view.targets.find((t) => t.target.id === targetId);
        // Warunki podejścia zostają z pierwszego zapisu: edycja po tygodniu nie
        // może podmienić Bortle tamtego miejsca na dzisiejsze.
        const conditions =
          previous?.conditions ??
          (item
            ? {
                bortle: active.bortle,
                altitude: item.target.maxAltitude,
                moonIllumination: view.moonIllumination,
              }
            : null);
        if (!conditions) return [];

        const reason = outcome === 'failed' ? next.reasons[targetId] : undefined;
        // Godzina z panelu celu zostaje, dopóki cel jest widziany.
        const seenAt = outcome === 'seen' ? previous?.seenAt : undefined;
        return [
          {
            targetId,
            outcome,
            conditions,
            profileId: previous?.profileId ?? item?.target.profileId ?? 'default',
            ...(reason ? { reason } : {}),
            ...(seenAt ? { seenAt } : {}),
          },
        ];
      },
    );

    return {
      id: logId,
      nightFrom: view.night.from.toISOString(),
      siteId: existing
        ? existing.siteId
        : (config.sites.find((s) => s.name === active.label)?.id ?? null),
      siteName: existing?.siteName ?? active.label,
      observations,
      transparency: next.transparency,
      seeing: next.seeing,
      note: next.note.trim(),
      savedAt: new Date().toISOString(),
    };
  }

  /** Każda zmiana od razu na dysk — pusty szkic nocy, której nie było w dzienniku, nie powstaje. */
  async function commit(next: Draft) {
    setDraft(next);
    if (!existing && isEmpty(next)) return;
    setFailedSave((await saveLog(buildLog(next))) === null);
  }

  function cycle(targetId: string) {
    const current = draft.outcomes[targetId];
    const nextOutcome: Outcome | undefined =
      current === undefined ? 'seen' : current === 'seen' ? 'failed' : undefined;

    const outcomes = { ...draft.outcomes };
    const reasons = { ...draft.reasons };
    if (nextOutcome) outcomes[targetId] = nextOutcome;
    else delete outcomes[targetId];
    if (nextOutcome !== 'failed') delete reasons[targetId];

    setEditing(nextOutcome === 'failed' ? targetId : null);
    setOtherText('');
    void commit({ ...draft, outcomes, reasons });
  }

  function chooseReason(targetId: string, reason: string) {
    if (reason !== OTHER_REASON) setEditing(null);
    setOtherText('');
    void commit({ ...draft, reasons: { ...draft.reasons, [targetId]: reason } });
  }

  function saveOtherReason(targetId: string) {
    const text = otherText.trim();
    if (!text) return;
    setEditing(null);
    void commit({ ...draft, reasons: { ...draft.reasons, [targetId]: text } });
  }

  function addTarget(targetId: string) {
    setExtra((ids) => [...ids, targetId]);
    setShowMore(false);
    void commit({ ...draft, outcomes: { ...draft.outcomes, [targetId]: 'seen' } });
  }

  function rate(key: 'transparency' | 'seeing', value: number) {
    void commit({ ...draft, [key]: draft[key] === value ? null : value });
  }

  async function finish() {
    if (!existing && isEmpty(draft)) {
      router.back();
      return;
    }
    const saved = await saveLog(buildLog(draft));
    if (saved) router.back();
    else setFailedSave(true);
  }

  /** Godzina przy celu: odhaczenie z panelu, a bez niego najlepszy moment nocy. */
  function timeOf(targetId: string, best: Date | null): string {
    const seenAt = existing?.observations.find((o) => o.targetId === targetId)?.seenAt;
    return seenAt ? formatTime(new Date(seenAt)) : best ? formatTime(best) : '—';
  }

  function renderTarget(targetId: string, name: string, time: string, firstTime: boolean) {
    const outcome = draft.outcomes[targetId];
    const reason = draft.reasons[targetId];
    const otherChosen =
      reason !== undefined && (reason === OTHER_REASON || !reasonChoices.includes(reason));

    return (
      <View key={targetId} style={styles.group}>
        <Panel
          tone={outcome === 'seen' ? 'go' : undefined}
          onPress={() => cycle(targetId)}
          style={[styles.target, outcome === 'seen' && styles.surface]}
        >
          <CheckBox checked={outcome === 'seen'} failed={outcome === 'failed'} />
          <Text style={[styles.targetName, outcome === 'failed' && styles.dim]}>
            {name}
            {firstTime && outcome === 'seen' ? <Text style={styles.firstTime}> 1. RAZ</Text> : null}
          </Text>
          <Text style={styles.time}>{outcome === 'failed' ? (reason ?? 'powód?') : time}</Text>
        </Panel>

        {editing === targetId ? (
          <Panel tone="bad" style={styles.reasons}>
            <Label flush>{`${name} — dlaczego nie wyszło`}</Label>
            <ChipRow>
              {reasonChoices.map((choice) => (
                <Chip
                  key={choice}
                  label={choice === OTHER_REASON ? 'inne…' : choice}
                  tone={
                    (choice === OTHER_REASON ? otherChosen : reason === choice) ? 'bad' : 'neutral'
                  }
                  dashed={choice === OTHER_REASON}
                  onPress={() => chooseReason(targetId, choice)}
                />
              ))}
            </ChipRow>
            {reason === OTHER_REASON ? (
              <Field
                value={otherText}
                onChangeText={setOtherText}
                onSubmitEditing={() => saveOtherReason(targetId)}
                onEndEditing={() => saveOtherReason(targetId)}
                placeholder="Własny powód — zostanie w podpowiedziach"
                returnKeyType="done"
                autoFocus
              />
            ) : null}
          </Panel>
        ) : null}
      </View>
    );
  }

  const siteName = existing?.siteName ?? active.label;

  return (
    <Sheet title="Jak było?" subtitle={`${siteName} · ${view.equipment}`}>
      <Panel style={styles.switcher}>
        <Pressable
          onPress={() => setDaysBack((n) => Math.min(MAX_DAYS_BACK, n + 1))}
          disabled={daysBack >= MAX_DAYS_BACK}
          accessibilityRole="button"
          accessibilityLabel="Poprzednia noc"
          style={styles.arrow}
        >
          <Text style={[styles.arrowText, daysBack >= MAX_DAYS_BACK && styles.disabled]}>‹</Text>
        </Pressable>
        <View style={styles.switcherCenter}>
          <Text style={styles.switcherTitle}>
            {`noc ${formatNightSpan(view.night.from, view.night.to)}`}
          </Text>
          <Text style={styles.switcherSubtitle}>
            {existing
              ? 'wpis tej nocy — zmiany go uzupełniają'
              : `Księżyc ${view.moonIllumination}%`}
          </Text>
        </View>
        <Pressable
          onPress={() => setDaysBack((n) => Math.max(0, n - 1))}
          disabled={daysBack === 0}
          accessibilityRole="button"
          accessibilityLabel="Następna noc"
          style={styles.arrow}
        >
          <Text style={[styles.arrowText, daysBack === 0 && styles.disabled]}>›</Text>
        </Pressable>
      </Panel>

      {!readable ? (
        <Notice tone="bad">
          Zapisanego dziennika nie da się odczytać — arkusz niczego nie zapisze, żeby go nie
          nadpisać.
        </Notice>
      ) : failedSave ? (
        <Notice tone="bad">Nie udało się zapisać — poprzednie wpisy zostały nietknięte.</Notice>
      ) : null}

      <Label flush tone={seenCount ? 'go' : undefined} right={`${seenCount} z ${rows}`}>
        Cele tej nocy
      </Label>
      {rows === 0 ? <Note>Tej nocy żaden cel nie był w zasięgu sprzętu.</Note> : null}
      {listed.map((item) =>
        renderTarget(
          item.target.id,
          shortName(item.target.name),
          timeOf(item.target.id, item.target.bestAt),
          item.target.kind === 'dso' && (item.history?.seenCount ?? 0) === 0,
        ),
      )}
      {orphans.map((targetId) =>
        renderTarget(targetId, shortName(targetLabel(targetId)), timeOf(targetId, null), false),
      )}

      {more.length > 0 ? (
        <Panel dashed onPress={() => setShowMore((open) => !open)} style={styles.target}>
          <Text style={styles.plus}>{showMore ? '−' : '+'}</Text>
          <Text style={styles.more}>dopisz, co doszło</Text>
          <Text style={styles.time}>{`${more.length} w zasięgu`}</Text>
        </Panel>
      ) : null}
      {showMore
        ? more.map((item) => (
            <MenuRow
              key={item.target.id}
              title={shortName(item.target.name)}
              subtitle={item.target.detail}
              value={formatTime(item.target.bestAt)}
              chevron="+"
              onPress={() => addTarget(item.target.id)}
            />
          ))
        : null}

      <Label>Jak było</Label>
      <Scale
        label="przejrzystość"
        value={draft.transparency}
        onChange={(n) => rate('transparency', n)}
      />
      <Scale label="spokój" value={draft.seeing} onChange={(n) => rate('seeing', n)} />
      <Field
        value={draft.note}
        onChangeText={(note) => setDraft((current) => ({ ...current, note }))}
        onEndEditing={() => void commit(draft)}
        placeholder="Notatka — co zapamiętać na następny raz"
        multiline
      />

      {proposed !== null && view.forecastMinSpread !== null ? (
        <MenuRow
          tone="accent"
          title={describeDewSuggestion(view.forecastMinSpread, proposed)}
          value={`${proposed} K`}
          chevron="↑"
          onPress={() => {
            updateConfig('conditions', { dewWarningSpreadC: proposed });
            setRaisedTo(proposed);
          }}
        />
      ) : null}
      {raisedTo !== null ? (
        <Note>{`Próg zapasu nad punktem rosy to teraz ${raisedTo} K — zmienisz go w Progach warunków.`}</Note>
      ) : null}

      <Button label="zapisz noc" tone="accent" onPress={() => void finish()} />
    </Sheet>
  );
}

/** Skala 1–5 wypełniana do wybranej wartości; ponowne dotknięcie tej samej ją czyści. */
function Scale({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.scale}>
      <View style={styles.between}>
        <Text style={styles.scaleLabel}>{label}</Text>
        <Text style={value ? styles.scaleValue : styles.scaleLabel}>
          {value ? `${value}/5` : '1–5'}
        </Text>
      </View>
      <View style={styles.boxes}>
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = value !== null && n <= value;

          return (
            <Pressable
              key={n}
              onPress={() => onChange(n)}
              accessibilityRole="radio"
              accessibilityState={{ selected: value === n }}
              accessibilityLabel={`${label} ${n} z 5`}
              style={[styles.box, filled && styles.boxFilled]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  group: { gap: 8 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  switcher: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  arrowText: { fontFamily: fonts.mono, fontSize: 20, color: colors.purple },
  disabled: { opacity: 0.3 },
  switcherCenter: { flex: 1, alignItems: 'center', gap: 2 },
  switcherTitle: { fontFamily: fonts.monoMedium, fontSize: 14, color: colors.textPrimary },
  switcherSubtitle: { fontFamily: fonts.mono, fontSize: 11, color: colors.textMuted },
  target: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  surface: { backgroundColor: colors.surface },
  targetName: { flex: 1, fontFamily: fonts.sans, fontSize: 14.5, color: colors.textPrimary },
  dim: { color: colors.textSecondary },
  firstTime: { fontFamily: fonts.monoSemiBold, fontSize: 10, color: colors.amber },
  time: { fontFamily: fonts.mono, fontSize: 12.5, color: colors.textSecondary },
  reasons: { gap: 10 },
  plus: { fontFamily: fonts.mono, fontSize: 16, color: colors.purple },
  more: { flex: 1, fontFamily: fonts.sans, fontSize: 13.5, color: colors.textSecondary },
  scale: { gap: 8 },
  scaleLabel: { fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary },
  scaleValue: { fontFamily: fonts.monoMedium, fontSize: 13, color: colors.textPrimary },
  boxes: { flexDirection: 'row', gap: 6 },
  box: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  boxFilled: { backgroundColor: hexA(colors.purple, 0.22), borderColor: colors.purple },
}));
