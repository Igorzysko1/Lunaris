import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useKnownTonight } from '@/hooks/use-known-tonight';
import { useNightConditions } from '@/hooks/use-night-conditions';
import {
  useNightVerdicts,
  type NightCard,
  type NightMoment,
  type NightVerdicts,
} from '@/hooks/use-night-verdicts';
import type { Narration } from '@/lib/session-text';
import {
  BOOKING_WARNING,
  LIVE,
  NEXT_EVENT,
  OPTICS,
  OUT_OF_REACH,
  PLAN,
  SKY_CONSTELLATIONS,
  TARGETS,
} from '@/mock/night';
import { useMock } from '@/mock/state';
import { colors, fonts, hexA } from '@/theme';
import {
  Body,
  Button,
  CheckBox,
  Chip,
  ChipRow,
  Label,
  MenuRow,
  Note,
  Notice,
  Panel,
  Screen,
  Segments,
  Stat,
  Strong,
  todo,
  type Tone,
} from '@/ui/kit';
import { BlockedBar, HourBars, ProgressBar, WindowBar, pct } from '@/ui/night';

type Segment = 'conditions' | 'sky' | 'plan';

const SEGMENTS: readonly (readonly [Segment, string])[] = [
  ['conditions', 'Warunki'],
  ['sky', 'Niebo'],
  ['plan', 'Plan'],
];

function openTarget(id: string) {
  router.push({ pathname: '/target/[id]', params: { id } });
}

type Live = NonNullable<NightMoment['live']>;

/**
 * Noc — „czy jechać?". Werdykt stoi nad segmentami i jest zawsze widoczny,
 * selektor nocy zmienia cały widok zakładki. Warunki mówią, jaka będzie noc,
 * Niebo — co w niej widać, Plan — co to znaczy dla mnie.
 *
 * Etap 1: werdykt, selektor nocy, pasek danych z zapisu i brak prognozy
 * pochodzą z `useNightVerdicts`. Segmenty pod werdyktem są jeszcze makietą.
 */
export default function NightScreen() {
  const params = useLocalSearchParams<{ segment?: string }>();
  const [segment, setSegment] = useState<Segment>(params.segment === 'sky' ? 'sky' : 'conditions');
  const [requested, setRequested] = useState(params.segment);
  const [night, setNight] = useState(0);
  const { session } = useMock();
  const verdicts = useNightVerdicts();

  // Wejście z Dziennika („dziś lepiej niż wtedy") i z bibliotek prowadzi do Nieba —
  // także wtedy, gdy zakładka jest już zamontowana i dostaje tylko nowy parametr.
  if (params.segment !== requested) {
    setRequested(params.segment);
    if (params.segment === 'sky') setSegment('sky');
  }

  if (verdicts.nights.length === 0) return <NoForecast verdicts={verdicts} />;

  // Nowa prognoza może przynieść mniej nocy — wybór nie może wskazywać w próżnię.
  const index = Math.min(night, verdicts.nights.length - 1);
  const card = verdicts.nights[index];
  const moment = verdicts.moments[index];
  const live = liveOf(card, moment, session === 'live' && index === 0);
  const best = verdicts.bestNight(index);

  const variant: VerdictVariant = live
    ? 'live'
    : segment === 'conditions'
      ? 'full'
      : segment === 'sky'
        ? 'bar'
        : 'compact';

  return (
    <Screen>
      <NightSwitcher
        nights={verdicts.nights}
        index={index}
        onChange={setNight}
        plan={segment === 'plan'}
        live={live !== null}
        place={verdicts.place}
      />
      {verdicts.stale ? <StaleBar verdicts={verdicts} /> : null}
      {card.go ? (
        <VerdictCard card={card} moment={moment} live={live} variant={variant} />
      ) : (
        <RejectCard
          card={card}
          best={best === null ? null : verdicts.nights[best]}
          onBest={() => {
            if (best !== null) setNight(best);
          }}
        />
      )}
      <Segments items={SEGMENTS} value={segment} onChange={setSegment} />
      {segment === 'conditions' ? <Conditions card={card} /> : null}
      {segment === 'sky' ? <Sky /> : null}
      {segment === 'plan' ? live ? <LivePlan /> : <Plan go={card.go} /> : null}
    </Screen>
  );
}

