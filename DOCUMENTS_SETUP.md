# Private Bilder zu Akten

## Bereitstellung

1. Aktualisierten Code im Branch `feat/secure-akten` speichern. Bestehender
   Vercel-Server-Schlüssel `SUPABASE_SECRET_KEY` wird weiterverwendet.
2. **Nur** `database/documents-gateway.sql` im Supabase SQL Editor ausführen.
   Frühere Einrichtungsskripte nicht erneut ausführen. Dieses neue Skript ist
   wiederholbar. Es ergänzt Storage-Sperre, Dokument-Audit und Bereitschaftsprüfung.
   Es löscht keine Dokumente oder Akten. Alte direkte Storage-Zugriffe auf diesen
   Bucket werden gesperrt; andere Buckets werden durch die neue Regel nicht gesperrt.
3. `select public.nc_documents_ready() as bereit;` muss `true` liefern.
4. Aktuellen Vercel-Stand deployen, nach Ready Webseite neu laden.
5. Bei einer Testakte `Dokumente` öffnen. Mit Akte 2 ein erfundenes Testbild
   als Sonstiges hochladen und herunterladen. Nach Neuladen weiterhin auffindbar.
6. Ohne Akte 2, aber mit Akte: Liste und Download funktionieren, Upload fehlt.
   Ohne beide Rollen: kein Dokumentzugriff. Rollenentzug auch bei bereits
   geöffneter Liste vor dem nächsten Download testen.

## Umfang

PNG, JPEG und WebP, maximal **2 MiB pro Bild**. Die bestehende Bucket-Grenze
von 10 MiB wird nicht geändert; auch bestehende größere Dateien werden in dieser
ersten Version nicht heruntergeladen. Grund: Vercel begrenzt Request und Response
einer Funktion auf 4,5 MB; Base64 vergrößert Uploads zusätzlich.
https://vercel.com/docs/functions/limitations

Dokumentarten: Profilbild, Ausweis, Führerschein, Waffenschein, Sonstiges.
Keine PDFs, kein Überschreiben, keine Löschfunktion, keine Inline-Bildvorschau.
Die Liste zeigt bis zu 100 Dokumente pro Akte, neueste zuerst.

## Sicherheit

Jede Liste, jeder Upload und jeder Download prüft Anmeldung, passende
Discord-Identität, aktuelle Serverrollen, private Bucket-Einstellung und die
Storage-Sperrregel. Downloads benutzen keine öffentlichen oder signierten Links;
der Server liefert die Datei nach Prüfung als Attachment mit `no-store`/`nosniff`.
Dateipfade werden nur serverseitig aus dem Dokumentdatensatz ermittelt.
Die API akzeptiert keine frei wählbaren Storage-Pfade.

Uploads erhalten zufällige Namen und werden auf Maximalgröße, erlaubte Dokumentart
und PNG/JPEG/WebP-Signatur geprüft. Das ist keine vollständige Bilddekodierung
oder Virenprüfung. Dateien werden deshalb als Download ausgeliefert und nicht
als aktive Webseiten eingebettet. Aktenbezug muss existieren und darf nicht
gelöscht sein. Fremde oder gelöschte Akten sind nicht erreichbar.

Ein Audit-Trigger protokolliert neue Dokumente ohne Bildinhalt. Scheitert das
Speichern des Metadatensatzes, versucht die API ausschließlich das gerade von
dieser Anfrage erzeugte Storage-Objekt aufzuräumen. Bei Prozessabbruch oder
Ausfall können unreferenzierte private Objekte verbleiben; sie werden über die
Anwendung nicht angeboten. Eine bereinigende Löschroutine ist nicht enthalten.

Bereits heruntergeladene Kopien oder früher ausgegebene signierte Links lassen
sich durch Rollenentzug nicht zurückholen. Bestehende Links/Realtime/andere
exponierte Schemas sind nicht Teil dieses lokalen Tests. Die Abnahme der echten
Vercel-/Supabase-Verbindung steht bis zur oben beschriebenen Einrichtung aus.
