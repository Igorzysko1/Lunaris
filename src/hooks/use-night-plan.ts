import { useMemo } from 'react';

import { useBookingSite } from '@/hooks/use-booking-site';
import { useNow } from '@/hooks/use-now';
import type { NightCard } from '@/hooks/use-night-verdicts';
import { NO_PLAN, planSchedule, tonightAhead } from '@/lib/plan-text';
import { bookingId } from '@/lib/session-booking';
import { useSettings } from '@/store/settings';

/**
 * Noc › Plan dla wybranej nocy: przebieg doby z `planNights` rozpisany na
 * godziny, „co dalej dziś" liczone co minutę i klucz rezerwacji, pod którym
 * przebieg nocy dosyła godziny do kalendarza.
 */
export function useNightPlan(card: NightCard) {
  const { active } = useSettings();
  const site = useBookingSite();
  const now = useNow();

  const schedule = useMemo(
    () => planSchedule(card.session, { walkMinutes: active.walkMinutes }),
    [card.session, active.walkMinutes],
  );

  return {
    schedule,
    noPlan: NO_PLAN,
    ahead: tonightAhead(card.session, card.summary.moon.rise, now),
    bookingId: bookingId(card.session.verdict.night, site.id),
  };
}
