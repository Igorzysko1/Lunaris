/**
 * Wykonanie planu powiadomień — cienka warstwa nad `expo-notifications`.
 *
 * Sama nie podejmuje **żadnej** decyzji: co i kiedy ma zabrzmieć, rozstrzyga
 * `notification-plan.ts`, który jest czysty i pokryty testami. Tutaj zostaje
 * tylko to, czego nie da się uruchomić bez telefonu — uprawnienia, kanał
 * Androida i właściwe wywołania systemowe. Ten podział jest celowy: gdyby
 * reguły siedziały tutaj, jedynym sposobem ich sprawdzenia byłoby czekanie do
 * nocy z telefonem w ręku.
 *
 * Nic tu nie rzuca. Powiadomienia są udogodnieniem — odmowa uprawnień,
 * niedostępny moduł czy pełna kolejka systemowa nie mogą przewrócić ekranu,
 * który bez nich działa tak samo.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { reconcile, type PlannedNotification } from './notification-plan';

/**
 * Kanał na Androidzie. Od API 26 powiadomienie bez kanału nie pojawia się
 * w ogóle — i nie zgłasza tego błędem, po prostu nie ma go na ekranie.
 */
const CHANNEL_ID = 'lunaris-nights';

/**
 * Identyfikator planu wędruje w `data`, a nie w identyfikatorze systemowym.
 *
 * `scheduleNotificationAsync` zwraca własny identyfikator i to nim trzeba
 * potem odwoływać; naszego nie da się narzucić. Trzymamy więc swój obok,
 * w danych powiadomienia, i po nim odtwarzamy, co w systemie już wisi.
 */
type PlanData = { planId: string };

let channelReady = false;

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android' || channelReady) return;

  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Noce i zjawiska',
    importance: Notifications.AndroidImportance.DEFAULT,
    // Bez wibracji i bez światła: powiadomienie przychodzi wieczorem, często
    // wtedy, gdy telefon leży obok śpiącego domownika.
    vibrationPattern: [0],
    enableVibrate: false,
  });

  channelReady = true;
}

/**
 * Pyta o zgodę, ale **tylko raz** — jeśli użytkownik już odmówił, nie wracamy
 * z tym pytaniem przy każdym odświeżeniu. Ponowne włączenie robi się wtedy
 * w ustawieniach systemu i tak też należy o tym mówić.
 */
export async function requestPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;

    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

/** Co system aktualnie trzyma — po naszych identyfikatorach, nie po systemowych. */
async function scheduledPlanIds(): Promise<Map<string, string>> {
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  const byPlanId = new Map<string, string>();

  for (const item of pending) {
    const data = item.content.data as Partial<PlanData> | undefined;
    if (typeof data?.planId === 'string') byPlanId.set(data.planId, item.identifier);
  }

  return byPlanId;
}

export type SyncResult = { scheduled: number; cancelled: number; permitted: boolean };

/**
 * Doprowadza stan systemu do planu.
 *
 * Wołane po każdym udanym przebiegu cyklu dobowego. Plan liczy się wtedy od
 * zera dla **aktywnej** lokalizacji, więc zmiana miejscówki nie potrzebuje
 * osobnej ścieżki: nowy plan po prostu nie zawiera wpisów starego miejsca,
 * a `reconcile` je kasuje.
 */
export async function syncNotifications(plan: PlannedNotification[]): Promise<SyncResult> {
  const empty: SyncResult = { scheduled: 0, cancelled: 0, permitted: false };

  try {
    // Pusty plan to też polecenie: skasuj wszystko. Wykonujemy je bez pytania
    // o zgodę — cofnięcie obietnicy nie wymaga uprawnień.
    const permitted = plan.length === 0 || (await requestPermission());

    const present = await scheduledPlanIds();
    const { schedule, cancel } = reconcile(plan, [...present.keys()]);

    for (const planId of cancel) {
      const systemId = present.get(planId);
      if (systemId) await Notifications.cancelScheduledNotificationAsync(systemId);
    }

    if (!permitted) return { scheduled: 0, cancelled: cancel.length, permitted: false };

    await ensureChannel();

    for (const notification of schedule) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          data: { planId: notification.id } satisfies PlanData,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: notification.at,
          channelId: CHANNEL_ID,
        },
      });
    }

    return { scheduled: schedule.length, cancelled: cancel.length, permitted: true };
  } catch {
    // Moduł bywa niedostępny — w Expo Go część funkcji powiadomień nie działa,
    // a użytkownik ma wtedy zobaczyć aplikację, a nie awarię.
    return empty;
  }
}
