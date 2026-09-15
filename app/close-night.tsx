import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CLOSE_NIGHT, FAILURE_REASONS } from '@/mock/journal';
import { colors, fonts, hexA } from '@/theme';
import {
  Button,
  CheckBox,
  Chip,
  ChipRow,
  Field,
  Label,
  MenuRow,
  Panel,
  Sheet,
  todo,
} from '@/ui/kit';

type Outcome = 'none' | 'seen' | 'failed';

const NEXT: Record<Outcome, Outcome> = { none: 'seen', seen: 'failed', failed: 'none' };

/**
 * 4a/4b: arkusz zamknięcia nocy — ten sam z Nocy i z Dziennika. Cele, miejsce
 * i sprzęt są już wpisane z planu. Odhaczenie ma trzy stany: puste, widziałem,
 * nie wyszło — i w trzecim dochodzi powód jednym słowem z listy. Ten powód
 * zasila propozycję korekty progu, ostatni wiersz przed przyciskiem.
 */
export default function CloseNightSheet() {
  const [outcomes, setOutcomes] = useState<Outcome[]>(
    CLOSE_NIGHT.targets.map((target) => target.initial),
  );
  const [reasons, setReasons] = useState<(string | null)[]>(
    CLOSE_NIGHT.targets.map((target) => target.reason ?? null),
  );
  const [editing, setEditing] = useState<number | null>(null);
  const [otherReason, setOtherReason] = useState('');
  const [transparency, setTransparency] = useState<number | null>(null);
  const [seeing, setSeeing] = useState<number | null>(null);
  const [note, setNote] = useState('');

  const seen = outcomes.filter((outcome) => outcome === 'seen').length;
  const dewFailed = outcomes.some((outcome, i) => outcome === 'failed' && reasons[i] === 'rosa');

  function cycle(i: number) {
    const next = NEXT[outcomes[i]];
    setOutcomes((all) => all.map((value, j) => (j === i ? next : value)));
    setEditing(next === 'failed' ? i : null);
    if (next !== 'failed') setReasons((all) => all.map((value, j) => (j === i ? null : value)));
  }

  function chooseReason(i: number, reason: string) {
    setReasons((all) => all.map((value, j) => (j === i ? reason : value)));
    if (reason !== 'inne') setEditing(null);
  }

  return (
    <Sheet title="Jak było?" subtitle={CLOSE_NIGHT.subtitle}>
      <Label flush tone={seen ? 'go' : undefined} right={`${seen} z ${CLOSE_NIGHT.targets.length}`}>
        Cele z planu
      </Label>
      {CLOSE_NIGHT.targets.map((target, i) => {
        const outcome = outcomes[i];

        return (
          <View key={target.name} style={styles.group}>
            <Panel
              tone={outcome === 'seen' ? 'go' : undefined}
              onPress={() => cycle(i)}
              style={[styles.target, outcome === 'seen' && styles.surface]}
            >
              <CheckBox checked={outcome === 'seen'} failed={outcome === 'failed'} />
              <Text style={[styles.targetName, outcome === 'failed' && styles.dim]}>
                {target.name}
                {target.firstTime && outcome === 'seen' ? (
                  <Text style={styles.firstTime}> 1. RAZ</Text>
                ) : null}
              </Text>
              <Text style={styles.time}>
                {outcome === 'failed' ? (reasons[i] ?? 'powód?') : target.time}
              </Text>
            </Panel>

            {editing === i ? (
              <Panel tone="bad" style={styles.reasons}>
                <Label flush>{`${target.name} — dlaczego nie wyszło`}</Label>
                <ChipRow>
                  {FAILURE_REASONS.map((reason) => (
                    <Chip
                      key={reason}
                      label={reason === 'inne' ? 'inne…' : reason}
                      tone={reasons[i] === reason ? 'bad' : 'neutral'}
                      dashed={reason === 'inne'}
                      onPress={() => chooseReason(i, reason)}
                    />
                  ))}
                </ChipRow>
                {reasons[i] === 'inne' ? (
                  <Field
                    value={otherReason}
                    onChangeText={setOtherReason}
                    placeholder="Własny powód — zostanie w podpowiedziach"
                    autoFocus
                  />
                ) : null}
              </Panel>
            ) : null}
          </View>
        );
      })}
      <Panel dashed onPress={() => todo('Dopisywanie celów spoza planu')} style={styles.target}>
        <Text style={styles.plus}>+</Text>
        <Text style={styles.more}>{CLOSE_NIGHT.more}</Text>
      </Panel>

      <Label>Jak było</Label>
      <Scale label="przejrzystość" value={transparency} onChange={setTransparency} />
      <Scale label="spokój" value={seeing} onChange={setSeeing} />
      <Field
        value={note}
        onChangeText={setNote}
        placeholder="Notatka — co zapamiętać na następny raz"
        multiline
      />

      {dewFailed ? (
        <MenuRow
          tone="accent"
          title={CLOSE_NIGHT.thresholdSuggestion}
          onPress={() => todo('Korekta progu rosy na podstawie nieudanego celu')}
        />
      ) : null}

      <Button
        label="zapisz noc"
        tone="accent"
        onPress={() => {
          router.back();
          todo('Zapis nocy do dziennika');
        }}
      />
    </Sheet>
  );
}

/** Skala 1–5 wypełniana do wybranej wartości, z liczbą obok etykiety. */
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

const styles = StyleSheet.create({
  group: { gap: 8 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
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
});
