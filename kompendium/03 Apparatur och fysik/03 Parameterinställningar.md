---
title: "Parameterinställningar"
tags:
  - apparatur
  - mecta
  - parametrar
  - dosering
aliases:
  - "De fyra parametrarna"
  - "Parameterinställningar MECTA"
  - "MECTA parametrar"
  - "Pulsbredd"
  - "Frekvens"
---

# Parameterinställningar

På **MECTA spECTrum 5000Q** regleras den elektriska dosen med **fyra separata parameterinställningar** som sitter horisontellt placerade direkt under den centrala LCD-skärmen:

```mermaid
flowchart LR
    subgraph Parametrar ["De fyra parametrarna under LCD-skärmen"]
        direction LR
        R1["1. Pulsbredd (ms)<br>0,3 - 1,0 ms"]
        R2["2. Frekvens (Hz)<br>20 - 120 Hz"]
        R3["3. Duration (s)<br>0,5 - 8,0 s"]
        R4["4. Ström (mA)<br>500 - 900 mA i Full Spectrum"]
        
        R1 --- R2 --- R3 --- R4
    end
```

![[MECTA 5000Q parameterinställningar.webp|MECTA 5000Q parameterinställningar]]
*Figur 1: De fyra separata vridreglagen under LCD-skärmen på MECTA spECTrum 5000Q.*

**Kompendiet avser spECTrum 5000Q i 200 J-utförande.** Tabellen anger minimi- och maximivärden i **Full Spectrum Dosing** enligt MECTA:s datablad för det uppdaterade parameterprogrammet.

| Parameter / Märkning | Enhet | Min-max (Full Spectrum, 200 J) | Fysiologisk funktion |
| :--- | :---: | :---: | :--- |
| **PULSE WIDTH** | millisekunder (ms) | 0,3-1,0 ms | Pulsens bredd; påverkar kramptröskel, effekt och kognitiva biverkningar. |
| **FREQUENCY** | hertz (Hz) | 20-120 Hz | Antal tvåfasiga pulspar per sekund. |
| **DURATION** | sekunder (s) | 0,5-8,0 s | Pulstågslängd; används för att ändra laddningen (Q). |
| **CURRENT** | milliampere (mA) | 500-900 mA | Konstant strömamplitud under varje puls, vid det valda strömvärdet. |

**Optimerade program har snävare intervall:** 0,3-programmet medger 0,3-0,75 ms och 20-120 Hz; 0,5-programmet 0,5-0,75 ms och 20-120 Hz; 1,0-programmet 1,0 ms och 20-90 Hz. Samtliga har duration 0,5-8,0 s och fast ström 800 mA.

Gränserna är programberoende och alla maximivärden kan inte kombineras samtidigt. Äldre apparatrevisioner kan ha andra intervall. Kontrollera valt parameterprogram och visad laddning på enheten; 200 J-beteckningen ensam identifierar inte programrevisionen.

**Maxladdning är inte samma sak som max vid fast pulsbredd.** Med 0,3 ms, 800 mA, 120 Hz och 8,0 s blir den beräknade laddningen 460,8 mC. Apparatens totala kapacitet 1152 mC kan alltså inte nås med just den pulsbredden och strömmen. Detta är ett räkneexempel; ändrad pulsbredd kräver omprövad ordination. För 100 J-reservapparat gäller dessutom dess lägre kapacitetsgräns, se [[01 Översikt|Översikt]].

När du ändrar någon av parameterinställningarna uppdateras omedelbart den beräknade laddningen (**mC**) och energin (**J**) i realtid på pekskärmens nedre fält.

---

## Pulsbredd (ms)

Pulsbredden anger hur många millisekunder varje enskild elektrisk puls varar.

### Reobas och kronaxi

Reobas och kronaxi beskriver hur lätt en nervcell eller ett axon retas av en elektrisk puls. Tillsammans förklarar de varför pulsbredden spelar roll, och varför korta pulser kan reta nervceller med mindre laddning än långa.

