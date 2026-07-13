import { colors } from '@/theme';

export type EventCategory = 'moon' | 'planets' | 'meteor';

export type EventType =
  | 'conjunction'
  | 'moon_phase'
  | 'opposition'
  | 'meteor_shower'
  | 'eclipse';

export type AstroEvent = {
  id: string;
  /** Day heading the event is grouped under on the Events screen. */
  bucket: string;
  cat: EventCategory;
  type: EventType;
  date: string;
  title: string;
  desc: string;
  visible: boolean;
};

export const TYPE_META: Record<EventType, { color: string; label: string }> = {
  conjunction: { color: colors.purple, label: 'KONIUNKCJA' },
  moon_phase: { color: colors.amber, label: 'FAZA KSIĘŻYCA' },
  opposition: { color: colors.teal, label: 'OPOZYCJA' },
  meteor_shower: { color: colors.coral, label: 'RÓJ METEORÓW' },
  eclipse: { color: colors.coral, label: 'ZAĆMIENIE' },
};

/** Order the Events screen groups its buckets in. */
export const BUCKET_ORDER = ['Dziś', 'Jutro', 'śr., 15 lip.', 'sob., 18 lip.'];

export const EVENTS: AstroEvent[] = [
  {
    id: 'e1',
    bucket: 'Dziś',
    cat: 'moon',
    type: 'conjunction',
    date: '22:40',
    title: 'Koniunkcja Księżyca i Jowisza',
    desc: 'Księżyc i Jowisz zbliżą się na 4° nad południowo-wschodnim horyzontem tuż po wschodzie.',
    visible: true,
  },
  {
    id: 'e2',
    bucket: 'Jutro',
    cat: 'moon',
    type: 'moon_phase',
    date: '14:08',
    title: 'Pełnia Księżyca',
    desc: 'Księżyc w pełni, 100% oświetlenia — silne rozświetlenie nieba przez całą noc, słaba widoczność obiektów mgławicowych.',
    visible: false,
  },
  {
    id: 'e3',
    bucket: 'śr., 15 lip.',
    cat: 'planets',
    type: 'opposition',
    date: '03:20',
    title: 'Opozycja Saturna',
    desc: 'Saturn w opozycji do Słońca — najlepsza widoczność w roku, pierścienie dobrze nachylone.',
    visible: true,
  },
  {
    id: 'e4',
    bucket: 'sob., 18 lip.',
    cat: 'planets',
    type: 'conjunction',
    date: '04:50',
    title: 'Koniunkcja Wenus i Marsa',
    desc: 'Wenus i Mars w odległości 1,2° tuż przed świtem, nisko nad wschodnim horyzontem.',
    visible: true,
  },
];

export const EVENT_FILTERS: { key: EventCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'Wszystkie' },
  { key: 'moon', label: 'Księżyc' },
  { key: 'planets', label: 'Planety' },
  { key: 'meteor', label: 'Meteory' },
];