/**
 * Noc w trakcie. Przełącznik makiety „noc w trakcie" zostaje dla Planu
 * (etap 5) — gdy sesja nie trwa naprawdę, licznik stoi na starcie okna.
 */
function liveOf(card: NightCard, moment: NightMoment, forced: boolean): Live | null {
  if (moment.live) return moment.live;
  if (!forced || !card.go || !card.window) return null;
  return { now: card.window.from, remaining: `zostało ${card.window.duration}`, progress: 0 };
}

function NightSwitcher({
  nights,
  index,
  onChange,
  plan,
  live,
  place,
}: {
  nights: NightCard[];
  index: number;
  onChange: (index: number) => void;
  plan: boolean;
  live: boolean;
  place: string;
}) {
  const current = nights[index];
  const first = index === 0;
  const last = index === nights.length - 1;

  return (
    <Panel style={styles.switcher}>
      <Pressable
        onPress={() => onChange(index - 1)}
        disabled={first}
        accessibilityRole="button"
        accessibilityLabel="Poprzednia noc"
        style={styles.arrow}
      >
        <Text style={[styles.arrowText, first && styles.disabled]}>‹</Text>
      </Pressable>
      <Pressable
        onPress={() => router.push('/location')}
        onLongPress={() => router.push('/night-mode')}
        accessibilityRole="button"
        accessibilityHint="Zmienia miejsce. Przytrzymaj, żeby otworzyć tryb nocny."
        style={styles.switcherCenter}
      >
        <Text style={styles.switcherTitle}>{plan ? current.planTitle : current.title}</Text>
        <Text style={styles.switcherSubtitle}>
          {live ? `sesja trwa · ${place}` : plan ? current.planSubtitle : current.subtitle}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => onChange(index + 1)}
        disabled={last}
        accessibilityRole="button"
        accessibilityLabel="Następna noc"
        style={styles.arrow}
      >
        <Text style={[styles.arrowText, last && styles.disabled]}>›</Text>
      </Pressable>
    </Panel>
  );
}

type VerdictVariant = 'full' | 'bar' | 'compact' | 'live';

function Narrative({ parts }: { parts: Narration }) {
  return (
    <Text style={styles.narrative}>
      {parts.map(([text, strong], i) => (
        <Text key={i} style={strong ? styles.narrativeStrong : undefined}>
          {text}
        </Text>
      ))}
    </Text>
  );
}

/** 2b, stan „odpuść": ten sam układ karty, powód zamiast okna. */
function RejectCard({
  card,
  best,
  onBest,
}: {
  card: NightCard;
  best: NightCard | null;
  onBest: () => void;
}) {
  return (
    <Panel tone="bad">
      <View style={styles.between}>
        <Text style={[styles.verdictWord, styles.bad]}>ODPUŚĆ · {card.score}/5</Text>
        <Text style={styles.verdictMeta}>{card.rejection?.meta ?? 'brak okna'}</Text>
      </View>
      <BlockedBar label={card.rejection?.bar ?? 'BEZ OKNA'} />
      <Narrative parts={card.narrative} />
      <ChipRow>
        {card.chips.map((chip) => (
          <Chip key={chip.label} label={chip.label} />
        ))}
        {best ? (
          <Chip label={`${best.relative} ${best.score}/5 ›`} tone="accent" onPress={onBest} />
        ) : (
          <Chip label="brak dobrej nocy w prognozie" dashed />
        )}
      </ChipRow>
    </Panel>
  );
}

