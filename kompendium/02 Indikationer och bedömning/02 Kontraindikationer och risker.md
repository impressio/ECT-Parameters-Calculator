---
title: "Kontraindikationer och risker"
tags:
  - säkerhet
  - kontraindikationer
  - kardiologi
  - neurologi
created: 2026-10-15
modified: 2026-10-17
aliases:
  - "Kontraindikationer"
  - "Riskbedömning"
  - "Somatisk risk"
---

# Kontraindikationer och risker

Det finns **inga absoluta kontraindikationer** mot ECT i strikt medicinsk mening - metoden kan genomföras även vid extremt svåra somatiska tillstånd om indikationen är vital (t.ex. letal katatoni eller svår psykotisk depression med dehydrering). Däremot finns det en rad **högrisktillstånd och relativa kontraindikationer** som kräver noggrann preoperativ optimering och samråd med specialistläkare inom anestesi, kardiologi eller neurologi.

---

## Kardiovaskulära risktillstånd

Under ett ECT-anfall sker en tvåfasig autonom reaktion:
1. **Initial parasympatisk fas (vagal stimulering via *n. vagus*):** Varar några sekunder under och direkt efter stimuleringen. Ger bradykardi, asystoliperioder, hypotoni och ökad salivation (*glandulae salivariae*).
2. **Sekundär kraftig sympatisk aktivering (katekolaminpåslag från *medulla glandulae suprarenalis*):** Under anfallets kloniska fas och postiktalt. Ger markant sinustakykardi (ofta 140-180 slag/min), blodtrycksstegring (systoliskt tryck kan stiga med 50-100 mmHg), samt ökad myokardiell (*myocardium*) syreförbrukning (MVO₂).

```mermaid
sequenceDiagram
    participant Maskin as "MECTA 5000Q"
    participant Parasymp as "Vagusnerven (n. vagus)"
    participant Symp as "Binjuremärg och sympatikus"
    participant Hjarte as "Myokard (myocardium) och kärlbädd"

    Maskin->>Parasymp: Elektrisk stimulering
    Parasymp->>Hjarte: Markant bradykardi / kort asystoli, hypotoni
    Note over Hjarte: 0 - 5 sekunder
    Maskin->>Symp: Generaliserat epileptiskt anfall
    Symp->>Hjarte: Massiv katekolaminfrisättning (noradrenalin/adrenalin)
    Hjarte->>Hjarte: Uttalad takykardi, hypertoni (systoliskt > 200 mmHg), ökat MVO2
    Note over Hjarte: 15 - 90 sekunder
```

### Riskbedömning vid hjärtsjukdom
- **Nyligen genomgången hjärtinfarkt (< 3 månader):** Hög risk för reinfarkt eller ventrikelarytmi på grund av den sympatiska tryck- och pulsstegringen.
    - *Åtgärd:* Vid vital indikation kan ECT utföras i samråd med kardiolog, med farmakologisk dämpning av blodtryckstoppen (t.ex. labetalol eller esmolol iv) samt preoperativt ultraljud (eko) för att bedöma EF.
- **Instabil angina pectoris och dekompenserad hjärtsvikt (NYHA III-IV):**
    - *Åtgärd:* Optimera sviktbehandling (diuretika, ACE-hämmare). Narkosläkare förbereder vasodilaterande/blodtryckssänkande läkemedel vid bordet.
- **Aortaaneurysm / Cerebralt aneurysm:** Risk för ruptur vid kraftig blodtryckstopp.
    - *Åtgärd:* Mycket strikt blodtryckskontroll under hela proceduren med beta-1-selektiv blockad (esmolol) eller alfa-/betablockad (labetalol) före och under anfallet.
- **Svår aortastenos (*valva aortae*):** Fixerat minutvolymhinder. Tål varken uttalad takykardi, arytmi eller blodtrycksfall vid anestesiinduktion.
- **Pacemaker och implanterbar defibrillator (ICD):** ECT kan ofta ges med apparatspecifik plan. Bedöm pacemakerberoende, avkänning (*sensing*), behov av omprogrammering och tillfällig avstängning av ICD-behandling. Magnetrespons varierar. Se [[03 Cirkulation och arytmier|Cirkulation och arytmier]].

