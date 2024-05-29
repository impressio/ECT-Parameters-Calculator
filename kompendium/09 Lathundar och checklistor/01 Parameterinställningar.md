---
title: "Parameterinställningar"
tags:
  - lathund
  - mecta
  - ordination
  - snabbguide
created: 2026-10-15
modified: 2026-10-17
aliases:
  - "Lathund MECTA 5000Q ordination"
  - "Lathund MECTA"
  - "Snabbguide MECTA"
  - "Rattinställningar MECTA"
---

# Parameterinställningar

Den här sidan är till för att du snabbt ska kunna dubbelkontrollera ordinationen direkt vid behandlingsbordet. Huvudapparaten är **MECTA spECTrum 5000Q, 200 J**. Dess maximala laddning är 1152 mC; tabellen nedan stannar vid 576 mC och är inte en komplett doseringstabell för 200 J-systemet. Om reservapparaten på 100 J används är 576 mC dess kapacitetsgräns. Se [[01 Översikt|Översikt]].

---

## Kortpuls: 1,0 ms och 800 mA

Vrid in följande värden på de fyra rattarna under LCD-skärmen:

| Steg | Pulsbredd (PW) | Frekvens (F) | Duration (D) | Ström (I) | Laddning (Q) | Kommentar |
| :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **1** | **1,0 ms** | **40 Hz** | **0,5 s** | **800 mA** | **32 mC** | Räkneexempel; använd ordinerat protokoll |
| **2** | **1,0 ms** | **40 Hz** | **0,75 s** | **800 mA** | **48 mC** | Räkneexempel; använd ordinerat protokoll |
| **3** | **1,0 ms** | **40 Hz** | **1,25 s** | **800 mA** | **80 mC** | Räkneexempel; använd ordinerat protokoll |
| **4** | **1,0 ms** | **40 Hz** | **2,0 s** | **800 mA** | **128 mC** | Titreringssteg, måttlig dos |
| **5** | **1,0 ms** | **60 Hz** | **2,0 s** | **800 mA** | **192 mC** | Räkneexempel; använd ordinerat protokoll |
| **6** | **1,0 ms** | **60 Hz** | **3,0 s** | **800 mA** | **288 mC** | Räkneexempel; använd ordinerat protokoll |
| **7** | **1,0 ms** | **60 Hz** | **4,5 s** | **800 mA** | **432 mC** | Räkneexempel; använd ordinerat protokoll |
| **8** | **1,0 ms** | **60 Hz** | **6,0 s** | **800 mA** | **576 mC** | Räkneexempel; maximum för reservapparaten på 100 J, inte för huvudapparaten på 200 J |

---

## Ordinationsregler vid bordet

1. Använd dokumenterad läkarordination och lokalt validerat titreringsprotokoll. Tabellen ovan är ett räkneexempel, inte ett självständigt ordinationsunderlag.
2. Bekräfta apparatrevision, valt parameterprogram och faktiskt tillåtna rattsteg. Kontrollera laddningen på skärmen.
3. Beräkna multipel i **mC**, inte genom att automatiskt hoppa ett visst antal nivåer. 48 → 192 mC = 4×; 48 → 288 mC = 6×. Se [[04 Titreringstabeller|Titreringstabeller]].
4. Kort motorisk duration kräver helhetsbedömning och innebär inte automatisk doshöjning eller restimulering. Se [[04 Bedömning av anfallskvalitet|Bedömning av anfallskvalitet]] och [[05 Missat, kort eller förlängt anfall|Missat, kort eller förlängt anfall]].

---

## Kontroll före stimulering

1. **LCD-skärmen:** Visar den avsedd laddning i mC?
2. **Statisk impedans:** Inom apparatens godkända intervall, med stabil kontakt och utan misstänkt gelbrygga? Kontrollera `STIMULUS STATUS` enligt manualen.
3. **Manschetten på fotleden:** Uppblåst till > 200 mmHg *innan* suxameton gavs?
4. **Fascikulationer:** Helt upphörda i fötterna (*pedes*, *digiti pedis*)?
5. **Bettskydd:** På plats över tänderna, med läppar och tunga fria?
6. **Klartecken från anestesin:** *"Varsågod att stimulera!"*
7. **Stimulering:** Tryck in och **HÅLL KVAR** den röda knappen tills tonen tystnar!

---

## Referenser

1. American Psychiatric Association. *The Practice of Electroconvulsive Therapy*. 3 uppl.; copyright 2025. Kap. 14.2 och 14.7.4 om parameterkombinationer och dosändring. Bakgrund till ordinationsregler; lokala rattsteg kommer från apparat- och tabellunderlagen.
2. Mankad MV, Beyer JL, Weiner RD, Krystal AD. *Clinical Manual of Electroconvulsive Therapy*. Arlington, VA: American Psychiatric Publishing; 2010. Kap. 4-5, s. 47-78. Underlag för laddningsberäkning och dosering; inte en validering av ett lokalt parameterprogram.
3. [MECTA. Optimized spECTrum Instruction Manual. INT, 200 J; artikelnummer 9900-1012-16](https://mectaspectrum.com/clinician/clinical-ect-materials/).
4. Äldre referens för reservapparat och funktionsbeskrivningar: [MECTA Corporation. spECTrum Instruction Manual. 100 Joules; s. 16-22](https://mectaspectrum.com/clinician/clinical-ect-materials/); [[04 Titreringstabeller|Titreringstabeller]].

---

## Relaterade länkar
- Djupgående titreringstabeller: [[04 Titreringstabeller|Titreringstabeller]]
- Felsökning och larm: [[05 Larm och felsökning|Larm och felsökning]]
- Akutlathund vid bordet: [[02 Akuta situationer|Akuta situationer]]
- Läkemedelsjustering: [[05 Läkemedel och interaktioner|Läkemedel och interaktioner]]