function VerdictCard({
  card,
  moment,
  live,
  variant,
}: {
  card: NightCard;
  moment: NightMoment;
  live: Live | null;
  variant: VerdictVariant;
}) {
  const { window } = card;
  if (!window) return null;

  const meta = live
    ? live.remaining
    : variant === 'bar'
      ? (moment.remaining ?? window.duration)
      : window.duration;

  return (
    <Panel tone="go">
      <View style={styles.between}>
        <Text style={styles.verdictWord}>{live ? 'W TRAKCIE' : `JEDŹ · ${card.score}/5`}</Text>
        <Text style={styles.verdictMeta}>{meta}</Text>
      </View>
      <View style={styles.times}>
        <Text style={styles.time}>{live ? live.now : window.from}</Text>
        <Text style={styles.timeArrow}>→</Text>
        <Text style={styles.time}>{window.to}</Text>
      </View>

      {live ? <ProgressBar progress={live.progress} start={window.from} end={window.to} /> : null}
      {variant === 'full' ? <WindowBar {...window.bar} /> : null}
      {variant === 'bar' ? (
        <WindowBar
          {...window.bar}
          // „teraz" przy lewej krawędzi nachodzi na podpis zachodu — zostaje sama godzina.
          labels={{
            ...window.bar.labels,
            start: moment.nowOnBar === null ? window.bar.labels.start : window.bar.sunset,
          }}
          now={moment.nowOnBar}
        />
      ) : null}

      {variant === 'full' ? (
        <>
          <View style={styles.hairline} />
          <Narrative parts={card.narrative} />
          <ChipRow>
            {card.chips.map((chip) => (
              <Chip
                key={chip.label}
                label={chip.label}
                tone={chip.warn ? 'warn' : 'neutral'}
                dashed={chip.warn}
              />
            ))}
          </ChipRow>
        </>
      ) : null}
    </Panel>
  );
}

/** 13b: zapis to normalne źródło odczytu — pasek pojawia się, gdy odświeżenie zawiodło. */
function StaleBar({ verdicts }: { verdicts: NightVerdicts }) {
  const blocked = verdicts.refreshing || verdicts.refreshAfter !== null;

  return (
    <Panel tone="warn" style={styles.rowPanel}>
      <Text style={[styles.rowTitle, styles.flex]}>
        {verdicts.failure === 'offline' ? '⌁ ' : '! '}
        {verdicts.stale}
      </Text>
      <Pressable
        onPress={verdicts.refresh}
        disabled={blocked}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityState={{ disabled: blocked }}
      >
        <Text style={[styles.link, blocked && styles.disabled]}>
          {verdicts.refreshing
            ? 'Pobieram…'
            : verdicts.refreshAfter
              ? `po ${verdicts.refreshAfter}`
              : 'Odśwież'}
        </Text>
      </Pressable>
    </Panel>
  );
}

/** Warunki mówią, jaka będzie noc — z tych godzin wynika werdykt nad segmentami. */
function Conditions({ card }: { card: NightCard }) {
  const view = useNightConditions(card);

  return (
    <>
      {view.clouds ? (
        <Panel>
          <Label flush right={view.clouds.lowest}>
            Zachmurzenie
          </Label>
          <HourBars
            values={view.clouds.values}
            highlight={view.clouds.highlight}
            axis={view.clouds.axis}
            threshold={view.clouds.threshold}
          />
          <View style={styles.legend}>
            {view.clouds.highlight ? (
              <Legend color={hexA(colors.green, 0.6)} label="w oknie" />
            ) : null}
            <Legend
              color="rgba(255,255,255,0.12)"
              label={view.clouds.highlight ? 'poza oknem' : 'noc bez okna'}
            />
            <Legend color={hexA(colors.coral, 0.6)} label={`próg ${view.clouds.threshold}%`} />
          </View>
        </Panel>
      ) : null}

      <Panel>
        <Label flush>Wilgotność i rosa</Label>
        <View style={styles.stats}>
          {view.humidity.map(([label, value]) => (
            <Stat key={label} label={label} value={value} style={styles.flex} />
          ))}
        </View>
        {view.dew ? (
          <Notice dashed mark={view.dewWarn ? '!' : '·'} tone={view.dewWarn ? 'warn' : 'neutral'}>
            {view.dew.map(([text, strong], i) => (
              <Fragment key={i}>{strong ? <Strong>{text}</Strong> : text}</Fragment>
            ))}
          </Notice>
        ) : null}
      </Panel>

      {/* Tylko przy sprzęcie, który seeing może ograniczyć — przy lornetce zostaje żeton w werdykcie. */}
      {view.seeing ? (
        <Panel>
          <Label flush right={view.seeing.score}>
            Seeing
          </Label>
          <Body>{view.seeing.detail}</Body>
          <Note>{`Dla zestawu ${view.seeing.profile}.`}</Note>
        </Panel>
      ) : null}

      <Panel>
        <Label flush>Czasy astronomiczne</Label>
        <View style={styles.stats}>
          {view.astro.map(([label, value]) => (
            <Stat key={label} label={label} value={value} style={styles.flex} />
          ))}
        </View>
      </Panel>

      <Panel
        onPress={() => router.push({ pathname: '/moon', params: { date: view.moon.date } })}
        style={styles.rowPanel}
      >
        <Ionicons name="moon" size={26} color={colors.amber} />
        <View style={styles.flex}>
          <Text style={styles.rowTitle}>{view.moon.title}</Text>
          <Text style={styles.rowSubtitle}>{view.moon.subtitle}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Panel>

      <MenuRow
        dashed
        title="Progi warunków"
        value={view.thresholds}
        onPress={() => router.push('/thresholds')}
      />
    </>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={styles.rowSubtitle}>{label}</Text>
    </View>
  );
}

