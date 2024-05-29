---
title: "Titreringstabeller"
tags:
  - dosering
  - mecta
  - tabeller
  - lathund
aliases:
  - "Titreringstabeller MECTA 5000Q"
  - "MECTA titreringstabell"
  - "Titreringstabell 5000Q"
  - "Laddningssteg MECTA"
---

# Titreringstabeller

Tabell 1 återger dosstegen i **Mankad, Beyer, Weiner och Krystal (2010), tabell 5-3, s. 64**. Tabell 2 bygger på samma boks tabell 5-6, s. 68. Dessa är publicerade historiska protokoll, inte automatiskt ett aktuellt lokalt ordinationsunderlag. Kontrollera apparatversion, parameterprogram och verksamhetens protokoll före klinisk användning.

**Huvudapparaten är ett 200 J-system.** De historiska tabellerna nedan når inte dess maximala laddning 1152 mC. Vid användning av 100 J-reservapparat gäller i stället högst 576 mC och dess egna programgränser. Utöka inte de historiska tabellerna genom att automatiskt dubblera dosstegen. För aktuella parametergränser, se [[03 Parameterinställningar|Parameterinställningar]].

Tabellerna anger de exakta inställningarna för de fyra rattarna (**Pulsbredd**, **Frekvens**, **Duration**, **Ström**) för varje definierat laddningssteg i millicoulomb (mC).

---

## Tabell 1: Kortpuls, 1,0 ms

Denna tabell visar aritmetiska exempel. Strömstyrkan (I) är **800 mA (0,8 A)** i exemplen och pulsbredden (PW) på **1,0 ms**.

| Steg | Pulsbredd (ms) | Frekvens (Hz) | Duration (s) | Ström (mA) | Total laddning (Q, mC) | Kommentar |
| :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| 1 | 1,0 | 40 | 0,50 | 800 | **32 mC** | Räkneexempel; använd ordinerat protokoll |
| 2 | 1,0 | 40 | 0,75 | 800 | **48 mC** | Räkneexempel; använd ordinerat protokoll |
| 3 | 1,0 | 40 | 1,25 | 800 | **80 mC** | Räkneexempel; använd ordinerat protokoll |
| 4 | 1,0 | 40 | 2,00 | 800 | **128 mC** | Restimulering / Mellansteg |
| 5 | 1,0 | 60 | 2,00 | 800 | **192 mC** | Räkneexempel; använd ordinerat protokoll |
| 6 | 1,0 | 60 | 3,00 | 800 | **288 mC** | Behandlingsdos / Hög tröskel |
| 7 | 1,0 | 60 | 4,50 | 800 | **432 mC** | Räkneexempel; använd ordinerat protokoll |
| 8 | 1,0 | 60 | 6,00 | 800 | **576 mC** | Max för 100 J-reservapparat; inte max för 200 J-huvudapparat |

*Formelkontroll:* $Q = 0{,}8 \times 1{,}0 \times 2F \times D$. Exempelvis steg 2: $0{,}8 \times 1{,}0 \times 80 \times 0{,}75 = 48\text{ mC}$.

---

## Tabell 2: Ultrakort puls (*ultrabrief*), används inte hos oss

Källans laddningar är avrundade. Här visas formelvärden med fler decimaler för att skilja beräkning från apparatens faktiska visning. Tillgängliga inställningar måste verifieras på den aktuella enheten. Tabellen är inte ett generellt BT-protokoll.

| Steg | Pulsbredd (ms) | Frekvens (Hz) | Duration (s) | Ström (mA) | Beräknad laddning (mC) |
| :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | 0,3 | 20 | 2,0 | 800 | 19,2 |
| 2 | 0,3 | 30 | 2,0 | 800 | 28,8 |
| 3 | 0,3 | 40 | 2,5 | 800 | 48 |
| 4 | 0,3 | 50 | 3,0 | 800 | 72 |
| 5 | 0,3 | 50 | 4,5 | 800 | 108 |
| 6 | 0,3 | 60 | 6,0 | 800 | 172,8 |
| 7 | 0,3 | 90 | 6,0 | 800 | 259,2 |
| 8 | 0,3 | 100 | 8,0 | 800 | 384 |
| 9 | **0,37** | 120 | 8,0 | 800 | 568,32 |

