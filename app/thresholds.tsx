import { NumberRow } from '@/components/NumberRow';
import { CONFIG_LIMITS } from '@/lib/config';
import { useSettings } from '@/store/settings';
import { Label, Note, Panel, Screen, TitleBar } from '@/ui/kit';

/**
 * Progi decydujące o werdykcie nocy. Osobny ekran, bo jest ich kilkanaście —
 * w Więcej przykryłyby wszystko inne, a zagląda się tu rzadko: przy strojeniu
 * po kilku tygodniach porównywania werdyktów z rzeczywistością.
 */
export default function ThresholdsScreen() {
  const { config, updateConfig } = useSettings();
  const { conditions, calendar, refresh } = config;
  const limits = CONFIG_LIMITS;

  return (
    <Screen>
      <TitleBar
        back
        title="Progi warunków"
        subtitle="zmiana przelicza werdykt od razu, bez sieci"
      />

      <Label>Zachmurzenie</Label>
      <Panel>
        <NumberRow
          label="Całkowite, maks."
          unit="%"
          value={conditions.maxCloudTotal}
          limits={limits.conditions.maxCloudTotal}
          onCommit={(maxCloudTotal) => updateConfig('conditions', { maxCloudTotal })}
        />
        <NumberRow
          label="Niskie, maks."
          unit="%"
          value={conditions.maxCloudLow}
          limits={limits.conditions.maxCloudLow}
          onCommit={(maxCloudLow) => updateConfig('conditions', { maxCloudLow })}
        />
        <NumberRow
          label="Wysokie, maks."
          unit="%"
          value={conditions.maxCloudHigh}
          limits={limits.conditions.maxCloudHigh}
          onCommit={(maxCloudHigh) => updateConfig('conditions', { maxCloudHigh })}
        />
      </Panel>
      <Note>
        Chmury wysokie są tolerowane wyżej niż niskie — nie zasłaniają nieba całkiem, ale zabierają
        kontrast.
      </Note>

      <Label>Noc</Label>
      <Panel>
        <NumberRow
          label="Porywy wiatru, maks."
          unit="km/h"
          value={conditions.maxWindGustKmh}
          limits={limits.conditions.maxWindGustKmh}
          onCommit={(maxWindGustKmh) => updateConfig('conditions', { maxWindGustKmh })}
        />
        <NumberRow
          label="Porywy wiatru, z ręki"
          unit="km/h"
          value={conditions.maxWindGustHandheldKmh}
          limits={limits.conditions.maxWindGustHandheldKmh}
          onCommit={(maxWindGustHandheldKmh) =>
            updateConfig('conditions', { maxWindGustHandheldKmh })
          }
        />
        <NumberRow
          label="Faza Księżyca, maks."
          unit="%"
          value={conditions.maxMoonIllumination}
          limits={limits.conditions.maxMoonIllumination}
          onCommit={(maxMoonIllumination) => updateConfig('conditions', { maxMoonIllumination })}
        />
        <NumberRow
          label="Zapas nad punktem rosy"
          unit="K"
          value={conditions.dewWarningSpreadC}
          limits={limits.conditions.dewWarningSpreadC}
          onCommit={(dewWarningSpreadC) => updateConfig('conditions', { dewWarningSpreadC })}
        />
        <NumberRow
          label="Noc wyjątkowa od oceny"
          unit="/100"
          value={conditions.exceptionalRating}
          limits={limits.conditions.exceptionalRating}
          onCommit={(exceptionalRating) => updateConfig('conditions', { exceptionalRating })}
        />
      </Panel>
      <Note>
        Przy większej fazie Księżyca okno liczy się tylko dla celów księżycowych i planetarnych.
        Poniżej zapasu nad punktem rosy werdykt ostrzega, że szkło zaparuje. Niższy próg wiatru
        dotyczy zestawów trzymanych z ręki — noc oceniana jest łagodniejszym z progów, a o gorszym
        mówi ostrzeżenie.
      </Note>
      <Note>
        Sesja jest skracana wstecz od godziny wymuszonej snem, a nie odrzucana. Powyżej oceny
        wyjątkowej i przy zjawisku, które się nie powtórzy, skracanie nie działa: taką noc zobaczysz
        w całości, razem z tym, ile snu kosztuje.
      </Note>

      <Label>Wybór miejsca</Label>
      <Panel>
        <NumberRow
          label="Kara za godzinę dojazdu"
          unit="pkt"
          value={conditions.travelPenaltyPerHour}
          limits={limits.conditions.travelPenaltyPerHour}
          onCommit={(travelPenaltyPerHour) => updateConfig('conditions', { travelPenaltyPerHour })}
        />
      </Panel>
      <Note>
        Ranking w Gdzie odejmuje tyle punktów oceny za każdą godzinę drogi: 10 znaczy „pojadę
        godzinę dłużej, jeśli noc jest o 10 punktów lepsza”. Zero zostawia sam ranking jakości
        nieba.
      </Note>

      <Label>Kalendarz następnego dnia</Label>
      <Panel>
        <NumberRow
          label="Tylko blisko domu przed"
          unit=":00"
          value={calendar.homeOnlyBeforeHour}
          limits={limits.calendar.homeOnlyBeforeHour}
          onCommit={(homeOnlyBeforeHour) => updateConfig('calendar', { homeOnlyBeforeHour })}
        />
        <NumberRow
          label="Zakładana pierwsza godzina"
          unit=":00"
          value={calendar.assumedFirstEventHour}
          limits={limits.calendar.assumedFirstEventHour}
          onCommit={(assumedFirstEventHour) => updateConfig('calendar', { assumedFirstEventHour })}
        />
      </Panel>
      <Note>
        Wczesny poranek nie odrzuca nocy — sesja zostaje skrócona tak, żeby zmieścił się sen, a
        „odpuść” pada dopiero, gdy nie mieści się w minimum. Zakładana godzina obowiązuje tam, gdzie
        nie udało się odczytać kalendarza.
      </Note>

      <Label>Odświeżanie danych</Label>
      <Panel>
        <NumberRow
          label="Pobieraj o godzinie"
          unit=":00"
          value={refresh.hourOfDay}
          limits={limits.refresh.hourOfDay}
          onCommit={(hourOfDay) => updateConfig('refresh', { hourOfDay })}
        />
      </Panel>
      <Note>
        Prognoza pobiera się raz na dobę, o porze decyzji o wyjeździe; ekrany czytają z zapisu i
        otwierają się bez sieci. Efemerydy, cele i werdykty liczą się na telefonie, więc zmiana
        progu działa natychmiast.
      </Note>
    </Screen>
  );
}
