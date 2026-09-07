import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Badge, Card, Divider } from '@/components/primitives';
import { formatTime } from '@/lib/date';
import type { Rejection, Warning } from '@/lib/session-engine';
import type { Session } from '@/lib/use-sessions';
import { HAIRLINE, colors, fonts, radius } from '@/theme';

const MINUTES_PER_HOUR = 60;

/** np. „3 h 20 min" — długość okna czyta się szybciej niż same minuty. */
function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / MINUTES_PER_HOUR);
  const m = Math.round(minutes % MINUTES_PER_HOUR);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Nagłówek nocy: „Dziś w nocy", „Jutro", potem dzień tygodnia. */
function nightLabel(from: Date, now: Date): string {
  const days = ['niedzieli', 'poniedziałku', 'wtorku', 'środy', 'czwartku', 'piątku', 'soboty'];
  const sameDay =
    from.getFullYear() === now.getFullYear() &&
    from.getMonth() === now.getMonth() &&
    from.getDate() === now.getDate();

  if (sameDay) return 'Dziś w nocy';

  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const isTomorrow =
    from.getFullYear() === tomorrow.getFullYear() &&
    from.getMonth() === tomorrow.getMonth() &&
    from.getDate() === tomorrow.getDate();

  return isTomorrow ? 'Jutro w nocy' : `Z ${days[from.getDay()]} na następny dzień`;
}

/** Powód odrzucenia po ludzku — użytkownik ma wiedzieć, czego nie da się obejść. */
function describeRejection(rejection: Rejection): string {
  switch (rejection.kind) {
    case 'no-forecast':
      return 'Brak prognozy na tę noc.';
    case 'conditions':
      switch (rejection.blocker) {
        case 'precipitation':
          return 'Opady przez całą noc.';
        case 'cloud-low':
          return 'Chmury niskie zasłaniają niebo.';
        case 'cloud-high':
          return 'Gęste chmury wysokie przez całą noc.';
        case 'cloud-total':
          return 'Zachmurzenie powyżej progu przez całą noc.';
        case 'wind':
          return 'Porywy wiatru powyżej progu — sprzęt nie ustoi.';
      }
    // Świadome przejście do kolejnego case: każdy blocker wyżej kończy się return.
    case 'window-too-short':
      return `Najdłuższe pogodne okno to ${formatDuration(rejection.longestMinutes)} — za krótko.`;
    case 'not-enough-sleep':
      return `Zostałoby ${rejection.sleepHours.toFixed(1)} h snu przed pobudką.`;
    case 'early-calendar':
      return `Pierwsze jutrzejsze wydarzenie o ${formatTime(rejection.firstEventAt)}.`;
  }
}

function describeWarning(warning: Warning): string {
  switch (warning.kind) {
    case 'dew':
      return `Rosa: temperatura ${warning.minSpreadC.toFixed(1)}°C od punktu rosy — weź ogrzewacz na obiektyw.`;
    case 'high-clouds':
      return `Chmury wysokie do ${Math.round(warning.maxPercent)}% — kontrast będzie słabszy.`;
    case 'moon':
      return `Księżyc oświetlony w ${warning.illumination}% — tylko cele księżycowe i planetarne.`;
    case 'home-only':
      return `Wydarzenie o ${formatTime(warning.firstEventAt)} — trzymaj się bliskiej lokalizacji.`;
    case 'walk-too-long':
      return `Dojście od parkingu zajmuje ${Math.round(warning.walkMinutes)} min.`;
    case 'tight-sleep':
      return `Sen na styk: ${warning.sleepHours.toFixed(1)} h. Możesz odpuścić.`;
    case 'handheld-wind':
      return `Porywy do ${Math.round(warning.maxGustKmh)} km/h — dla sprzętu z ręki (próg ${warning.handheldLimitKmh} km/h) noc będzie trudna.`;
  }
}

