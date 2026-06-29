# Volvo OFV – Markedsinnsikt og Registreringsstatistikk

Internt analyseverktøy for Volvo Trucks / Volvo Group Norge. Viser og
analyserer nyregistreringer og populasjon/bestand av tunge kjøretøy basert på
data fra **OFV Statistikk**, synkronisert til Supabase.

> Kun for autorisert internt bruk.

## Teknologi

- **Next.js 15** (App Router) + **TypeScript** (strict)
- **Tailwind CSS 4** + **shadcn/ui**-komponenter
- **Supabase** (`@supabase/ssr`) for auth og data
- **Recharts**, **date-fns**, **lucide-react**, **sonner**
- **zod** + **react-hook-form**, **nuqs**

## Kom i gang

1. Installer avhengigheter:

   ```bash
   npm install
   ```

2. Kopier miljøvariabler og fyll inn Supabase-verdiene dine:

   ```bash
   cp .env.local.example .env.local
   ```

   | Variabel | Beskrivelse |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase prosjekt-URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | (Phase 2) For datasynk fra OFV |
   | `OFV_API_BASE_URL` | (Phase 2) OFV Statistikk API base-URL (`https://integrasjon-ofv.qanto.no`) |
   | `OFV_API_USERNAME` / `OFV_API_PASSWORD` | (Phase 2) Basic Auth-legitimasjon fra OFV AS |
   | `SYNC_SECRET` | (Phase 2) Beskytter synk-endepunktet |

3. Start utviklingsserveren:

   ```bash
   npm run dev
   ```

   Åpne [http://localhost:3000](http://localhost:3000).

4. Kjør Supabase-migrasjoner i SQL Editor (i rekkefølge):

   - `supabase/migrations/20260627220353_user_report_views.sql`
   - `supabase/migrations/20260627223000_ofv_data.sql`
   - `supabase/migrations/20260627230000_add_company_address_fields.sql`

5. Start første datasynk (lastebiler, alle merker):

   ```bash
   curl -X POST http://localhost:3000/api/sync \
     -H "Authorization: Bearer $SYNC_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"scope":"full"}'
   ```

   Synk-endepunktet støtter `scope`: `full` | `registrations` | `population`.
   Første full synk henter ~66k bestand + årets nyregistreringer og kan ta flere minutter.

## Deploy (Netlify)

Appen kjører på Netlify med `@netlify/plugin-nextjs` (App Router, API-ruter og
middleware fungerer ut av boksen). Konfigurasjonen ligger i `netlify.toml`.

1. **Koble repoet til Netlify** (Add new site → Import from Git), eller bruk CLI:

   ```bash
   npx netlify deploy --build           # forhåndsvisning
   npx netlify deploy --build --prod    # produksjon
   ```

2. **Sett miljøvariabler** i Netlify (Site settings → Environment variables) –
   samme som i `.env.local`:

   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OFV_API_BASE_URL`, `OFV_API_USERNAME`, `OFV_API_PASSWORD`
   - `SYNC_SECRET`

   `URL` settes automatisk av Netlify og brukes av cron-jobben.

### Automatisk datasynk (cron)

To Netlify-funksjoner i `netlify/functions/` håndterer synk:

| Funksjon | Type | Rolle |
| --- | --- | --- |
| `scheduled-sync` | Scheduled (cron) | Kjører daglig kl. **05:00 UTC** og trigger background-funksjonen |
| `ofv-sync-background` | Background (15 min) | Kjører selve `runOfvSync` (full synk) |

Splittingen er nødvendig fordi scheduled functions har 30s-grense, mens full
synk kan ta flere minutter. Full synk er versjons-bevisst og hopper over hvis
OFVs `dataVersion` allerede er synket – daglig kjøring er derfor trygt og fanger
nye publiseringer automatisk.

> Scheduled/background-funksjoner kjører **kun på publiserte produksjons-deploys**
> (ikke i deploy previews eller lokalt). Endre tidspunkt via `schedule` i
> `netlify/functions/scheduled-sync.mts`.

Manuell trigging av background-synk:

```bash
curl -X POST "$URL/.netlify/functions/ofv-sync-background" \
  -H "Authorization: Bearer $SYNC_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"scope":"full"}'
```

## Utviklingsfaser

| Fase | Innhold | Status |
| --- | --- | --- |
| **1** | Grunnmur, auth, layout med Volvo Trucks-profil | ✅ |
| **2** | Datalag, OFV-synk, Supabase-skjema | ✅ |
| **3** | Dashbord + Rapportvisninger (lagre/laste/forvalte) | ✅ |
| **4** | Nyregistreringer detaljvisning + visninger | ✅ |
| **5** | Populasjon / Bestand + visninger | ✅ |
| **6** | Finpuss, theming, eksport (CSV), norsk UX | ✅ |

## Designprofil (Volvo Trucks)

- Primær: Volvo Trucks-blå `#003087`
- Aksent: Volvo Trucks-gul `#FFCC00`
- Nøytral: mørk grå, sølv, ren hvit / svært lys grå

## Prosjektstruktur

```
src/
  app/
    (app)/            # Beskyttede sider (krever innlogging)
    api/sync/         # OFV → Supabase synk-endepunkt
    login/            # Innlogging
    auth/callback/    # Supabase OAuth/e-post-callback
  components/
    brand/            # Volvo-logo / iron mark
    layout/           # Sidebar, header, navigasjon
    ui/               # shadcn/ui-komponenter
  lib/
    ofv/              # OFV API-klient, transform, konstanter
    sync/             # Synk-orkestrering
    supabase/         # Klient, server, admin, middleware, typer
    navigation.ts
netlify/functions/    # Cron-synk (scheduled + background)
supabase/migrations/  # Versjonerte SQL-migrasjoner
docs/ofv-samples/     # Eksempelresponser fra OFV API
netlify.toml          # Netlify build + Next.js-runtime
middleware.ts         # Sesjon + rutebeskyttelse
```
