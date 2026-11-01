# Narco City Akten

Neue Vite/JavaScript-Anwendung für das Supabase-Projekt `gplasajxitwifndxjxjf`.
Das am 01.11.2026 abgerufene GitHub-Repository war leer (keine Remote-Refs).
Es gab daher keinen bestehenden Code oder vorhandene Abhängigkeiten zu prüfen.

## Lokal

Node 24 und pnpm verwenden. `pnpm install --frozen-lockfile`, `.env.example` nach
`.env.local` kopieren und ausschließlich den Supabase **Publishable Key** eintragen.
`pnpm dev`, `pnpm test`, `pnpm build`.
Ohne korrekte Konfiguration bleibt die App gesperrt. Ein erfolgreicher Build ohne
Umgebungsvariablen ist kein Nachweis einer funktionierenden Supabase-Verbindung.

## Datenbank zuerst prüfen

Der Live-Zustand wurde mangels nutzbarem Verwaltungszugang nicht geprüft oder verändert.
Vor Einrichtung vorhandene Tabellen, RLS-Policies, Views, Funktionen und Storage-Buckets
im Supabase-Dashboard prüfen. Bestehende Tabellen werden durch dieses neue Schema nicht geschützt.
`database/setup.sql` ist ein noch **nicht angewendetes**, transaktionales Einrichtungsskript,
keine aus dem bestehenden Projekt abgeleitete Migration. Es legt nur neue `nc_*`-Objekte an
und bricht bei Namenskonflikten ab. Nach Prüfung über eine reguläre Supabase-Migration
anwenden und Security Advisors ausführen. Nicht mehrfach ausführen.

Rechte: viewer liest alle Akten, editor liest/erstellt/bearbeitet, admin zusätzlich löscht.
Alle freigeschalteten Nutzer teilen denselben Aktenbestand. Kein automatischer erster Admin.
Mitglieder können ihre eigene Rolle lesen, aber keine Rollen schreiben. Rollenverwaltung
erfolgt vorerst ausschließlich durch den vertrauenswürdigen Projektbetreiber im Dashboard.
Keine Berechtigungsentscheidungen aus benutzeränderbaren Metadaten.
Das Änderungsprotokoll enthält Akten-ID, Aktion, Benutzer-ID und Zeitpunkt, keine Akteninhalte.
Die App zeigt maximal 200 Akten; die Suche filtert diese lokal.

## Vercel und Discord

1. Repository/Branch mit Vercel importieren; Framework Vite, Ausgabe `dist`.
2. `VITE_SUPABASE_URL` und `VITE_SUPABASE_PUBLISHABLE_KEY` für die gewählte Umgebung setzen.
   Niemals Discord Client Secret, service_role oder Supabase Secret Keys hier eintragen.
3. Zunächst geschütztes Preview-Deployment verwenden; Vercel Deployment Protection prüfen.
   Die Anwendung selbst enthält keine echten Akten oder Beispiel-Personendaten.
4. In Supabase Auth die endgültige HTTPS-Site-URL und die exakte Rücksprungadresse
   `https://DEINE-VERCEL-DOMAIN/` erlauben. Keine pauschalen Preview-Wildcards.
5. Discord-Provider aktivieren. Discord Client ID/Secret nur im Supabase-Dashboard hinterlegen.
   Discord Redirect URI: `https://gplasajxitwifndxjxjf.supabase.co/auth/v1/callback`.
6. Mit dem vorgesehenen Discord-Konto anmelden. Die Benutzer-ID im Supabase Auth-Dashboard
   eindeutig anhand der Discord-Identität verifizieren. Erst danach gezielt in `nc_members`
   als admin eintragen. Niemals den ersten beliebigen registrierten Benutzer befördern.
7. Mit einem zweiten, nicht freigeschalteten Konto testen: keine Akten sichtbar, auch nicht
   über direkte REST-Anfragen. Danach viewer/editor/admin und unmittelbaren Rechteentzug testen.

OAuth verwendet PKCE, die Rücksprungadresse kommt ausschließlich von der eigenen Origin.
Sitzungen liegen im Session Storage des Tabs; Akten werden nicht lokal gespeichert.
Ausgabe von Akteninhalten über textContent; CSP und weitere Header in vercel.json.
Keine Dokument-Uploads, öffentlichen Buckets, Discord-Bot- oder Guild-Rollen-Synchronisierung.
Das ist ein erster Funktionsumfang; solche Funktionen benötigen eigene private Storage-Policies.

## Erforderlicher Online-Abnahmetest

Nach Deployment: HTTPS/Response-Header prüfen, Discord-Hin-und-Rückleitung testen,
anonymen und nicht freigeschalteten Zugriff prüfen, CRUD mit Testakten testen,
Rollenentzug und Abmeldung prüfen, Testakten löschen und Protokolle kontrollieren.
Die lokalen PostgreSQL-Tests prüfen RLS und Datenbankrechte mit synthetischen Daten.
Sie ersetzen weder den Live-Supabase-Check noch den echten Discord-OAuth-/Vercel-Test.