export function SessionCard({
  session,
  locationLabel,
  now = new Date(),
}: {
  session: Session;
  locationLabel: string;
  now?: Date;
}) {
  const { verdict, minTemperature, targets, uncertain } = session;
  const { window, plan } = verdict;
  const go = verdict.status === 'go';
  const inReach = targets.filter((t) => t.visible);
  // Podpis sprzętu ma sens dopiero wtedy, gdy zestawów jest więcej niż jeden.
  const showProfile = new Set(targets.map((t) => t.profileId)).size > 1;

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.night}>{nightLabel(verdict.night.from, now)}</Text>
          <Text style={styles.location}>{locationLabel}</Text>
        </View>
        <Badge label={go ? 'JEDZIEMY' : 'ODPUŚĆ'} color={go ? colors.teal : colors.textMuted} />
      </View>

      {go && window && plan ? (
        <>
          <View style={styles.windowRow}>
            <Ionicons name="time-outline" size={15} color={colors.teal} />
            <Text style={styles.windowText}>
              {formatTime(window.from)}–{formatTime(window.to)}
            </Text>
            <Text style={styles.windowDuration}>{formatDuration(window.durationMinutes)}</Text>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.planGrid}>
            <PlanCell label="Wyjazd" value={formatTime(plan.departAt)} />
            <PlanCell label="Powrót" value={formatTime(plan.returnAt)} />
            <PlanCell label="Pobudka" value={plan.wakeAt ? formatTime(plan.wakeAt) : '—'} />
            <PlanCell
              label="Sen"
              value={plan.sleepHours !== null ? `${plan.sleepHours.toFixed(1)} h` : '—'}
              highlight={plan.sleepHours !== null && plan.sleepHours < 6}
            />
            <PlanCell
              label="Min. temp."
              value={minTemperature !== null ? `${Math.round(minTemperature)}°C` : '—'}
            />
          </View>

          {inReach.length > 0 && (
            <>
              <Divider style={styles.divider} />
              <Text style={styles.targetsLabel}>Cele w zasięgu</Text>
              <Text style={styles.targets}>
                {inReach
                  .slice(0, 4)
                  .map((t) => {
                    const name = `${t.name.split(' — ')[0]} (${Math.round(t.maxAltitude)}°)`;
                    return showProfile ? `${name} — ${t.profileLabel}` : name;
                  })
                  .join(' · ')}
              </Text>
            </>
          )}
        </>
      ) : (
        <View style={styles.rejection}>
          <Ionicons name="close-circle-outline" size={15} color={colors.textMuted} />
          <Text style={styles.rejectionText}>
            {verdict.rejection ? describeRejection(verdict.rejection) : 'Brak okna.'}
          </Text>
        </View>
      )}

      {(verdict.warnings.length > 0 || uncertain) && (
        <View style={styles.warnings}>
          {verdict.warnings.map((warning) => (
            <View key={warning.kind} style={styles.warningRow}>
              <Ionicons name="alert-circle-outline" size={13} color={colors.amber} />
              <Text style={styles.warningText}>{describeWarning(warning)}</Text>
            </View>
          ))}
          {uncertain && (
            <View style={styles.warningRow}>
              <Ionicons name="help-circle-outline" size={13} color={colors.textMuted} />
              <Text style={styles.warningTextMuted}>
                Trzecia doba — prognoza jeszcze orientacyjna, sprawdź ponownie jutro.
              </Text>
            </View>
          )}
        </View>
      )}
    </Card>
  );
}

function PlanCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.planCell}>
      <Text style={styles.planLabel}>{label}</Text>
      <Text style={[styles.planValue, highlight && { color: colors.amber }]}>{value}</Text>
    </View>
  );
}

export function SessionsSkeleton() {
  return (
    <View>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.skeleton, i < 2 && styles.skeletonGap]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  night: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  location: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  windowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 12,
  },
  windowText: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 17,
    color: colors.textPrimary,
  },
  windowDuration: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textMuted,
  },
  divider: {
    marginVertical: 12,
  },
  planGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 10,
  },
  planCell: {
    width: '33.33%',
  },
  planLabel: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 2,
  },
  planValue: {
    fontFamily: fonts.monoMedium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  targetsLabel: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 4,
  },
  targets: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  rejection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    marginTop: 10,
  },
  rejectionText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  warnings: {
    marginTop: 12,
    gap: 6,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  warningText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  warningTextMuted: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  skeleton: {
    height: 128,
    backgroundColor: colors.surface,
    borderWidth: HAIRLINE,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  skeletonGap: {
    marginBottom: 12,
  },
});