---

## Neurologiska risker

- **Förhöjt intrakraniellt tryck (ICP):**
    - Cerebralt blodflöde (CBF) och intrakraniellt tryck i skallhålan ökar flerfaldigt under ett anfall. Vid hjärntumör med masseffekt eller obstruktiv hydrocefalus finns risk för herniering (inklämning av hjärnstammen i stora nackhålet eller tentoriets öppning).
    - *Åtgärd:* Neurokirurgisk/neurologisk konsultation. Dexametason, mannitol eller hyperventilering kan övervägas vid tvingande indikation.
- **Nyligen genomgången ischemisk stroke eller intrakraniell blödning (< 1-3 månader):**
    - Risk för hemorragisk transformation eller sekundärblödning vid blodtrycksstegring.
- **Cerebral arteriovenös missbildning (AVM) / Obehandlat aneurysm:** Kräver strikt blodtrycksstyrning.
- **Epilepsi:** Patienter med känd epilepsi kan behandlas med ECT. Observera att antiepileptika kan höja kramptröskeln och kräva dosjustering.

---

## Övriga somatiska risker

| Tillstånd | Patofysiologisk mekanism / Risk | Åtgärd / Riskreducering |
| :--- | :--- | :--- |
| **Feokromocytom** | Massiv katekolaminfrisättning vid anfall kan utlösa dödlig hypertensiv kris | Relativ kontraindikation. Måste alfablockeras fullständigt före ECT. |
| **Näthinneavlossning** (*amotio retinae*) | Intraokulär tryckstegring i *bulbus oculi* under anfallet | Oftalmologisk bedömning. Undvik muskelryckningar genom fullgod relaxation. |
| **Svår osteoporos / Färska frakturer** | Risk för kotkompressioner (*vertebrae*) eller frakturdislokation vid kraftiga muskelkramper | **Absolut krav på fullständig muskelrelaxation** med adekvat dos suxameton. |
| **Pseudokolinesterasbrist** | Defekt nedbrytning av muskelrelaxerande suxameton → långvarig apné | Använd icke-depolariserande relaxantia (t.ex. rokuronium) med specifikt reverseringsmedel (sugammadex). |
| **Gastroesofageal reflux / Hiatusbråck** | Risk för regurgitation från *ventriculus* och kemisk aspirationspneumonit (**Mendelsons syndrom**) under maskventilation | Fortsätt PPI kl. 06.00 (med 1 msk vatten), natriumcitrat peroralt före induktion vid behov, krikoidtryck (*cartilago cricoidea*, Sellicks manöver) eller endotrakeal intubation (*trachea*). |

---

## Referenser

1. American Psychiatric Association. *The Practice of Electroconvulsive Therapy*. 3 uppl.; copyright 2025. Kap. 9.2.1-9.2.11 om somatisk samsjuklighet och kap. 9.3 om implanterade medicinska hjälpmedel. Underlag för kardiovaskulär, neurologisk och övrig somatisk riskbedömning.
2. Ferrier IN, Waite J, red. *The ECT Handbook*. 4 uppl. Cambridge: Cambridge University Press; 2019. Kap. 27, ”Safe ECT Practice in People with a Physical Illness”, s. 247-253; kap. 23, s. 202-210, om anestesi.
3. Mankad MV, Beyer JL, Weiner RD, Krystal AD. *Clinical Manual of Electroconvulsive Therapy*. Arlington, VA: American Psychiatric Publishing; 2010. Kap. 3, ”Patient Referral and Evaluation”, s. 27-46, samt kap. 9, ”Cardiovascular Response”, s. 129-138.

---

## Relaterade länkar
- Särskilda patientgrupper: [[05 Graviditet och äldre|Graviditet och äldre]]
- Somatisk provtagning: [[03 Somatisk bedömning|Somatisk bedömning]]
- Anestesiologiska principer: [[01 Anestesi och teamsamarbete|Anestesi och teamsamarbete]]
- Cirkulatorisk hantering: [[03 Cirkulation och arytmier|Cirkulation och arytmier]]
- Val av elektrodplacering: [[01 Elektrodplacering|Elektrodplacering]]