function Sky() {
  const [optics, setOptics] = useState(0);
  const set = OPTICS[optics];

  return (
    <>
      <Panel onPress={() => setOptics((i) => (i + 1) % OPTICS.length)} style={styles.rowPanel}>
        <Text style={styles.inlineLabel}>ZESTAW</Text>
        <Text style={[styles.rowTitleMono, styles.flex]}>{set.label}</Text>
        <Text style={styles.rowSubtitle}>zmień</Text>
        <Text style={styles.chevron}>›</Text>
      </Panel>

      <Panel
        tone="teal"
        onPress={() => router.navigate({ pathname: '/calendar', params: { segment: 'events' } })}
        style={styles.rowPanel}
      >
        <View style={styles.flex}>
          <Text style={[styles.inlineLabel, styles.teal]}>NASTĘPNY EVENT</Text>
          <Text style={styles.rowTitle}>{NEXT_EVENT}</Text>
        </View>
        <Text style={[styles.chevron, styles.teal]}>›</Text>
      </Panel>

      <Label right={`${TARGETS.length} · okno i wys. maks.`}>Cele w zasięgu</Label>
      {TARGETS.map((target) => (
        <Panel
          key={target.id}
          tone={target.urgent ? 'warn' : undefined}
          onPress={() => openTarget(target.id)}
          style={[styles.rowPanel, target.urgent && styles.urgent]}
        >
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>
              {target.name}
              {target.firstTime ? <Text style={styles.firstTime}> 1. RAZ</Text> : null}
            </Text>
            <Text style={styles.rowSubtitle}>{target.meta}</Text>
          </View>
          <View style={styles.targetRight}>
            <Text style={[styles.targetWindow, target.urgent && styles.warn]}>{target.window}</Text>
            <View style={styles.altitude}>
              <View style={styles.altitudeTrack}>
                <View
                  style={[
                    styles.altitudeFill,
                    target.urgent && styles.urgentFill,
                    { width: pct(target.altitude / 90) },
                  ]}
                />
              </View>
              <Text style={styles.rowSubtitle}>{target.altitude}°</Text>
            </View>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Panel>
      ))}
      <MenuRow
        dashed
        title={`${OUT_OF_REACH} cele poza zasięgiem ${set.reach}`}
        value="pokaż"
        chevron="⌄"
        onPress={() => todo('Lista celów poza zasięgiem zestawu')}
      />
      <MenuRow
        title="Biblioteka celów"
        value="108"
        onPress={() => router.push('/library/targets')}
      />

      <Panel>
        <Label flush right="teraz nad horyzontem">
          Gwiazdozbiory
        </Label>
        <ChipRow>
          {SKY_CONSTELLATIONS.map((c) => (
            <Chip
              key={c.id}
              label={`${c.label} ${c.altitude}°`}
              onPress={() => router.push({ pathname: '/constellation/[id]', params: { id: c.id } })}
            />
          ))}
        </ChipRow>
        <Note>
          Wysokość nad horyzontem teraz; poniżej 20° pominięte, bo kształtu nie da się wtedy
          rozpoznać.
        </Note>
        <Pressable
          onPress={() => router.push('/library/constellations')}
          accessibilityRole="button"
          style={styles.listRow}
        >
          <Text style={[styles.rowTitle, styles.flex]}>Biblioteka gwiazdozbiorów</Text>
          <Text style={styles.rowSubtitle}>48</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </Panel>
    </>
  );
}

