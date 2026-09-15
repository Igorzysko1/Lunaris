import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

import { HAIRLINE, colors, fonts, hexA } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * Pięć zakładek z projektu „Lunaris IA" (wariant 1a): cztery pytania i reszta.
 * Noc — czy jechać, Gdzie — skąd, Kalendarz — kiedy, Dziennik — co widziałem.
 * Do „Więcej" trafia wszystko, co nie zmienia werdyktu w ciągu nocy.
 *
 * „Kalend." zamiast „Kalendarz", bo przy 11 px pełna etykieta dotyka sąsiadów.
 */
const TABS: { name: string; title: string; icon: IconName; iconFocused: IconName }[] = [
  { name: 'index', title: 'Noc', icon: 'moon-outline', iconFocused: 'moon' },
  { name: 'where', title: 'Gdzie', icon: 'location-outline', iconFocused: 'location' },
  { name: 'calendar', title: 'Kalend.', icon: 'calendar-outline', iconFocused: 'calendar' },
  { name: 'log', title: 'Dziennik', icon: 'book-outline', iconFocused: 'book' },
  {
    name: 'more',
    title: 'Więcej',
    icon: 'ellipsis-horizontal-circle-outline',
    iconFocused: 'ellipsis-horizontal-circle',
  },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.purple,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarActiveBackgroundColor: hexA(colors.purple, 0.12),
        tabBarStyle: {
          backgroundColor: colors.surfaceRaised,
          borderTopWidth: HAIRLINE,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.mono,
          fontSize: 11,
        },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? tab.iconFocused : tab.icon} size={22} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
