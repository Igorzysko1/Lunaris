/**
 * Wykonanie planu powiadomień — cienka warstwa nad `expo-notifications`.
 *
 * Sama nie podejmuje **żadnej** decyzji: co i kiedy ma zabrzmieć, rozstrzyga
 * `notification-plan.ts`, który jest czysty i pokryty testami. Tutaj zostaje
 * tylko to, czego nie da się uruchomić bez telefonu — uprawnienia, kanał
 * Androida i właściwe wywołania systemowe.
 *
 * ## Dlaczego moduł ładuje się leniwie
 *
 * Od SDK 53 `expo-notifications` **wywala się na Androidzie w Expo Go** — i to
 * już przy rejestracji modułu, a nie przy pierwszym wywołaniu. Zwykły
 * `import ... from 'expo-notifications'` na górze pliku wystarczał więc, żeby
 * cała aplikacja padała przy starcie z „uncaught error", zanim jakikolwiek
 * `try` zdążył cokolwiek złapać. Bramka środowiska sprawdzana **przed**
 * dynamicznym importem jest jedynym miejscem, w którym da się to zatrzymać.
 *
 * Nic tu nie rzuca. Powiadomienia są udogodnieniem — brak modułu, odmowa
 * uprawnień czy pełna kolejka systemowa nie mogą przewrócić ekranu, który bez
 * nich działa tak samo.
 */

import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { reconcile, type PlannedNotification } from './notification-plan';

/**
 * Czy w tym środowisku wolno w ogóle sięgnąć po moduł powiadomień.
 *
 * `storeClient` to Expo Go. Na Androidzie moduł jest tam martwy — nie
 * „ograniczony", tylko rzucający przy ładowaniu — więc traktujemy go jak
 * nieistniejący. Na iOS i we własnym buildzie działa normalnie.
 */
export const NOTIFICATIONS_AVAILABLE = !(
  Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient
);

/**
 * Moduł wczytywany na żądanie. `null`, gdy środowisko go nie ma — wtedy cała
 * warstwa jest cichym brakiem działania, a nie awarią.
 */
type NotificationsModule = typeof import('expo-notifications');

let cached: Promise<NotificationsModule | null> | null = null;

function notifications(): Promise<NotificationsModule | null> {
  if (!NOTIFICATIONS_AVAILABLE) return Promise.resolve(null);

  // Import trzymamy w zmiennej: powtórne wywołanie ma dostać ten sam moduł,
  // a nie ponawiać ładowanie przy każdym przebiegu cyklu.
  cached ??= import('expo-notifications').catch(() => null);
  return cached;
}

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

async function ensureChannel(api: NotificationsModule): Promise<void> {
  if (Platform.OS !== 'android' || channelReady) return;

  await api.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Noce i zjawiska',
    importance: api.AndroidImportance.DEFAULT,
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
    const api = await notifications();
    if (!api) return false;

    const current = await api.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;

    const asked = await api.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

/** Co system aktualnie trzyma — po naszych identyfikatorach, nie po systemowych. */
async function scheduledPlanIds(api: NotificationsModule): Promise<Map<string, string>> {
  const pending = await api.getAllScheduledNotificationsAsync();
  const byPlanId = new Map<string, string>();

  for (const item of pending) {
    const data = item.content.data as Partial<PlanData> | undefined;
    if (typeof data?.planId === 'string') byPlanId.set(data.planId, item.identifier);
  }

  return byPlanId;
}

export type SyncResult = {
  scheduled: number;
  cancelled: number;
  permitted: boolean;
  /** `false` znaczy „to środowisko nie ma powiadomień", a nie „nie udało się". */
  available: boolean;
};

const NOTHING: SyncResult = { scheduled: 0, cancelled: 0, permitted: false, available: false };

/**
 * Doprowadza stan systemu do planu.
 *
 * Wołane po każdym udanym przebiegu cyklu dobowego. Plan liczy się wtedy od
 * zera dla **aktywnej** lokalizacji, więc zmiana miejscówki nie potrzebuje
 * osobnej ścieżki: nowy plan po prostu nie zawiera wpisów starego miejsca,
 * a `reconcile` je kasuje.
 */
export async function syncNotifications(plan: PlannedNotification[]): Promise<SyncResult> {
  try {
    const api = await notifications();
    if (!api) return NOTHING;

    // Pusty plan to też polecenie: skasuj wszystko. Wykonujemy je bez pytania
    // o zgodę — cofnięcie obietnicy nie wymaga uprawnień.
    const permitted = plan.length === 0 || (await requestPermission());

    const present = await scheduledPlanIds(api);
    const { schedule, cancel } = reconcile(plan, [...present.keys()]);

    for (const planId of cancel) {
      const systemId = present.get(planId);
      if (systemId) await api.cancelScheduledNotificationAsync(systemId);
    }

    if (!permitted) {
      return { scheduled: 0, cancelled: cancel.length, permitted: false, available: true };
    }

    await ensureChannel(api);

    for (const notification of schedule) {
      await api.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          data: { planId: notification.id } satisfies PlanData,
        },
        trigger: {
          type: api.SchedulableTriggerInputTypes.DATE,
          date: notification.at,
          channelId: CHANNEL_ID,
        },
      });
    }

    return {
      scheduled: schedule.length,
      cancelled: cancel.length,
      permitted: true,
      available: true,
    };
  } catch {
    // Ostatnia siatka: gdyby moduł jednak zawiódł w środowisku, które uznaliśmy
    // za sprawne, użytkownik ma zobaczyć aplikację, a nie awarię.
    return NOTHING;
  }
}
