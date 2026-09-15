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

      <Label>Kalendarz Google</Label>
      <ChipRow>
        <Chip
          label="połączony"
          tone={mock.googleConnected ? 'accent' : 'neutral'}
          onPress={() => mock.set({ googleConnected: true })}
        />
        <Chip
          label="bez konta"
          tone={mock.googleConnected ? 'neutral' : 'accent'}
          onPress={() => mock.set({ googleConnected: false })}
        />
      </ChipRow>

      <Note>
        Noc w trakcie zamienia segment Plan w listę odhaczeń i dodaje odhaczanie w panelu celu. Gdy
        sesja nie trwa naprawdę, werdykt pokazuje wtedy start okna jako „teraz”. Werdykt, prognoza i
        brak prognozy są już prawdziwe — zależą od danych, nie od przełącznika.
      </Note>
    </Screen>
  );
}
