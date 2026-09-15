import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Toggle } from '@/components/Toggle';
import { NOTIFICATIONS } from '@/mock/calendar';
import { colors, fonts } from '@/theme';
import { Chip, Label, MenuRow, Note, Panel, Screen, TitleBar, todo } from '@/ui/kit';

/**
 * 15c: ekran powiadomień pokazuje decyzje, nie tylko przełączniki — co się
 * odezwie, kiedy i jakim zdaniem, plus to, co przemilczane, z powodem.
 */
export default function NotificationsScreen() {
  const [categories, setCategories] = useState(NOTIFICATIONS.categories);

  return (
    <Screen>
      <TitleBar back title="Powiadomienia" />
      <MenuRow
        title="Wyprzedzenie"
        value={NOTIFICATIONS.leadTime}
        onPress={() => todo('Zmiana wyprzedzenia powiadomień')}
      />
      <MenuRow
        title="Pora przeglądu"
        value={NOTIFICATIONS.reviewTime}
        onPress={() => todo('Zmiana pory codziennego przeglądu')}
      />

      <Label>Kategorie</Label>
      {categories.map((category) => (
        <Panel key={category.id} style={styles.row}>
          <Text style={[styles.title, !category.on && styles.dim]}>{category.label}</Text>
          <Toggle
            value={category.on}
            label={category.label}
            onPress={() =>
              setCategories((list) =>
                list.map((c) => (c.id === category.id ? { ...c, on: !c.on } : c)),
              )
            }
          />
        </Panel>
      ))}

      <Label>Zaplanowane</Label>
      {NOTIFICATIONS.scheduled.map((item) => (
        <Panel key={item.title} tone={item.badge[1] === 'go' ? 'go' : undefined}>
          <View style={styles.row}>
            <Text style={styles.title}>{item.title}</Text>
            <Chip label={item.badge[0]} tone={item.badge[1]} />
          </View>
          <Text style={styles.mono}>{item.when}</Text>
          <Text style={styles.quote}>{item.quote}</Text>
          {item.note ? <Note>{item.note}</Note> : null}
        </Panel>
      ))}

      <Label>Nie odezwie się</Label>
      <Panel>
        {NOTIFICATIONS.silent.map((item, i) => (
          <View key={item.title} style={[styles.silent, i > 0 && styles.divider]}>
            <View style={styles.row}>
              <Text style={[styles.title, styles.dim]}>{item.title}</Text>
              <Text style={styles.mono}>{item.date}</Text>
            </View>
            <Note>{item.why}</Note>
          </View>
        ))}
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { flex: 1, fontFamily: fonts.sans, fontSize: 15, color: colors.textPrimary },
  dim: { color: colors.textSecondary },
  mono: { fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary },
  quote: { fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 20, color: colors.textPrimary },
  silent: { gap: 4, paddingVertical: 6 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
});
