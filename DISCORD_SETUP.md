# Discord-Rollen mit bestehender Datenbank

Server: `959404435614859264`.
Rolle `1566464655340077166` (Akte): lesen.
Rolle `1566464755278024776` (Akte 2): lesen, anlegen, bearbeiten.
Beide Rollen: editor. Keine passende Rolle oder Servermitgliedschaft: gesperrt.
Kein Löschen und keine automatische Administratorvergabe. Bestehende manuelle
`members`-Rollen erlauben keinen Zugriff durch die neue API.

## Einrichtung in dieser Reihenfolge

1. `database/discord-gateway.sql` prüfen und im Supabase SQL Editor ausführen.
   Nur dieses Skript verwenden, nicht das frühere `database/setup.sql`.
   Es verändert keine Akteninhalte. Es sperrt allerdings den bisherigen direkten
   Clientzugriff auf die vier vorhandenen Tabellen. Andere Anwendungen, die diese
   Tabellen direkt verwenden, können danach nicht mehr zugreifen.
   Das Skript verwendet eine Transaktion und bricht bei Namenskonflikten ab;
   es ist für einmalige Anwendung vorgesehen.
2. In Vercel unter Settings > Environment Variables `SUPABASE_SECRET_KEY`
   mit dem serverseitigen Supabase Secret Key (`sb_secret_...`) setzen.
   Bestehender legacy service_role-Key ist technisch ebenfalls möglich.
   Keine neue Berechtigung anlegen, wenn ein passender Schlüssel schon existiert.
   Dieser Schlüssel gehört **niemals** in `VITE_*`, Dateien, Chat oder Screenshots.
   Er umgeht RLS und muss wie ein Datenbankpasswort geschützt werden.
3. Aktuellen Branch `feat/secure-akten` bei Vercel neu deployen.
4. Auf der Webseite abmelden und erneut Discord-Login ausführen. Die App fordert
   zusätzlich `guilds.members.read` an. Dafür wird kein Discord-Bot benötigt.
5. Online-Test mit eigenen Testkonten: keine Rolle → gesperrt, Akte → nur Lesen,
   Akte 2 → Anlegen/Bearbeiten, beide → editor. Eine Rolle entfernen und eine
   neue Anfrage ausführen: Zugriff muss sofort bei der neuen Anfrage abgelehnt werden.
   Bereits angezeigte Daten lassen sich nicht rückwirkend aus dem Gedächtnis oder
   aus Kopien entfernen. Die Seite vor Verlassen des Arbeitsplatzes abmelden.

## Sicherheitsmodell und Grenzen

Jede API-Anfrage validiert den Supabase-Login beim Auth-Server, bindet den
Discord-Token an die verifizierte Discord-Identität dieses Benutzers und fragt
die Mitgliedschaft/Rollen für genau diesen Server bei Discord ab. Keine
Rollenentscheidung aus Browserangaben, user_metadata oder gespeicherten Rollen.
Discord-Fehler, abgelaufene Tokens und Rate Limits sperren den Zugriff.
Supabase erneuert Discord-Tokens nicht automatisch: bei Ablauf erneut anmelden.
Tokens werden nur im Session Storage des Tabs gehalten und beim Abmelden entfernt.

Die API verwendet nach erfolgreicher Prüfung ihren Server-Schlüssel für einen
eng begrenzten Zugriff auf `person_files`. Eingaben sind auf Vorname, Nachname und
Notizen begrenzt; zusätzliche Aktenfelder bleiben beim Bearbeiten erhalten.
updated_by/created_by werden serverseitig aus der verifizierten Benutzer-ID gesetzt.
Ein Datenbanktrigger setzt updated_at und protokolliert jede Änderung atomar ohne
Akteninhalte. Konflikte beim gleichzeitigen Bearbeiten werden abgewiesen.

Vor jeder Datenabfrage prüft `nc_gateway_ready()`, ob direkte Tabellen- und
Spaltenrechte fehlen und ob öffentliche Views oder Definer-RPCs eine erkennbare
Umgehung erlauben. Bei Problemen wird gesperrt statt automatisch Rechte zu ändern.
Die Live-Umgebung muss zusätzlich auf andere exponierte Schemas, RPCs, Realtime,
Storage-Buckets und bereits ausgegebene Download-Links geprüft werden. Dokumente
und Uploads sind in dieser Version nicht angebunden; vorhandene Dateien werden
durch dieses SQL-Skript nicht automatisch privat gemacht oder gelöscht.

## Nachweise

`node --test` prüft Rollen, Identitätsbindung, Rollenentzug, API-Methoden,
Eingabevalidierung sowie PostgreSQL-Rechte/Audit mit synthetischem Schema.
`pnpm build` prüft den Frontend-Build. Die Vercel-Serverfunktion wird lokal als
Handler getestet. Echte Discord-Autorisierung und Vercel-Laufzeit müssen nach
der Live-Einrichtung separat geprüft werden.
