/**
 * Zdjęcie dnia NASA dla ekranu Noc.
 *
 * Najpierw zapis, potem sieć — jak wszystkie dane sieciowe w tej aplikacji.
 * Różnica jest w tym, czego brakuje: nie ma tu ani stanu błędu, ani ponawiania,
 * ani przycisku „spróbuj ponownie". Karta jest ozdobą, więc jedyne, co może się
 * nie udać, to jej nieobecność.
 *
 * Pobieramy raz na dobę, po dacie materiału, a nie po wieku zapisu: APOD zmienia
 * się o określonej porze i sprawdzanie „czy zapis ma już dobę" trafiałoby obok.
 */

import { useEffect, useState } from 'react';

import { fetchApod, type Apod } from '@/lib/apod';
import { loadApod, saveApod } from '@/lib/forecast-cache';

/** Dzisiejsza data w postaci, w jakiej podaje ją APOD. */
function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function useApod(): Apod | null {
  const [apod, setApod] = useState<Apod | null>(null);

  useEffect(() => {
    const abort = new AbortController();

    (async () => {
      const cached = await loadApod<Apod>();
      if (abort.signal.aborted) return;

      // Zapis pokazujemy od razu, nawet gdy jest wczorajszy: lepiej wczorajsze
      // zdjęcie z podpisaną datą niż puste miejsce, w którym za chwilę coś
      // wskoczy. Jeśli jest już nieaktualny, sieć go po cichu podmieni.
      if (cached) setApod(cached.payload);
      if (cached?.payload.date === today()) return;

      const fresh = await fetchApod(abort.signal);
      if (abort.signal.aborted || !fresh) return;

      setApod(fresh);
      await saveApod(fresh);
    })();

    return () => abort.abort();
  }, []);

  return apod;
}
