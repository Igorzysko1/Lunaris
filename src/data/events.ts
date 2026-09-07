// Import względny (nie alias @/), żeby typy i metadane były dostępne dla warstwy
// domenowej uruchamianej poza Metro.
import { colors } from '../theme.ts';

export type EventCategory = 'moon' | 'planets' | 'meteor';

export type EventType = 'conjunction' | 'moon_phase' | 'opposition' | 'meteor_shower' | 'eclipse';

export type AstroEvent = {
  id: string;
  cat: EventCategory;
  type: EventType;
  /** Moment zdarzenia. Nagłówki dnia i godzinę liczy z tego UI — patrz src/lib/date.ts. */
  at: Date;
  title: string;
  desc: string;
  /**
   * Czy tej nocy da się to zobaczyć z aktywnej lokalizacji.
   * Liczone z wysokości obiektu nad horyzontem — patrz src/lib/events.ts.
   */
  visible: boolean;
};

export const TYPE_META: Record<EventType, { color: string; label: string }> = {
  conjunction: { color: colors.purple, label: 'KONIUNKCJA' },
  moon_phase: { color: colors.amber, label: 'FAZA KSIĘŻYCA' },
  opposition: { color: colors.teal, label: 'OPOZYCJA' },
  meteor_shower: { color: colors.coral, label: 'RÓJ METEORÓW' },
  eclipse: { color: colors.coral, label: 'ZAĆMIENIE' },
};

export const EVENT_FILTERS: { key: EventCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'Wszystkie' },
  { key: 'moon', label: 'Księżyc' },
  { key: 'planets', label: 'Planety' },
  { key: 'meteor', label: 'Meteory' },
];
