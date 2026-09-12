/**
 * Limit czasu dla żądań sieciowych — działający tak samo pod Node i w aplikacji.
 *
 * `AbortSignal.timeout` i `AbortSignal.any` istnieją w Node, ale **nie w React
 * Native**: jego `AbortSignal` pochodzi z polyfillu `abort-controller`, który
 * ich nie ma. Wywołanie rzuca `TypeError` jeszcze przed `fetch`, a moduły, które
 * łapią wszystko i zwracają `null`, zamieniały to w cichy brak danych — testy
 * pod Node przechodziły, a na telefonie żądanie nigdy nie wychodziło.
 *
 * Importy względne (nie alias @/), żeby moduł dało się uruchomić poza Metro.
 */

/**
 * Sygnał, który przerywa po `ms` milisekundach albo razem z `signal`, jeśli go
 * podano.
 *
 * `clear` zwalnia zegar i trzeba go wywołać po zakończeniu żądania: inaczej
 * zegar wisi do końca limitu, a pod Node wstrzymuje zakończenie procesu.
 */
export function timeoutSignal(
  ms: number,
  signal?: AbortSignal,
): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  const forward = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', forward);

  return {
    signal: controller.signal,
    clear: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', forward);
    },
  };
}
