import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { lightPollutionMapUrl } from '@/lib/light-pollution';
import { HAIRLINE, colors, fonts, radius } from '@/theme';

type Props = {
  lat: number;
  lon: number;
  /** Kontekst zmienia się między ekranami — na Nocy szukamy ucieczki od łuny, w pickerze oceniamy miejsce. */
  subtitle: string;
  style?: StyleProp<ViewStyle>;
};

/** Wychodzi z aplikacji do zewnętrznej mapy — stąd ikona „otwórz na zewnątrz". */
/**
 * Otwarcie przeglądarki systemowej. Gdy się nie uda — brak przeglądarki albo
 * odmowa systemu — nie ma czego pokazać, ale to nie powód, żeby wywracać ekran.
 */
function openMap(lat: number, lon: number): void {
  Linking.openURL(lightPollutionMapUrl(lat, lon)).catch(() => {});
}

export function LightPollutionLink({ lat, lon, subtitle, style }: Props) {
  return (
    <Pressable
      onPress={() => openMap(lat, lon)}
      accessibilityRole="link"
      accessibilityLabel="Otwórz mapę zanieczyszczenia światłem"
      style={[styles.row, style]}
    >
      <View style={styles.left}>
        <Ionicons name="map-outline" size={20} color={colors.purple} />
        <View style={styles.text}>
          <Text style={styles.title}>Mapa zanieczyszczenia światłem</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>
      <Ionicons name="open-outline" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: colors.surfaceRaised,
    borderWidth: HAIRLINE,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  text: {
    flex: 1,
  },
  title: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
});
