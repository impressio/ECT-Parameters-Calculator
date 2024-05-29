---
title: "Parameterinställningar"
tags:
  - lathund
  - mecta
  - ordination
  - snabbguide
aliases:
  - "Lathund MECTA 5000Q ordination"
  - "Lathund MECTA"
  - "Snabbguide MECTA"
  - "Parameterinställningar vid bordet"
---

# Parameterinställningar

Den här sidan är till för att du snabbt ska kunna dubbelkontrollera ordinationen direkt vid behandlingsbordet. Huvudapparaten är **MECTA spECTrum 5000Q, 200 J**. Dess maximala laddning är 1152 mC; tabellen nedan stannar vid 576 mC och är inte en komplett doseringstabell för 200 J-systemet. Om reservapparaten på 100 J används är 576 mC dess kapacitetsgräns. Se [[01 Översikt|Översikt]].

---

## Kortpuls: 1,0 ms och 800 mA

Ställ in följande värden för de fyra parametrarna under LCD-skärmen:

| Steg | Pulsbredd (PW)<br>(ms) | Frekvens (F)<br>(Hz) | Duration (D)<br>(s) | Ström (I)<br>(mA) | Laddning (Q)<br>(mC) | Kommentar |
| :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **1** | **1,0** | **40** | **0,5** | **800** | **32** | Räkneexempel; använd ordinerat protokoll |
| **2** | **1,0** | **40** | **0,75** | **800** | **48** | Räkneexempel; använd ordinerat protokoll |
| **3** | **1,0** | **40** | **1,25** | **800** | **80** | Räkneexempel; använd ordinerat protokoll |
| **4** | **1,0** | **40** | **2,0** | **800** | **128** | Titreringssteg, måttlig dos |
| **5** | **1,0** | **60** | **2,0** | **800** | **192** | Räkneexempel; använd ordinerat protokoll |
| **6** | **1,0** | **60** | **3,0** | **800** | **288** | Räkneexempel; använd ordinerat protokoll |
| **7** | **1,0** | **60** | **4,5** | **800** | **432** | Räkneexempel; använd ordinerat protokoll |
| **8** | **1,0** | **60** | **6,0** | **800** | **576** | Räkneexempel; maximum för reservapparaten på 100 J, inte för huvudapparaten på 200 J |

---

## Ordinationsregler vid bordet

1. Använd dokumenterad läkarordination och lokalt validerat titreringsprotokoll. Tabellen ovan är ett räkneexempel, inte ett självständigt ordinationsunderlag.
2. Bekräfta apparatrevision, valt parameterprogram och faktiskt tillåtna inställningssteg. Kontrollera laddningen på skärmen.
3. Beräkna multipel i **mC**, inte genom att automatiskt hoppa ett visst antal nivåer. 48 → 192 mC = 4×; 48 → 288 mC = 6×.
4. Kort motorisk duration kräver helhetsbedömning och innebär inte automatisk doshöjning eller restimulering. Se [[04 Bedömning av anfallskvalitet|Bedömning av anfallskvalitet]] och [[05 Missat, kort eller förlängt anfall|Missat, kort eller förlängt anfall]].

---

## Kontroll före stimulering

1. **LCD-skärmen:** Visar den avsedd laddning i mC?
2. **Blodtryck:** Uppmätt före behandlingen?
3. **Fascikulationer:** Helt upphörda i fötterna?
4. **Bitblock:** På plats över tänderna, med läppar och tunga fria?
5. **Klartecken från anestesin:** *"Varsågod att stimulera!"*
6. **Elektroder och statisk impedans, efter klartecknet:** Inom apparatens godkända intervall, med stabil kontakt och utan misstänkt salt- eller gelbrygga? Kontrollera `STIMULUS STATUS` enligt manualen.
7. **Stimulering:** Tryck in och **HÅLL KVAR** den röda knappen tills tonen tystnar!
