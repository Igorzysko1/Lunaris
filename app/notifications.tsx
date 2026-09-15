import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Toggle } from '@/components/Toggle';
import { useNotificationsView } from '@/hooks/use-events';
import { colors, fonts } from '@/theme';
import { Chip, Label, MenuRow, Note, Notice, Panel, Screen, TitleBar } from '@/ui/kit';

/**
 * 15c: ekran powiadomień pokazuje decyzje, nie tylko przełączniki — co się
 * odezwie, kiedy i jakim zdaniem, plus to, co przemilczane, z powodem.
 */
export default function NotificationsScreen() {
  const view = useNotificationsView();

  return (
    <Screen>
      <TitleBar back title="Powiadomienia" />
      {!view.available ? (
        <Notice tone="neutral" mark="·">
          W tym środowisku powiadomienia nie działają — plan się liczy, ale telefon się nie odezwie.
        </Notice>
      ) : null}

      <Panel style={styles.row}>
        <Text style={styles.title}>Powiadomienia</Text>
        <Toggle value={view.enabled} label="Powiadomienia" onPress={view.toggleEnabled} />
      </Panel>
      <MenuRow
        title="Wyprzedzenie"
        subtitle="przed zjawiskiem albo otwarciem okna dobrej nocy"
        value={view.lead}
        chevron="↻"
        onPress={view.nextLead}
      />
      <Panel style={styles.row}>
        <View style={styles.flex}>
          <Text style={styles.title}>Pora przeglądu</Text>
          <Text style={styles.mono}>ta sama co odświeżanie prognozy</Text>
        </View>
        <Pressable
          onPress={view.earlier}
          accessibilityRole="button"
          accessibilityLabel="Przegląd godzinę wcześniej"
          style={styles.step}
        >
          <Text style={styles.stepSign}>−</Text>
        </Pressable>
        <Text style={styles.hour}>{view.reviewHour}</Text>
        <Pressable
          onPress={view.later}
          accessibilityRole="button"
          accessibilityLabel="Przegląd godzinę później"
          style={styles.step}
        >
          <Text style={styles.stepSign}>+</Text>
        </Pressable>
      </Panel>

      <Label>Kategorie</Label>
      {view.categories.map((category) => (
        <Panel key={category.id} style={styles.row}>
          <Text style={[styles.title, !category.on && styles.dim]}>{category.label}</Text>
          <Toggle
            value={category.on}
            label={category.label}
            onPress={() => view.toggleCategory(category.id)}
          />
        </Panel>
      ))}

      <Label>Zaplanowane</Label>
      {view.scheduled.length === 0 ? (
        <Note>
          {view.enabled
            ? 'Nic nie czeka na odezwanie się — przegląd sprawdzi to znowu po nowej prognozie.'
            : 'Powiadomienia są wyłączone.'}
        </Note>
      ) : null}
      {view.scheduled.map((item) => (
        <Panel key={item.id} tone={item.badge.tone === 'go' ? 'go' : undefined}>
          <View style={styles.row}>
            <Text style={styles.title}>{item.title}</Text>
            <Chip label={item.badge.label} tone={item.badge.tone} />
          </View>
          <Text style={styles.mono}>{item.when}</Text>
          <Text style={styles.quote}>{item.quote}</Text>
          {item.note ? <Note>{item.note}</Note> : null}
        </Panel>
      ))}

      {view.silent.length > 0 ? (
        <>
          <Label right="najbliższe 2 tygodnie">Nie odezwie się</Label>
          <Panel>
            {view.silent.map((item, i) => (
              <View key={item.id} style={[styles.silent, i > 0 && styles.divider]}>
                <View style={styles.row}>
                  <Text style={[styles.title, styles.dim]}>{item.title}</Text>
                  <Text style={styles.mono}>{item.date}</Text>
                </View>
                <Note>{item.why}</Note>
              </View>
            ))}
          </Panel>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { flex: 1, fontFamily: fonts.sans, fontSize: 15, color: colors.textPrimary },
  dim: { color: colors.textSecondary },
  mono: { fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary },
  quote: { fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 20, color: colors.textPrimary },
  silent: { gap: 4, paddingVertical: 6 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  step: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepSign: { fontFamily: fonts.mono, fontSize: 18, color: colors.purple },
  hour: { fontFamily: fonts.monoSemiBold, fontSize: 16, color: colors.textPrimary },
});