function blockColor(tone: Tone) {
  if (tone === 'go') return hexA(colors.green, 0.4);
  if (tone === 'accent') return hexA(colors.purple, 0.22);
  return 'rgba(255,255,255,0.08)';
}

function Plan({ go }: { go: boolean }) {
  const { googleConnected } = useMock();
  const [expanded, setExpanded] = useState(false);
  const [booked, setBooked] = useState(false);
  const shown = expanded ? TARGETS : TARGETS.slice(0, 2);

  return (
    <>
      <Panel>
        <Label flush>Przebieg nocy</Label>
        <Text style={styles.rowSubtitle}>{PLAN.summary}</Text>
        <View style={styles.blocks}>
          {PLAN.blocks.map((block) => (
            <View
              key={block.label}
              style={[
                styles.block,
                { flex: block.minutes, backgroundColor: blockColor(block.tone) },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[styles.blockLabel, block.tone === 'go' && styles.bold]}
              >
                {block.label}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.axis}>
          {PLAN.axis.map((tick) => (
            <Text
              key={tick.label}
              style={[
                styles.axisLabel,
                tick.at === 1 ? styles.axisEnd : { left: pct(tick.at) },
                tick.at > 0 && tick.at < 1 && styles.axisMiddle,
              ]}
            >
              {tick.label}
            </Text>
          ))}
        </View>
        <View style={styles.hairline} />
        {PLAN.steps.map((step) => (
          <View key={step.time + step.text} style={styles.step}>
            <Text style={[styles.stepTime, step.session && styles.go]}>{step.time}</Text>
            <Text style={[styles.stepText, step.session && styles.go]}>{step.text}</Text>
          </View>
        ))}
      </Panel>

      <Panel>
        <Label flush>Co z tego wychodzi</Label>
        <View style={styles.stats}>
          {PLAN.outcomes.map((outcome) => (
            <Stat
              key={outcome.label}
              label={outcome.label}
              value={outcome.value}
              tone={outcome.tone}
              style={styles.flex}
            />
          ))}
        </View>
      </Panel>

      <Label>Ostrzeżenia</Label>
      {PLAN.warnings.map((warning) => (
        <Notice key={warning.text} mark={warning.mark} tone={warning.tone}>
          {warning.text}
        </Notice>
      ))}

      <Label right="5 · kolejność z segmentu Niebo">Cele na tę noc</Label>
      {shown.map((target) => (
        <Panel key={target.id} onPress={() => openTarget(target.id)} style={styles.rowPanel}>
          <Text style={[styles.rowTitle, styles.flex]}>{target.name}</Text>
          <Text style={[styles.targetWindow, target.urgent && styles.warn]}>{target.window}</Text>
        </Panel>
      ))}
      {expanded ? null : (
        <MenuRow
          dashed
          title="jeszcze trzy cele"
          value="rozwiń"
          chevron="⌄"
          onPress={() => setExpanded(true)}
        />
      )}

      {!googleConnected ? (
        <MenuRow
          title="Połącz Kalendarz Google, żeby zarezerwować"
          onPress={() => router.push('/legacy/settings')}
        />
      ) : booked ? (
        <>
          {go ? null : <Notice>{BOOKING_WARNING}</Notice>}
          <View style={styles.row}>
            <Button
              label="Zaktualizuj wpis"
              icon="refresh"
              tone="teal"
              onPress={() => todo('Aktualizacja rezerwacji w Kalendarzu Google')}
              style={styles.flex}
            />
            <Button
              label="Odwołaj sesję"
              icon="close"
              tone="bad"
              onPress={() => setBooked(false)}
              style={styles.flex}
            />
          </View>
        </>
      ) : (
        <Button
          label="Zarezerwuj w kalendarzu"
          icon="square-outline"
          tone="teal"
          onPress={() => setBooked(true)}
        />
      )}
      <Note>{PLAN.bookingNote}</Note>
    </>
  );
}

/** 9b: noc w trakcie — lista odhaczeń z paneli celów i to, co jeszcze dziś czeka. */
function LivePlan() {
  return (
    <>
      <Label tone="go" right={LIVE.checked}>
        Cele
      </Label>
      {LIVE.targets.map((target) => (
        <Panel
          key={target.id}
          tone={target.seenAt ? 'go' : target.warning ? 'warn' : undefined}
          onPress={() => openTarget(target.id)}
          style={styles.rowPanel}
        >
          <CheckBox checked={Boolean(target.seenAt)} />
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>{target.name}</Text>
            {target.warning ? (
              <Text style={[styles.rowSubtitle, styles.warn]}>{target.warning}</Text>
            ) : null}
          </View>
          {target.seenAt ? (
            <Text style={styles.rowSubtitle}>{target.seenAt}</Text>
          ) : (
            <Text style={styles.chevron}>›</Text>
          )}
        </Panel>
      ))}

      <Panel>
        <Label flush>Co dalej dziś</Label>
        {LIVE.next.map(([time, text]) => (
          <View key={time} style={styles.step}>
            <Text style={styles.stepTime}>{time}</Text>
            <Text style={styles.stepText}>{text}</Text>
          </View>
        ))}
      </Panel>

      <Button label="zapisz noc ▲" tone="accent" onPress={() => router.push('/close-night')} />
    </>
  );
}

/**
 * 13a: bez prognozy znika werdykt i pogoda, nie cała noc. Zmierzch, świt,
 * Księżyc i cele liczą się lokalnie, więc zostają pod „Co i tak wiadomo".
 * Pierwsze pobranie pokazuje ten sam układ z komunikatem zamiast błędu.
 */
function NoForecast({ verdicts }: { verdicts: NightVerdicts }) {
  const known = useKnownTonight();
  const loading = verdicts.status === 'loading';
  // Po 429 przycisk czeka pół godziny — kolejne żądanie tylko przedłużyłoby blokadę.
  const blocked = verdicts.refreshing || verdicts.refreshAfter !== null;

  return (
    <Screen>
      <View style={styles.placeHeader}>
        <Pressable
          onPress={() => router.push('/location')}
          accessibilityRole="button"
          style={styles.flex}
        >
          <Text style={styles.rowSubtitle}>{verdicts.date}</Text>
          <Text style={styles.place}>{verdicts.place}</Text>
          <Text style={styles.rowSubtitle}>{verdicts.placeNote}</Text>
        </Pressable>
        <Pressable
          onPress={verdicts.refresh}
          onLongPress={() => router.push('/night-mode')}
          disabled={blocked}
          accessibilityRole="button"
          accessibilityLabel="Odśwież prognozę"
          accessibilityState={{ disabled: blocked }}
          style={styles.iconButton}
        >
          <Ionicons name="refresh" size={18} color={blocked ? colors.textMuted : colors.purple} />
        </Pressable>
      </View>

      {loading ? (
        <Panel>
          <Body>Pobieram prognozę dla tego miejsca…</Body>
          <Note>To, co poniżej, liczy się bez sieci.</Note>
        </Panel>
      ) : (
        <Panel tone="bad">
          <View style={styles.row}>
            <Text style={styles.errorMark}>{verdicts.failure === 'offline' ? '⌁' : '!'}</Text>
            <View style={styles.flex}>
              <Body>{verdicts.failureMessage}</Body>
            </View>
          </View>
          {verdicts.lastError ? <Text style={styles.rowSubtitle}>{verdicts.lastError}</Text> : null}
          <Button
            label={
              verdicts.refreshing
                ? 'pobieram…'
                : verdicts.refreshAfter
                  ? `spróbuję po ${verdicts.refreshAfter}`
                  : 'Spróbuj ponownie'
            }
            tone="accent"
            disabled={blocked}
            onPress={verdicts.refresh}
          />
        </Panel>
      )}

      <Label>Co i tak wiadomo</Label>
      <View style={styles.row}>
        <Panel style={styles.flex}>
          <Stat label="zmierzch" value={known.dusk} />
        </Panel>
        <Panel style={styles.flex}>
          <Stat label="świt" value={known.dawn} />
        </Panel>
      </View>
      <Panel onPress={() => router.push('/moon')} style={styles.rowPanel}>
        <Ionicons name="moon" size={24} color={colors.textSecondary} />
        <View style={styles.flex}>
          <Text style={styles.rowTitle}>{known.moon}</Text>
          <Text style={styles.rowSubtitle}>liczone lokalnie, bez sieci</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Panel>
      <Panel>
        <Label flush right={`${known.targetsCount} w zasięgu`}>
          Cele tej nocy
        </Label>
        <Note>Zależą od miejsca, nieba i sprzętu — nie od prognozy, więc są policzone.</Note>
        {known.targets.map((target) => (
          <View key={target.id} style={styles.listRow}>
            <Text style={[styles.rowTitle, styles.flex]}>{target.name}</Text>
            <Text style={styles.rowSubtitle}>{target.altitude}</Text>
          </View>
        ))}
        <Pressable
          onPress={() => router.push('/library/constellations')}
          accessibilityRole="button"
          style={styles.listRow}
        >
          <Text style={[styles.rowTitle, styles.flex]}>Gwiazdozbiory tej nocy</Text>
          <Text style={styles.rowSubtitle}>{known.constellations}</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  between: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  hairline: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  disabled: { opacity: 0.3 },
  warn: { color: colors.amber },
  go: { color: colors.green },
  bold: { fontFamily: fonts.monoMedium, color: colors.textPrimary },
  switcher: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  arrowText: { fontFamily: fonts.mono, fontSize: 20, color: colors.purple },
  switcherCenter: { flex: 1, alignItems: 'center', gap: 2 },
  switcherTitle: { fontFamily: fonts.monoMedium, fontSize: 14, color: colors.textPrimary },
  switcherSubtitle: { fontFamily: fonts.mono, fontSize: 11, color: colors.textMuted },
  verdictWord: {
    fontFamily: fonts.monoMedium,
    fontSize: 14,
    letterSpacing: 2,
    color: colors.green,
  },
  verdictMeta: { fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary },
  times: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  time: { fontFamily: fonts.monoMedium, fontSize: 32, color: colors.textPrimary },
  timeArrow: { fontFamily: fonts.mono, fontSize: 14, color: colors.textMuted },
  narrative: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 23, color: colors.textPrimary },
  narrativeStrong: { fontFamily: fonts.monoMedium },
  rowPanel: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowTitle: { fontFamily: fonts.sans, fontSize: 14.5, lineHeight: 20, color: colors.textPrimary },
  rowTitleMono: { fontFamily: fonts.monoMedium, fontSize: 13, color: colors.textPrimary },
  rowSubtitle: { fontFamily: fonts.mono, fontSize: 11.5, lineHeight: 16, color: colors.textMuted },
  inlineLabel: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1.6,
    color: colors.textMuted,
  },
  chevron: { fontFamily: fonts.mono, fontSize: 16, color: colors.purple },
  link: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.purple },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 12, height: 6, borderRadius: 2 },
  stats: { flexDirection: 'row', gap: 10 },
  firstTime: { fontFamily: fonts.monoSemiBold, fontSize: 10, color: colors.purple },
  targetRight: { alignItems: 'flex-end', gap: 4 },
  targetWindow: { fontFamily: fonts.monoMedium, fontSize: 12.5, color: colors.textPrimary },
  altitude: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  altitudeTrack: {
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  altitudeFill: { height: 3, backgroundColor: colors.textSecondary },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  blocks: { flexDirection: 'row', gap: 2, height: 26, marginTop: 4 },
  block: { justifyContent: 'center', alignItems: 'center', borderRadius: 3, paddingHorizontal: 2 },
  blockLabel: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.textSecondary },
  axis: { height: 14 },
  axisLabel: {
    position: 'absolute',
    top: 0,
    fontFamily: fonts.mono,
    fontSize: 10.5,
    color: colors.textMuted,
  },
  axisEnd: { right: 0 },
  axisMiddle: { transform: [{ translateX: -16 }] },
  step: { flexDirection: 'row', alignItems: 'baseline', gap: 14, paddingVertical: 5 },
  stepTime: { width: 44, fontFamily: fonts.monoMedium, fontSize: 13, color: colors.textPrimary },
  stepText: { flex: 1, fontFamily: fonts.sans, fontSize: 13.5, color: colors.textSecondary },
  placeHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  place: {
    fontFamily: fonts.sansMedium,
    fontSize: 20,
    color: colors.textPrimary,
    marginVertical: 2,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorMark: { fontFamily: fonts.monoSemiBold, fontSize: 18, color: colors.coral },
  bad: { color: colors.coral },
  teal: { color: colors.teal },
  urgent: { backgroundColor: colors.surface },
  urgentFill: { backgroundColor: colors.amber },
});
