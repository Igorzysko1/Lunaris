import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Badge, Card, Divider } from '@/components/primitives';
import { formatTime } from '@/lib/date';
import { describeRejection, describeWarning, formatDuration, nightLabel } from '@/lib/session-text';
import type { Session } from '@/hooks/use-sessions';
import { HAIRLINE, colors, fonts, radius } from '@/theme';

export function SessionCard({
  session,
  locationLabel,
  now = new Date(),
}: {
  session: Session;
  locationLabel: string;
  now?: Date;
}) {
  const { verdict, minTemperature, feltTemperature, targets, uncertain } = session;
  // Odczuwalną pokazujemy tylko wtedy, gdy wiatr faktycznie coś zmienia —
  // inaczej byłaby to ta sama liczba dwa razy.
  const colderByWind =
    minTemperature !== null && feltTemperature !== null && minTemperature - feltTemperature >= 1;
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
              value={
                minTemperature === null
                  ? '—'
                  : colderByWind
                    ? `${Math.round(minTemperature)}°C (odczuw. ${Math.round(feltTemperature!)}°C)`
                    : `${Math.round(minTemperature)}°C`
              }
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
