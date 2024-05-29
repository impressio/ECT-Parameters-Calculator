---
title: "Larm och felsökning"
tags:
  - apparatur
  - felsökning
  - larm
  - säkerhet
aliases:
  - "Larm Felmeddelanden och Felsökning"
  - "Felmeddelanden MECTA"
  - "Felsökning MECTA"
  - "Premature release"
  - "Voltage error"
---

# Larm och felsökning

När ett fel inträffar blockerar MECTA spECTrum 5000Q stimuleringen av patientsäkerhetsskäl. Skärmen fryser då och visar en textruta med felmeddelandet. Stimuleringslampan slocknar.

För att återgå till behandlingsläge måste du åtgärda orsaken och därefter trycka på knappen **`CLEAR`** (eller i vissa fall `DONE`) på pekskärmen.

---

## Vanliga felmeddelanden

### 1. Stimuleringsknappen släpps för tidigt

> [!FAILURE] Felmeddelande på LCD-skärmen
>
> **TREATMENT TERMINATED**
>
> STIMULUS CONTROL PUSH BUTTON RELEASED PREMATURELY
>
> *PRESS CLEAR TO PROCEED*
>
> **[ CLEAR ]**

- **Vad hände?**
  Behandlaren tryckte på den röda `STIMULUS CONTROL`-knappen, men släppte upp den *innan* maskinen hunnit leverera hela det inställda pulståget.
- **Konsekvens:**
  Stimuleringen bröts i förtid. Patienten har bara fått en bråkdel av den avsedda laddningen. Termoskrivaren skriver ut exakt hur många millisekunder/mC som hann levereras.
- **Klinisk handläggning:** Kontrollera patient, EEG och faktiskt levererad laddning. Ny stimulering kräver förnyat klartecken från anestesin och bedömning enligt [[05 Missat, kort eller förlängt anfall|Missat, kort eller förlängt anfall]]. Ett kort anfall eller avbruten stimulering medför inte automatiskt att full dos ska ges igen.

---

### 2. Impedans utanför 100-5000 Ω

> [!FAILURE] Felmeddelande på LCD-skärmen
>
> **PATIENT IMPEDANCE IS INCORRECT**
>
> MUST BE IN THE RANGE OF 100 TO 5000 OHMS
>
> *PRESS CLEAR TO PROCEED*
>
> **[ CLEAR ]**

- **Vad hände?**
  Någon försökte trycka på stimuleringsknappen medan den statiska impedansen låg utanför det tillåtna säkerhetsfönstret (< 100 Ω eller > 5000 Ω).
- **Felsökningssteg:**
    - **Om skärmen visade "OVER":** För dålig hudkontakt. Fukta kompressen på nytt i saltlösningen eller applicera mer gel, sära på hår, torka bort fett och tryck hårdare med handelektroderna.
    - **Om skärmen visade "UNDER":** Salt- eller gelbrygga! Torka rent mellan elektroderna.
    - Tryck `CLEAR` först när orsaken åtgärdats och impedans/kontakt bedömts enligt manualen. Ett värde inom spärrfönstret utesluter inte salt- eller gelbrygga.

---

### 3. Spänningsfel

> [!FAILURE] Felmeddelande på LCD-skärmen
>
> **TREATMENT TERMINATED**
>
> VOLTAGE IS XXX - SHOULD BE 50 TO 400 VOLTS
>
> *PRESS CLEAR TO PROCEED*
>
> **[ CLEAR ]**

- **Vad hände?**
  Under pågående stimulering behövde apparaten driva 800 mA genom vävnaden. Spänningen låg utanför apparatens tillåtna 50-400 V. Vid 800 mA motsvarar 400 V cirka 500 Ω; även onormalt låg spänning kan utlösa felet. Det går inte att identifiera orsaken enbart från ett tröskelvärde på 450 Ω. För att skydda patienten mot vävnadsskada bröts strömmen.
- **Vanligaste orsaken i kliniken:**
  Behandlaren **slappnade av i armarna och lättade på elektrodtrycket** mitt under stimuleringen när patienten ryckte till!
- **Åtgärd:**
  Tryck `CLEAR`. Förbered huden på nytt. Säkerställ att behandlaren har stöd för armarna och håller ett **orubbligt, fast tryck** mot skalpen genom hela pulståget.

---

### 4. Skrivarluckan är öppen

> [!WARNING] Felmeddelande på LCD-skärmen
>
> **CHART RECORDER DOOR IS OPEN**
>
> *PRESS CLEAR TO PROCEED*
>
> **[ CLEAR ]**

- **Vad hände?**
  Pappersluckan till termoskrivaren på höger sida är inte helt stängd eller papperet har hakat upp sig.
- **Åtgärd:** Tryck till luckan tills ett distinkt klick hörs. Tryck därefter `CLEAR`.

---

### 5. Bortkopplad elektrod

- **Vad syns på skärmen?**
  En eller flera kurvor på pekskärmen försvinner och ersätts med en blinkande knapp märkt **`RESTORE`**.
- **Orsak:** En registreringselektrod (EEG i pannan, referenselektroden under nyckelbenet eller EKG på bröstkorgen) har lossnat eller torkat.
- **Åtgärd:** Sätt fast elektroden igen eller sätt på en ny. Tryck på `RESTORE` på skärmen så återkommer kurvan omedelbart.

---

## Felsökningstabell

| Problem vid bordet | Sannolik orsak | Omedelbar åtgärd |
| :--- | :--- | :--- |
| **Maskinen piper inte vid knapptryck** | Stimuleringsknappen är inte aktiverad; självtest ej klart eller felmeddelande ligger i bakgrunden | Titta på skärmen; tryck `CLEAR`. Kontrollera att `STIMULUS STATUS`-lampan visar beredskap enligt manualen. |
| **Papperet matar inte ut** | Papper slut eller lucka öppen | Byt pappersrulle; stäng luckan; kontrollera knappen `RECORDER ON`. |
| **Ingen EEG-kurva på papperet (bara rakt streck)** | Känsligheten (`GAIN 1` / `GAIN 2`) står för lågt eller EEG-avledning lossnat | Vrid upp `GAIN 1` till läget kl. 12-14; kontrollera elektroderna i pannan och bakom öronen. |
| **Statiska impedansen fladdrar upp och ner** | Glappkontakt i kabeln eller handelektrodernas anslutning | Kontrollera kabelinfästningen i `STIMULUS OUTPUT`. Vrid till bajonettfattningen så den sitter i låst läge. |