- **Reobas** ($I_{rh}$): den lägsta strömstyrka som retar nervcellen när pulsen är tillräckligt lång (i teorin oändligt lång). Anges i milliampere.
- **Kronaxi** ($\tau_c$): den pulsbredd som krävs när strömmen är dubbla reobasen. Anges i millisekunder. Den beror på vilka nervstrukturer och vilken mätmetod som studeras och är inte identisk med membranets tidskonstant.

#### Styrka-durationskurvan

Sambandet mellan pulsbredd och tröskelström beskrivs ofta med Lapicques och Weiss ekvation:

$$I_{tr}(t) = I_{rh}\left(1 + \frac{\tau_c}{t}\right)$$

där $I_{tr}$ är tröskelströmmen, $I_{rh}$ reobasen, $\tau_c$ kronaxin och $t$ pulsbredden. När pulsbredden är lika med kronaxin är tröskelströmmen dubbla reobasen. Ju kortare puls, desto högre ström krävs.

Laddningen per puls vid tröskeln blir $Q_{tr}(t) = I_{tr}(t) \cdot t = I_{rh}(t + \tau_c)$. Den minskar alltså ju kortare pulsen är. Energin per puls vid oförändrat motstånd är däremot minst när pulsbredden är lika med kronaxin. Kronaxin är därför en kompromiss mellan strömbehov och laddning, inte en exakt optimal pulsbredd.

#### Kronaxi vid ECT

Ett elektriskt fält utifrån retar främst axon, inte cellkroppar. Peterchev m.fl. anger kronaxin vid transkraniell stimulering till omkring 0,1-0,2 ms, vilket motsvarar axonens kronaxi. Ju längre pulsen är i förhållande till kronaxin, desto mer laddning och energi går åt för att nå tröskeln. Författarna ser inget skäl att gå under omkring 0,2 ms.

| Stimulering | Pulsbredd |
| :--- | :--- |
| Ultrakort puls (*ultrabrief*), används inte hos oss | under 0,5 ms, vanligen 0,25-0,3 ms |
| Kortpuls (*brief pulse*), hos oss | 0,5-1,0 ms |

#### Räkneexempel

Exemplet utgår från en tänkt reobas på 400 mA och en kronaxi på 0,2 ms. Det är inte uppmätta patientvärden, och det gäller en enskild idealiserad puls med konstant ström, inte hela behandlingsdosen.

| Pulsbredd<br>(ms) | Tröskelström<br>(mA) | Gånger reobasen | Laddning per puls vid tröskeln<br>(µC) |
| ---: | ---: | ---: | ---: |
| 0,25 | 720 | 1,8 | 180 |
| 0,3 | 667 | 1,67 | 200 |
| 0,5 | 560 | 1,4 | 280 |
| 1,0 | 480 | 1,2 | 480 |

- Kortare puls kräver högre ström men mindre laddning per puls.
- Längre puls kräver mer laddning för att nå tröskeln.
- Vid en given strömstyrka når en för kort puls inte tröskeln. Med exemplets värden och 800 mA krävs minst 0,2 ms.
- Det går inte att ange att alla nervceller når tröskeln efter 0,2 ms eller att återstoden av en 1 ms-puls är verkningslös.

#### Avståndet från elektroden

Det elektriska fältet avtar med avståndet från elektroderna. En nervcell längre bort får därför ett svagare fält vid samma ström och behöver högre ström vid elektroden för att nå tröskeln. Kurvan förskjuts uppåt: reobasen, räknad som ström vid elektroden, blir högre. I figuren har kurvorna samma kronaxi för enkelhetens skull.

![[Styrka-durationskurva och avstånd.svg|Styrka-durationskurvor på tre avstånd från elektroden]]
*Figur 2: Schematiska styrka-durationskurvor för nervceller på tre avstånd från elektroden, med samma kronaxi. Den streckade linjen visar en given strömstyrka. Ringarna markerar den kortaste pulsbredd som räcker för att nå tröskeln. Värdena är relativa och inte uppmätta.*

