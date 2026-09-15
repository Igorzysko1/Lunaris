import { useMock, type SessionMock } from '@/mock/state';
import { Chip, ChipRow, Label, Note, Screen, TitleBar } from '@/ui/kit';

const SESSION: [SessionMock, string][] = [
  ['before', 'przed wyjazdem (9a)'],
  ['live', 'noc w trakcie (9b, 6a)'],
];

/** Przełączniki stanów rozrysowanych w projekcie — tylko do przeglądu makiety. */
export default function MockStatesScreen() {
  const mock = useMock();

  return (
    <Screen>
      <TitleBar back title="Stany makiety" subtitle="znikną po podpięciu danych" />

      <Label>Sesja</Label>
      <ChipRow>
        {SESSION.map(([value, label]) => (
          <Chip
            key={value}
            label={label}
            tone={mock.session === value ? 'accent' : 'neutral'}
            onPress={() => mock.set({ session: value })}
          />
        ))}
      </ChipRow>

      <Note>
        Noc w trakcie zamienia segment Plan w listę odhaczeń i otwiera odhaczanie w panelu celu —
        także za dnia, więc odhaczenie zapisuje się w dzienniku naprawdę. Gdy sesja nie trwa,
        werdykt pokazuje start okna jako „teraz”. Werdykt, prognoza, rezerwacja i konto Google są
        prawdziwe — zależą od danych, nie od przełącznika.
      </Note>
    </Screen>
  );
}