**Observera pulsbreddsbytet i steg 9.** Det finns i 2010-källan men ska inte antas vara en tillgänglig rattinställning i varje spECTrum-program. Källa, s. 68: [Mankad MV, Beyer JL, Weiner RD, Krystal AD. Clinical Manual of Electroconvulsive Therapy. 2010](https://scholars.duke.edu/publication/1105703).

---

## Användning av dossteg

- Välj startdos och antal försök enligt läkarordination och lokalt validerat protokoll. Kön och ålder kan bidra till bedömningen men fastställer inte individuell tröskel.
- Den lägsta testade dos som utlöser ett generaliserat anfall ger en **uppskattning** av tröskeln, inte ett exakt värde.
- Se [[05 Missat, kort eller förlängt anfall|Missat, kort eller förlängt anfall]] före eventuell restimulering.
- Beräkna behandlingsdosen i mC från ordinerad multipel. Vid RUL används ofta 4-6× tröskeln för kortpuls och omkring 6× för ultrakort puls (används inte hos oss); multipeln beror på pulsbredd och protokoll. Vid BT används lägre multiplar, ofta omkring 1,5-2,5×.
- Antalet tabellsteg är inte samma sak som en bestämd multipel. Från 48 till 192 mC är det **4×**; till 288 mC **6×**. Från 32 till 192 mC är det **6×**.
- Ett steg i tabell 1 kan öka laddningen med 33-67 %. **Två steg kan mer än fördubbla dosen**, inte bara ge 30-50 % ökning.
- Kortare anfallsduration under en serie innebär inte automatiskt behov av doshöjning; värdera EEG, kliniskt svar och kognition.

---

## Referenser

1. American Psychiatric Association. *The Practice of Electroconvulsive Therapy*. 3 uppl.; copyright 2025. Kap. 14.2 om stimulusparametrar och kap. 14.7.1 om empirisk titrering. Underlag för tolkning av tabellsteg; inte källa till lokala startnivåer.
2. Mankad MV, Beyer JL, Weiner RD, Krystal AD. *Clinical Manual of Electroconvulsive Therapy*. Arlington, VA: American Psychiatric Publishing; 2010. Kap. 4-5, s. 47-78. Underlag för laddningsberäkning och titrering; apparatens tillgängliga parameterkombinationer ska kontrolleras mot rätt MECTA-utförande.
3. [MECTA. Optimized spECTrum Instruction Manual. INT, 200 J; artikelnummer 9900-1012-16](https://mectaspectrum.com/clinician/clinical-ect-materials/).
4. Äldre referens för reservapparat och funktionsbeskrivningar: [MECTA Corporation. spECTrum Instruction Manual. 100 Joules; s. 16-22](https://mectaspectrum.com/clinician/clinical-ect-materials/).
5. [NSW Health. ECT Handbook. Version 1.1; 2026 (aktuell nätversion: 1.2)](https://www.health.nsw.gov.au/mentalhealth/resources/Pages/electroconvulsive-therapy-handbook.aspx). Tabell 1 är aritmetiskt kontrollerad; kliniska startnivåer och rattsteg kräver lokal verifiering.

---

## Relaterade länkar
- Teorin bakom tröskeln: [[03 Titrering av kramptröskeln|Titrering av kramptröskeln]]
- De fyra rattarna på MECTA: [[03 Parameterinställningar|Parameterinställningar]]
- Rattinställningar vid bordet: [[01 Parameterinställningar|Parameterinställningar]]
- Anfallskriterier: [[04 Bedömning av anfallskvalitet|Bedömning av anfallskvalitet]]
