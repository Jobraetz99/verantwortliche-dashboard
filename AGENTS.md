# Kontext für eine KI: Dashboards der BM Group weiterentwickeln

Stand: 29.10.2026.

---

## 1. Worum es geht

Die BM Group betreibt Physiotherapie-Praxen an zwei Standorten:

| Region | Praxis | Praxissoftware | Kürzel im Code |
|---|---|---|---|
| **Werneck** | KIMOJO Physio + KIMOJO Ergo | thevea | `_wp` = Physio, `_we` = Ergo, „KIMOJO" |
| **Kitzingen** | Physio und Fitness im Park (PHFIP) | Medifox (Kalender „F4") | „PHFIP", „PF im Park" |

Dazu kommt ein **Club** (Gesundheitstraining, Präventionskurse), der im CRM **MyWellness** (Technogym) geführt wird.

Das **Verantwortlichen-Dashboard** (OKR-Dashboard) ist für die Leitungen gedacht: Ziele (OKRs), Qualitätskontrollen, Auslastung, Bewertungen und Club-Kennzahlen auf einer Seite.

---

## 2. Technik: so ist das Dashboard gebaut

- **Eine einzige HTML-Datei** (rund 180 KB): HTML, CSS und JavaScript zusammen, ohne Build-Schritt und ohne Framework. So soll es bleiben.
- **Anmeldung:** Microsoft-Login über MSAL (`msal-browser`). Die App-Registrierung (Client-ID) und der Tenant stehen oben im Script (`MC`). Die konkreten Werte gehören nicht in Chats, Commits oder in diese Datei.
- **Daten:** Erst nach dem Login liest das Dashboard Daten aus **SharePoint über Microsoft Graph**. Wer keine Rechte auf die SharePoint-Seite hat, sieht ein leeres Dashboard.
- **SharePoint-Seiten** (`SI` im Code):
  - `k` = `/sites/KIMOJOManagement`: Hauptablage, Werneck und die JSON-Exporte
  - `p` = `/sites/PfFiP-TeamPortal`: Kitzingen
  - `pm` = `/sites/KIMOJOPraxismanagement`: NPS-Umfrage
- **Excel-Dateien** werden über die Datei-ID gelesen (`FI` im Code), Blatt für Blatt über `usedRange`. Beispiele:
  - `FI.kpi`: Weekly KPI Tracker 2026 Werneck
  - `FI.kpiP`: PHFIP Weekly KPI Tracker 2026
  - dazu Bewertungen (`FI.fb`), BWA (`FI.bwaK`, `FI.bwaP`), Krankenstand (`FI.ks`), Medifox-Exporte (`FI.m1`–`FI.m4`), NPS (`FI.nps`)
- **JSON-Exporte** aus Power-Automate-Flows liegen in SharePoint und werden mit `jGet(pfad)` geladen. `jGet` ist lokal in `loadAll` und liest nur das Laufwerk der Site `k`:
  - `12_Code/Patientenchecker/Dateien Export/`: thevea-Termine `terminplan_<tag>_wp.json` und `terminplan_<tag>_we.json` (`<tag>` = `heute`, `morgen`, `t2` … `t13`), Termin-Historie `termine_historie_wp.json` und `termine_historie_we.json`, Verordnungsübersicht `Verordnungsuebersicht.json` (Physio) und `vo_uebersicht_we.json` (Ergo), Kennzahlen `kennzahlen/kennzahlen-<yyyy-MM>.json` und `kennzahlen-<yyyy-MM>-sicherung.json` (mitgeschrieben erst ab Oktober 2026)
  - `12_Code/Controlling/terminplan_woche_f4.json`: Medifox-Wochenkalender
  - `12_Code/Controlling/MyWellness/`: CRM-Daten (siehe Abschnitt 4)
- **Kitzingen, Rezeptende:** erst wenn diese Ansicht geöffnet wird, liest eine zweite lokale `jGet`-Funktion `12_Code/Controlling/behandlungen_alle.json` und `12_Code/Controlling/patientenliste.json`.
- **Eigene Speicherdaten:** QM-Kontrollen in `qm-kontrollen.json` (Wurzel des Laufwerks von `k`). Ausgeblendete Patienten der Rezeptende-Liste in `12_Code/Controlling/MyWellness/ausgeblendet.json`. Schlüssel ist Standort plus Fall (`reAusblKey`): Patienten-Id und Rezept-Id, und nur wenn diese Ids fehlen, der normalisierte Name. Geschrieben wird per Graph `PUT`. Vor dem Schreiben wird die Datei neu gelesen und zusammengeführt (`qmSave`, `reAusblSchreiben`), damit zwei Personen sich nicht überschreiben. Einen ETag- oder `If-Match`-Schutz gibt es nicht. Das Feld `etagWarned` wird nicht verwendet.

---

## 3. Die Reiter

| Reiter | Inhalt |
|---|---|
| 🎯 **Therapie** | OKRs Therapie und das **QM-Modul** (siehe unten) |
| 🏥 **Praxismanagement** | OKRs: Patientenzufriedenheit, offene Rezepte, NPS, Auslastung |
| 🏋️ **Club** | Club und Prävention je Standort, Daten aus MyWellness (siehe Abschnitt 4). Die Überschrift im Inhalt lautet „Club · Therapiemanager". |
| 🏢 **Verwaltung** | OKRs Verwaltung |
| 📊 **Auslastung** | Auslastung je Kalenderwoche und Standort |
| 💬 **Bewertungen** | Letzte Patientenbewertungen |
| 💶 **€/Stunde** | Umsatz je Therapeut:in und Stunde |

Oben gibt es den Regionsschalter **Allgemein / Kitzingen / Werneck** (`REG`) und einen Standortfilter (`aF`: Alle, KIMOJO Physio, KIMOJO Ergo, PHFIP). `PHFIP` im Filter ist im Datenbestand `PF im Park`. `setReg` setzt `aF` zurück auf Alle. Club, QM und €/Stunde werten `REG` und `aF` aus. Die Auslastung achtet auf `aF`, nicht auf `REG`. Die Bewertungen filtern nach keinem von beiden. Jede **neue** Ansicht muss beide beachten.

### QM-Modul (Reiter Therapie)

- **Aufgabe:** Die fachlichen Leitungen kontrollieren pro Woche je **5 Befunde und 5 Dokus** (`QM_ZIEL=5`). Das 5+5-Ziel gilt je angemeldeter Leitung, nicht für das Team zusammen.
- **Befund-Kandidaten:** Ersttermine einer Verordnung in der Woche.
- **Doku-Kandidaten:** ein Vorschlag je Therapeut:in (deterministisch aus den Terminen der Woche). Die Therapeut:innen, die am längsten nicht kontrolliert wurden, stehen oben. Über „N Termine ▾" lassen sich auch alle anderen Termine der Woche wählen, sobald es mehr als einen gibt.
- **Zwei Leitungen** stehen in `QM_LEITUNG` (erkannt an der Login-E-Mail, ohne Regionsfeld). Jede hat ihr eigenes Wochenziel 5+5. Welche Therapeut:in zu welcher Leitung gehört, wird **im Dashboard gepflegt** (⚙️ Zuteilung) und nicht im Code. Die Adressen gehören nicht in diese Datei und nicht in Chats.
- **Fragebogen:** Er liegt im Dashboard (`QM_KRIT`). Jede Kontrolle wird mit Therapeut:in, Patient:in, Termin, Punkten und Login-E-Mail (`leitung`) gespeichert. Daraus entstehen Historie und Trend je Therapeut:in.

---

## 4. Club-Reiter und MyWellness-CRM

### Wie die CRM-Daten ins Dashboard kommen

Ein **Power-Automate-Flow** läuft stündlich von 7 bis 20 Uhr. Er meldet sich per REST bei MyWellness an, wählt je Club den Kontext (Werneck `ac2210638`, Kitzingen `ac2657028`) und legt die Dateien in SharePoint ab. Das Dashboard selbst kennt diese Kontexte nicht; es liest nur die abgelegten Dateien. Im Code steht „stündlich", und „MyWellness-Stand" wird rot, wenn die jüngste Datei älter als zwei Stunden ist.

```
12_Code/Controlling/MyWellness/<Standort>/
   <n>. Gespräch_….csv
   Anmerkungen/*.json
   Gruppen/<Gruppen-Id>.json
   Gruppen/Verlauf/<yyyy-MM>/<dd> <Id>.json
```

- **Die Gesprächs-CSVs** sind die Fragebögen „Ergebnis des Gesprächs" aus dem CRM, eine Zeile je Person und Gespräch: Datum, Antwort, Name, E-Mail und `Id Cloud`.
  - Gelesen wird jede `.csv` im Standortordner. Die **Gesprächsstufe** steht im Dateinamen (`1. Gespräch_…`, Muster `(\d). Gespräch`), der **Standort** im Ordnernamen. Einen festen Dateinamen `1. Gespräch.csv` gibt es nicht.
  - Die Spalten werden über die Überschrift erkannt, in mehreren Schreibweisen (`Datum`/`date`, `Email`/`e-mail`, `Id Cloud`). Die Antwortspalte heißt „Ergebnis des Gesprächs" oder, im zweiten Gespräch, anders; dann gilt die Spalte, die nicht Datum, Name, E-Mail oder Id ist.
  - Personen werden über die `Id Cloud` verbunden. Je Person und Stufe zählt der jüngste Stand. Fehlt die `Id Cloud`, bleibt der Satz stehen und wird nicht zusammengeführt.
- **Anmerkungen:** jedes JSON in `<Standort>/Anmerkungen/`. Verknüpft wird über den Inhalt (`id`, Stufe, Tag), nicht über den Dateinamen.
- **Wie der Flow im Detail funktioniert** (Adressen, Kopfzeilen, Fallen im Editor), steht in `12_Code/Controlling/MyWellness/FLOW.md` (SharePoint).

### Antwortkategorien (`MW_ERG` im Code)

- **Club-Mitgliedschaft** einmal/zweimal pro Woche
- **Präventionskurs 8 Wochen** einmal/zweimal pro Woche
- **Präventionskurs 16 Wochen** einmal/zweimal pro Woche
- **R+V Fit**, **T-Rena**
- **Folgegespräch**, **Folgerezept**
- **Kein Interesse / trainiert bereits**, **Keine Rückmeldung vom Therapeuten**, **„Nicht geeignet" / abgeraten**, **Sonstige**

Die Häufigkeit wird aus dem Antworttext gelesen, z. B. „2x / Woche". Fehlt sie, erscheint die Antwort als „Häufigkeit nicht angegeben" (am Eintrag, z. B. „Club-Mitgliedschaft · Häufigkeit nicht angegeben"); das Dashboard rät nicht. Eine unbekannte Antwort landet unter „nicht zugeordnet" (`MW_UNBEKANNT`), damit sie auffällt.

`ab` an einem Eintrag markiert ein verkauftes Angebot (Club, Prävention, R+V Fit, T-Rena). Das ist nicht dasselbe wie der Abschluss der Reise: dort zählt nur die Club-Mitgliedschaft. Prävention, R+V Fit und T-Rena sind eine Station, kein Ende.

### Unterreiter je Standort im Club-Reiter

| Unterreiter | Inhalt |
|---|---|
| **Rezeptende → Gespräch** | Wer am Rezeptende stand und ob ein Gespräch im CRM erfasst wurde. Werneck aus den Kennzahlen des Patientencheckers, Kitzingen aus `behandlungen_alle.json` und `patientenliste.json`. Die Brücke zum Gespräch ist der normalisierte Name (`reNorm`), weil MyWellness die Praxis-Id nicht kennt; passt genau eine `Id Cloud`, läuft die Reise darüber weiter. Mehrere Ids heißen in der Ansicht „Name mehrdeutig". Fehlt die Werneck-Liste ganz, nennt der Hinweis den 22.10.2026 (fest im Code). |
| **Gespräche & Absprung** | Verteilung der Antworten, Quote der Gespräche mit Club-Mitgliedschaft, „Reise" je Person über das 1. bis 3. Gespräch, Trichter |
| **Mitglieder** | Club-Mitglieder und Präventionskurse aus den CRM-Gruppen, mit Verlauf |
| **Strichliste** | Jeder Fragebogen ist ein Strich, je Tag oder Woche, aufgeteilt nach Antwort. Die Spalte „Abschlüsse" zählt hier jedes `ab`-Angebot, also auch Prävention, R+V Fit und T-Rena. |

**Wichtig:** Die alte Excel-Strichliste (Blatt „Therapiemanger" in den KPI-Trackern) wird **nicht mehr gepflegt** und ist **nicht mehr angebunden** — im Code nur noch als Kommentar, das Blatt wird nicht gelesen. Das CRM ist die einzige Quelle. Das Dashboard nimmt je Standort das Datum des frühesten Gesprächs im Export und zeigt für die Zeit davor einen Hinweis statt Nullen. Diese Tage stehen nicht fest im Code. Die Ausgangsfassung dieses Textes nennt dafür den 14.10.2026 (Werneck) und den 16.10.2026 (Kitzingen).

### Mitgliederzahlen: was richtig ist

- **Richtig** ist die Zahl aus **MyWellness → Personen → Kontakte → Filter auf die Gruppe**, z. B. „KIMOJO Club Smart (2x pro Woche)" oder „KIMOJO Club Starter (1x pro Woche)".
- **Gruppen in Werneck:**
  - Club: KIMOJO Club Starter (1x pro Woche), KIMOJO Club Smart (2x pro Woche)
  - Präventionskurse: 1./2. Präventionskurs Krafttraining 1 x bzw. 2x pro Woche, Präventionskurs 1, Präventionskurs 2
- **Kitzingen** benennt seine Gruppen anders („Monatlich Kündbar Starter" …). Das Dashboard ordnet deshalb nach Namensmustern zu (`MG_ART`). Prävention wird zuerst geprüft, dann Club (`club`, `smart`, `starter`, `mitgliedschaft`, `kündbar`), sonst **Weitere Gruppen**. Es gibt keine Ausschlussliste. Automatische Gruppen sollen laut Code-Kommentar gar nicht im Export liegen (Beispiele dort: „Mit Programm", „Aktive Kunden"); gezählt wird, was als Datei ankommt. Ein Name, der „club" enthält und nicht nach Prävention aussieht, fällt in die Club-Zahl.

---

## 5. Regeln, die die KI einhalten muss

1. **Niemals Daten raten.** Fehlt ein Wert, wird die Lücke im Dashboard sichtbar ausgewiesen („keine Daten", „nicht zugeordnet", „Therapeut:in nicht belegt"). Keine Heuristik, keine Rückprojektion, keine Null für „unbekannt". Zuordnungen nur über eindeutige IDs, nicht über ähnliche Namen. Die eine bestehende Namensbrücke ist die Rezeptende-Ansicht (`reNorm`, siehe Abschnitt 4). Sie nicht durch eine weitere Heuristik ersetzen oder ausweiten.
2. **Quelle immer gegen echte Daten prüfen.** Spaltennamen, Formate und Sonderfälle an den echten Exporten ansehen, bevor Code dafür geschrieben wird. Ohne Zugriff auf echte Daten: nachfragen statt annehmen.
3. **Spalten über die Überschrift erkennen, nicht über die Position.** Die Standorte haben unterschiedlich viele Spalten. (Der bestehende Code hält das nicht überall: Gesprächs-CSV und NPS ja, mehrere Excel-Parser lesen feste Positionen. Neue Parser trotzdem über die Überschrift.)
4. **Stil beibehalten:** Single-File-HTML, vorhandene CSS-Variablen (`--red`, `--teal`, `--amber`, `--ergo`, `--green`, dazu `--dark`, `--bg`, `--card`, `--muted`, `--border` und die `-bg`-Varianten), deutsche Oberfläche, kurze erklärende Kommentare im Code wie bisher.
5. **Wochen nach ISO** (`kwOf`; dieselbe Rechnung in `cKW`). Die KW-Spalte in den Excel-Dateien nutzt `WEEKNUM` und weicht davon ab. `index.html` erwähnt `WEEKNUM` nicht: die Auslastung übernimmt die KW-Zahl aus dem Blatt, wie sie dort steht (`pAusl`).
6. **Region und Standortfilter** (`REG`, `aF`) in jeder neuen Ansicht berücksichtigen. Siehe Abschnitt 3, welche bestehenden Ansichten das schon tun.
7. **Keine Namenslisten fest einbauen**, außer den beiden Leitungs-E-Mails in `QM_LEITUNG`. Zuteilungen gehören in die gemeinsame Datei. Die Adressen nicht in Doku, Commits oder Chats wiederholen.

---

## 6. Arbeitsablauf und Veröffentlichung

- **Führende Fassung ist dieses GitHub-Repo** (`Jobraetz99/verantwortliche-dashboard`), Datei `index.html`. Hier wird bearbeitet, nicht mehr in OneDrive.
- Jede Änderung läuft über einen **eigenen Branch und Pull Request**. Gemergt wird nur nach Freigabe durch Johannes. Nach dem Merge in `main` ist der Stand live unter **https://jobraetz99.github.io/verantwortliche-dashboard/** (GitHub Pages).
- **OneDrive** (`…/BM Group/12_Code/Verantwortliche_Dashboard/okr-dashboard.html`) ist nur noch eine **Kopie** der freigegebenen Fassung, keine Arbeitskopie.
- **Nicht** ins Repo `kimojo-dashboards` committen. Das ist das Azure-Repo nur für Patientenchecker und Management-Controlling.
- Die ältere eingebettete Fassung auf `kimojo-therapie.de/verantwortliche/` (WordPress) wird nicht automatisch aktualisiert.
- **Weitere Dashboards** haben eigene Repos (u. a. `controlling-dashboard`, `Patientenchecker-werneck`, `cki-dashboard`).

---

## 7. Offene Punkte (Stand 29.10.2026)

Diese Punkte liegen im Power-Automate-Flow, nicht im Code dieses Repos. Die Anteile und die API-Schritte unten stehen nicht in `index.html`.

1. **Der Flow schreibt keine Gruppendateien.** Es gibt keinen Ordner `MyWellness/<Club>/Gruppen/`, während die Gesprächs-CSVs stündlich aktualisiert werden. Deshalb zeigt Club → Mitglieder keine echten Zahlen.
   - **Nächster Schritt:** In Power Automate im letzten Lauf den Bereich „Gruppen" prüfen: `GruppenListe` (`GET core.mywellness.com/v2/pro/Group/FacilityGroups`), `GruppeMitglieder` (`POST …/v2/pro/facilityusers/search` mit `groups:[id]`) und `GruppeSpeichern`.
   - **Ziel:** dieselben Zahlen wie Kontakte → Filter Gruppe.
2. **Der Flow meldet Fehler nicht.** Scheitert ein Abruf, bleibt der Lauf grün und die Datei wird nur nicht mehr aktualisiert. Im Dashboard zeigt „MyWellness-Stand: …", wie alt die Daten sind.
3. **Zugangsdaten im Flow:** Die MyWellness-Zugangsdaten sollten nicht im Klartext im Flow stehen. Besser: eigenes Dienstkonto, Passwort als sichere Eingabe oder im Azure Key Vault. Keine Zugangsdaten hierher kopieren.
4. **Patientennamen in Werneck:** Bei etwa 2 % der Termine ist der Name nur als „Patient #ID" bekannt. Ursachen:
   - Die Verordnungsübersicht liefert nur 1000 von rund 1360 Verordnungen (Seitenlimit im Flow).
   - Manche Termine haben gar keine Verordnung.
   - Lösung im Flow: weitere Seiten abrufen und den Patientennamen in der Historien-Abfrage mitliefern.

Im Code steht der Platzhalter `Patient #<id>`, wenn Verordnungsübersicht und Terminplan keinen Namen liefern. Die Anteile 2 % und 1000 von 1360 stehen nicht im Code.

---

## 8. Sicherheit

- **Das GitHub-Repo ist öffentlich.** Der Quelltext, Commits und Commit-Nachrichten dürfen keine Zugangsdaten, keine Patientendaten und keine Personaldaten von Mitarbeitenden enthalten.
- **Keine Zugangsdaten** in Chats oder Code: Passwörter, MyWellness-Token und `Authorization`-Kopfzeilen nicht hineinkopieren, auch nicht aus Screenshots von F12 → Netzwerk.
- **Keine echten Patientendaten** in Chats, Tests oder Beispieldaten. Export-Dateien enthalten Namen und E-Mails. Es reichen Spaltenüberschriften und ein bis zwei erfundene Beispielzeilen.
