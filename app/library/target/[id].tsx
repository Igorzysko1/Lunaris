import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { useTargetProfile } from '@/hooks/use-library';
import type { ReachLevel } from '@/lib/sky-targets';
import { colors, fonts, hexA } from '@/theme';
import { Body, Button, Label, MenuRow, Note, Panel, Sheet } from '@/ui/kit';
import { themedStyles } from '@/ui/theme';

const FOV_DIAMETER = 132;

/** Werdykt niesie znak, nie kolor: zobaczysz ✓, na styk !, nie zobaczysz ×. */
const REACH_MARK: Record<ReachLevel, string> = { in: '✓', marginal: '!', out: '×' };

/**
 * 12a: profil celu w bibliotece — „czym i kiedykolwiek", w odróżnieniu od
 * panelu celu w Nocy, który odpowiada „czy dziś i o której". Bez opisu
 * „po czym poznać": katalog go nie ma, a zmyślony byłby gorszy niż żaden.
 */
export default function TargetProfileSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = useTargetProfile(id);

  if (!profile.found) {
    return (
      <Sheet title="Cel">
        <Note>Tego obiektu nie ma w katalogu.</Note>
      </Sheet>
    );
  }

  return (
    <Sheet title={profile.title} subtitle={profile.subtitle}>
      <Panel>
        <Label flush>Czy to zobaczysz</Label>
        {profile.reach.map((reach) => (
          <View key={reach.id} style={styles.reach}>
            <Text style={[styles.reachMark, styles[reach.level]]}>{REACH_MARK[reach.level]}</Text>
            <View style={styles.flex}>
              <Text style={styles.title}>{reach.label}</Text>
              <Text style={styles.subtitle}>{reach.why}</Text>
            </View>
          </View>
        ))}
        <Note>{profile.reachNote}</Note>
      </Panel>

      <Panel>
        <Label flush>Rozmiar w polu widzenia</Label>
        <View style={styles.fov}>
          <View
            style={[
              styles.object,
              {
                width: Math.max(4, FOV_DIAMETER * profile.field.share),
                height: Math.max(4, FOV_DIAMETER * profile.field.share),
              },
            ]}
          />
        </View>
        <Body>{profile.field.text}</Body>
      </Panel>

      <Panel>
        <Label flush>Kiedy i jak wysoko</Label>
        {profile.when.map((line) => (
          <Body key={line}>{line}</Body>
        ))}
      </Panel>

      <Panel>
        <Label flush>Z katalogu</Label>
        {profile.facts.map(([key, value]) => (
          <View key={key} style={styles.fact}>
            <Text style={styles.subtitle}>{key}</Text>
            <Text style={styles.factValue}>{value}</Text>
          </View>
        ))}
      </Panel>

      {profile.constellation ? (
        <MenuRow
          title="Gwiazdozbiór"
          value={profile.constellation.name}
          onPress={() =>
            router.push({
              pathname: '/constellation/[id]',
              params: { id: profile.constellation!.id },
            })
          }
        />
      ) : null}
      <MenuRow
        title="Historia zobaczeń"
        value={profile.history}
        onPress={() => router.push({ pathname: '/target/[id]', params: { id } })}
      />
      <Button
        label={profile.picked ? 'Zdejmij z planu tej nocy' : 'Dopisz do planu tej nocy'}
        variant="primary"
        onPress={profile.togglePick}
      />
      <Button
        label="Pokaż w Niebie"
        onPress={() => router.navigate({ pathname: '/', params: { segment: 'sky' } })}
      />
    </Sheet>
  );
}

const styles = themedStyles(() => ({
  flex: { flex: 1 },
  reach: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 4 },
  reachMark: { width: 16, fontFamily: fonts.monoSemiBold, fontSize: 14 },
  in: { color: colors.green },
  marginal: { color: colors.amber },
  out: { color: colors.textMuted },
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
}));
