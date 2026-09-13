/**
 * Przychodzące linki systemowe, zanim zobaczy je router.
 *
 * Po zgodzie w Google przeglądarka wraca do aplikacji adresem
 * `com.igormusial.lunaris:/oauthredirect?code=…`. Ten sam link odbierają dwa
 * miejsca naraz: `expo-web-browser`, który czeka na kod i kończy logowanie,
 * oraz expo-router, który traktuje go jak adres ekranu `oauthredirect` —
 * takiego ekranu nie ma, więc zamiast Ustawień pokazywał „Unmatched Route".
 *
 * Router ma więc takie przekierowanie przepuścić bez nawigacji. Kod
 * autoryzacji i tak do niego nie należy, a logowanie kończy się bez niego.
 */

/** Ścieżka powrotu z logowania — ta sama, którą podaje `google-account.ts`. */
const OAUTH_REDIRECT = /oauthredirect/;

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  try {
    if (!OAUTH_REDIRECT.test(path)) return path;

    // Zwykle aplikacja czeka w tle na powrót z przeglądarki: `null` zostawia
    // użytkownika na ekranie, z którego zaczął. Gdy system zdążył ją w tym
    // czasie zamknąć, link ją uruchamia od zera — logowania nie da się już
    // dokończyć, więc wracamy tam, skąd da się je ponowić.
    return initial ? '/settings' : null;
  } catch {
    // Wyjątek w tym miejscu wywraca aplikację, a zły adres co najwyżej
    // pokazuje ekran błędu routera.
    return path;
  }
}