- **Nära elektroden** räcker strömstyrkan även för mycket korta pulser.
- **Längre bort** krävs en längre puls innan tröskeln nås.
- **Långt från elektroden** krävs ännu längre puls, och bortom ett visst avstånd räcker strömstyrkan inte alls, oavsett pulsbredd. Det är reobasen som sätter den gränsen.
- En högre strömstyrka flyttar linjen uppåt och ökar därmed den volym hjärnvävnad som stimuleras. En längre puls når också något längre bort, men till priset av mer laddning.

Ranck sammanfattade hur tröskelströmmen ökar med avståndet från en liten elektrod i centrala nervsystemet, och att myeliniserade axon har kronaxier kring 0,05-0,1 ms medan grå substans ofta ger 0,2-0,7 ms. Vid ECT är elektroderna stora och sitter på skalpen, och strömmen sprids genom hud, skallben och likvor, så avståndssambandet är flackare och beror på anatomin. Fältets fördelning i hjärnan modelleras därför med MR-baserade modeller; se [[04 Neurobiologiska mekanismer#E-fält och anatomisk modellering|E-fält och anatomisk modellering]].

#### Kramptröskeln är något annat

Reobas och kronaxi gäller retning av enskilda nervelement med en enskild puls. Kramptröskeln gäller hela pulståget som krävs för att utlösa ett generaliserat anfall i hjärnans nätverk. Strömstyrkan ställs in enligt ordination, och laddningen styrs av pulsbredd, frekvens och duration. Reobas och kronaxi förklarar alltså hur effektiv stimuleringen är, men bestämmer inte den kliniskt lämpliga dosen.

- Kortare pulsbredd kan minska kognitiva biverkningar, särskilt vid RUL, men påverkar också kramptröskel och effekt. Effekten av ultrakort puls kräver tillräcklig övertröskeldos och rätt elektrodplacering, och den kan inte förklaras enbart av kronaxin.
- Ändrad pulsbredd kräver en ny bedömning av dos i förhållande till tröskeln. Samma mC över olika pulsbredder är inte biologiskt likvärdigt.

**Tre frågor att hålla isär:**
- **Reobas:** Hur stark måste strömmen vara?
- **Kronaxi:** Hur lång måste en puls med dubbla den strömmen vara?
- **Kramptröskel:** Vilket pulståg krävs för att utlösa ett generaliserat anfall?

---

### Val av pulsbredd

- **0,3 ms (ultrakort puls, *ultrabrief*):** Kan sänka den laddning som krävs för anfallsutlösning och minska kognitiv påverkan vid RUL jämfört med längre kortpulser. Vissa studier visar samtidigt långsammare eller lägre antidepressiv effekt. Låg kramptröskel innebär inte att en tröskelnära dos räcker för behandlingseffekt. **Ultrakort puls används inte hos oss.** Den är inte ett historiskt protokoll: forskningen om den pågår, se nedan.
- **0,5 ms (kortpuls, *brief pulse*):** Vanlig i de svenska registerstudierna nedan. Användningsfrekvensen fastställer inte att den är optimal för varje patient. Direkta jämförelser mellan 0,3 och 0,5 ms är mindre väl underbyggda än jämförelser mellan ultrakort puls och 1,0-1,5 ms.
- **1,0 ms (kortpuls, *brief pulse*):** En vanlig studerad kortpulsbredd. Den är inte automatiskt effektivare än 0,5 ms och kan inte väljas enbart utifrån patientens kön eller ålder. Dosering, elektrodplacering, kliniskt svar och kognition måste vägas samman.
- **Pågående forskning om ultrakort puls:** En systematisk översikt och metaanalys 2026 av 30 studier fann att högdos RUL med ultrakort puls gav remission hos 32 % och att 28 % bytte till kortpuls på grund av otillräcklig effekt; författarna bedömer att ultrakort puls inte når kortpulsens resultat. En randomiserad studie 2025 jämförde 0,15 och 0,30 ms vid RUL: den kortare pulsen sänkte tröskeln ytterligare utan skillnad i effekt eller kognition. I de nordamerikanska studierna av magnetisk krampterapi (MST) är RUL med ultrakort puls jämförelsebehandling.
- **Pågående forskning om pulsbredd i Sverige:** Den svenska registerstudien [*Optimal elektrisk stimulering vid elektrokonvulsiv terapi (ECT)*](https://ect.rcnorr.se/forskning/optimal-elektrisk-stimulering-vid-elektrokonvulsiv-terapi-ect/) randomiserar patienter med unipolär eller bipolär depression till 0,5 eller 1,0 ms och följer remission, minnesstörning, livskvalitet och återinsjuknande i sex månader. Bakgrunden är registeranalyser som indikerar att omkring 10 % fler patienter kan bli symtomfria med 1,0 ms än med 0,5 ms, med liten skillnad i upplevd minnesstörning några dagar efter behandlingen. 800 patienter inkluderades från november 2019 till augusti 2025; resultaten är ännu inte publicerade.
- **Sinusvåg:** Historisk vågform med större kognitiv påverkan och utan visad terapeutisk fördel framför modern kortpulsstimulering. Den ska inte användas som modell för dagens inställningar.

Begreppen reobas och kronaxi beskriver elektrisk excitation under definierade förhållanden. De ger inte en universell pulsbredd för hela hjärnan eller en beräkning av ”bortkastad” laddning. Se även [[04 Neurobiologiska mekanismer#Anfallsgenerering|Anfallsgenerering]].

---

## Frekvens (Hz)

Frekvensen anger antalet cykler (par av tvåfasiga pulser) som maskinen levererar per sekund.

### Pulsfrekvens och nervcellsrekrytering
- Frekvensen samverkar med pulsbredd, strömstyrka och pulstågslängd. Lägre frekvens och längre pulståg kan vara mer laddningseffektiva för anfallsutlösning än hög frekvens.
- Det finns inget generellt bevisat optimalt fönster på 30-70 Hz för alla patienter. Även frekvenser under 20 Hz används i vissa apparatprogram; de medför inte automatiskt missat anfall.
- Sambanden kan inte härledas enbart ur en enskild nervcells refraktärperiod. Följ det validerade doseringsprogrammet för den aktuella apparaten.
- Vid övriga parametrar oförändrade fördubblar en ökning från 30 till 60 Hz laddningen.

---

## Duration (s)

Durationen anger den totala tid (i sekunder) som apparaten sänder ut det valda pulståget.

### Pulstågslängdens betydelse
- Ett generaliserat anfall kräver rekrytering av neuronala nätverk; nervcellerna bildar inte ett anatomiskt syncytium.
- Durationen kan användas för att ändra laddningen utan att ändra pulsbredd eller ström. En ökning från 2,0 till 3,0 s ger 50 % högre laddning om övriga parametrar är oförändrade.
- Kort pulståg kan räcka vid låg tröskel. Det finns ingen generell 1-sekundsgräns för ett effektivt anfall.
- I det uppdaterade 200 J-systemets Q-program är durationen 0,5-8,0 s. Möjliga kombinationer begränsas också av programmets laddnings- och energigränser.

---

## Strömstyrka (mA)

Strömstyrkan reglerar den elektriska strömmens momentana toppamplitud under varje enskild puls.

### Ström och fältstyrka
- **Konstant ström** betyder att apparaten reglerar den valda pulsströmmen inom sina säkerhetsgränser. I Full Spectrum är den valbara strömmen 500-900 mA; i de optimerade programmen är den fixerad vid 800 mA.
- Ohms lag ger exempelvis $U = 0{,}8 \times 220 = 176$ V vid 800 mA och 220 Ω dynamisk impedans.
- Största delen av strömmen leds genom hud och skalp; enligt Swartz når omkring 1 % hjärnan, eftersom skallbenets impedans är ungefär 100 gånger högre än hudens. Andelen och det elektriska fältet i hjärnan varierar med skallbenets tjocklek, huvudets anatomi och elektrodplaceringen; se [[04 Statisk och dynamisk impedans|Statisk och dynamisk impedans]].
- 800 mA är ett vanligt protokollvärde, inte en global fysiologisk minimigräns. Andra strömnivåer har studerats, men ska inte införas genom fri omräkning av mC.
- Ändra strömstyrkan endast enligt läkarordination och ett apparatspecifikt protokoll.

### Strömstyrka, ålder, kön och anatomi
- **Strömstyrkan ordineras:** Den är inte fast, utan ställs in enligt ordination inom apparatens intervall (500-900 mA i Full Spectrum). Dosen anpassas i första hand med laddningen (pulsbredd, frekvens och duration) efter titrering eller dostabell. Varken APA, *The ECT Handbook*, Mankad m.fl. eller SPF:s riktlinjer anger att strömstyrkan ska väljas efter ålder, kön eller kroppsvikt.
- **Ålder och kön påverkar kramptröskeln:** Tröskeln stiger med åldern och är ofta högre hos män. Det hanteras med laddningen, inte med strömstyrkan.
- **Impedansen förklarar inte könsskillnaden:** Impedansen är högre hos kvinnor än hos män och högre vid unilateral placering, trots att kvinnor har lägre tröskel. SPF anger att impedansen ökar med åldern; det stöds inte av de övriga källorna.
- **Anatomin avgör hur mycket som når hjärnan:** Andelen ström som når hjärnan beror på skallbenets tjocklek, huvudets storlek och hjärnvolymen, inte på kroppsvikten. Vid samma strömstyrka varierar därför det elektriska fältet i hjärnan mellan patienter.
- **Lägre strömstyrka har en avvägning:** I en randomiserad studie med RUL och 600, 700 eller 800 mA gav 700 och 800 mA bättre antidepressiv effekt än 600 mA, medan verbalt flöde försämrades vid 800 mA; det primära minnesmåttet skilde sig inte. Individuellt anpassad strömstyrka studeras men är ännu inte klinisk rutin.


Hur laddningen ändras vid behandlingsbordet beskrivs i [[07 Dosjustering#Ändra dosen|Dosjustering]].

---

## Parametrar i svenska studier

### Brus m.fl. 2017: remission

[*Self-assessed remission rates after electroconvulsive therapy of depressive disorders*](https://pubmed.ncbi.nlm.nih.gov/28865389/), med Nordanskog och Nordenskjöld som medförfattare, omfattar 1671 patienter behandlade i Sverige 2011-2014. Tabellerna visar samtliga parametergrupper i artikelns tabell 1 och hur vanliga de var.

#### Pulsbredd

| Grupp eller inställning<br>(ms) | Antal patienter | Andel<br>(%) |
| :--- | ---: | ---: |
| 0,25-0,47 | 317 | 19,0 |
| 0,50 | 1143 | 68,4 |
| 0,51-1,00 | 211 | 12,6 |

#### Frekvens

| Grupp eller inställning<br>(Hz) | Antal patienter | Andel<br>(%) |
| :--- | ---: | ---: |
| 10-50 | 667 | 39,9 |
| 55-70 | 545 | 32,6 |
| 75-120 | 459 | 27,5 |

#### Duration

| Grupp eller inställning<br>(s) | Antal patienter | Andel<br>(%) |
| :--- | ---: | ---: |
| 0,8-6,8 | 568 | 34,0 |
| 6,9-7,9 | 455 | 27,2 |
| 8,0 | 648 | 38,8 |

#### Strömstyrka

| Grupp eller inställning<br>(mA) | Antal patienter | Andel<br>(%) |
| :--- | ---: | ---: |
| 528-800 | 928 | 55,5 |
| 850-890 | 213 | 12,7 |
| 900-930 | 530 | 31,7 |

#### Laddning

| Grupp eller inställning<br>(mC) | Antal patienter | Andel<br>(%) |
| :--- | ---: | ---: |
| 75-288 | 579 | 34,6 |
| 291-399 | 561 | 33,6 |
| 400-1152 | 531 | 31,8 |

Pulsbredden 0,50 ms är en separat inställning, använd hos 68,4 %. För andra grupper går det inte att avgöra vilket enskilt värde inom gruppen som var vanligast. Hz avser stimuleringens frekvens.

### Brus m.fl. 2017: subjektivt minne

[*Subjective Memory Immediately Following Electroconvulsive Therapy*](https://pubmed.ncbi.nlm.nih.gov/27930429/), med samma båda medförfattare, omfattar 1212 patienter från 41 svenska sjukhus 2011-2014. Artikelns tabell 3 avser de 1110 unilateralt behandlade patienterna och första behandlingens inställningar.

#### Pulsbredd

| Grupp eller inställning<br>(ms) | Antal patienter | Andel<br>(%) |
| :--- | ---: | ---: |
| 0,25-0,47 | 234 | 21,1 |
| 0,50-1,00 | 876 | 78,9 |

#### Frekvens

| Grupp eller inställning<br>(Hz) | Antal patienter | Andel<br>(%) |
| :--- | ---: | ---: |
| 20-65 | 619 | 55,8 |
| 70-120 | 491 | 44,2 |

#### Duration

| Grupp eller inställning<br>(s) | Antal patienter | Andel<br>(%) |
| :--- | ---: | ---: |
| 2,0-7,4 | 520 | 46,8 |
| 7,5-8,0 | 590 | 53,2 |

#### Strömstyrka

| Grupp eller inställning<br>(mA) | Antal patienter | Andel<br>(%) |
| :--- | ---: | ---: |
| 600-800 | 579 | 52,2 |
| 850-930 | 531 | 47,8 |

Antalen i tabellerna för båda studierna är summerade över artikelns utfallsgrupper; andelarna är beräknade från dessa antal. Varje parameter har samma nämnare inom sin studie. Samma patienter återkommer på flera rader, så antalen ska inte summeras över olika parametrar. Gruppernas gränser och bredd skiljer sig mellan studierna.

### Ålder och kön

Ålder och kön redovisas i studierna. Remissionsmaterialet omfattar 1021 kvinnor och 650 män, med åldersgrupper från 18-30 till 81-95 år. Minnesstudiens unilaterala undergrupp omfattar 663 kvinnor och 447 män, indelade i 18-39, 40-64 och minst 65 år. De aktuella parametertabellerna redovisar däremot inte parameterfördelningen korsad med ålder och kön. De kan därför inte ge en dostabell för exempelvis kvinnor 40-50 år.

### Ytterligare svenskt material

[Sigström m.fl. 2020, tabell 1](https://pubmed.ncbi.nlm.nih.gov/32148217/), med Nordenskjöld som medförfattare, omfattar 277 patienter vid åtta svenska sjukhus. Pulsbredd registrerades hos 272 patienter:

#### Pulsbredd

| Grupp eller inställning<br>(ms) | Antal patienter | Andel<br>(%) |
| :--- | ---: | ---: |
| 0,25-0,47 | 54 | 19,9 |
| 0,50-1,00 | 218 | 80,1 |

Pulsbredd saknades för fem patienter. Tabellen anger inte motsvarande grupper för frekvens, duration och strömstyrka.

### Tolkning för den lokala verksamheten

Studierna beskriver klinisk praxis med både MECTA och Thymatron. Parametergrupperna är inte en ordination för ert 200 J-system och ska inte kombineras till en ”typordination”. Registermaterialen kan överlappa.

Er ålders- och könsbaserade dostabell beskrivs separat i [[02 Lokal dostabell - ålder och kön|Lokal dostabell]], med hänvisning till rutinen och [kalkylatorns dostabell](https://ect.matty.se/?lang=sv). Den anger laddning i mC, inte en unik kombination av de fyra parametrarna.
