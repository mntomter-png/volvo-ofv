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

4. Kjør Supabase-migrasjoner:

   ```bash
   supabase db push
   ```

   Alternativt: kjør filene i `supabase/migrations/` i rekkefølge via Supabase SQL Editor.

5. Start første datasynk (lastebiler, alle merker):

   ```bash
   npm run sync:ofv -- full
   # eller:
   curl -X POST http://localhost:3000/api/sync \
     -H "Authorization: Bearer $SYNC_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"scope":"full"}'
   ```

   Synk-endepunktet støtter `scope`: `full` | `registrations` | `population`.
   Første full synk henter ~66k bestand + årets nyregistreringer og kan ta flere minutter.
   `SYNC_SECRET` sendes **kun** i `Authorization: Bearer`-header (ikke query string).

## npm-scripts

| Script | Beskrivelse |
| --- | --- |
| `npm run dev` | Lokal utviklingsserver |
| `npm run build` | Produksjonsbuild |
| `npm run start` | Kjør produksjonsbuild |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript (`tsc --noEmit`) |
| `npm run sync:ofv` | OFV → Supabase synk (`full` / `registrations` / `population`, valgfri `--force`) |
| `npm run sync:backfill` | Backfill av registreringer fra gitt dato |
| `npm run sync:history` | Historisk backfill år for år (f.eks. `2020 2025`) |
| `npm run user:create` | Opprett bruker via CLI |
| `npm run user:set-admin` | Sett admin-rolle på bruker |

## Moduler og roller

| Side | Rolle(r) |
| --- | --- |
| Dashbord | `leder`, `super`, `admin` |
| Nyregistreringer | `salg`, `leder`, `super`, `admin` |
| Populasjon / bestand | `service`, `leder`, `super`, `admin` |
| PKK | `pkk`, `leder`, `super`, `admin` |
| Rapportvisninger | `leder`, `super`, `admin` |
| Admin / brukere | `admin` |

Rolle settes i `app_metadata.role` (JWT). Ukjent rolle faller tilbake til `salg`.
RLS på `registrations`, `population` og `sync_logs` speiler tabellen over
(migrasjon `20260701160000_role_based_rls.sql`).

## Sikkerhet

- Side-tilgang sjekkes i middleware og server-komponenter (`requirePageAccess`)
- Excel-eksport krever samme side-tilgang som UI, med rate limit per bruker
- Auth callback validerer `next`-redirect (kun relative stier)
- Innlogging og passord-reset har distribuert rate limiting (Upstash i prod)
- Passordkrav: min. 12 tegn, stor/liten bokstav, tall og spesialtegn
- Admin-feil er generiske; detaljer logges server-side
- Admin MFA: **påkrevd** for `super` (hard gate til `/admin/sikkerhet` til TOTP er aktivert)
- Security headers (CSP uten `unsafe-eval`, HSTS) i `next.config.ts`
- Supabase service role (`admin.ts`) er merket `server-only`
- OFV/SSB-data er tilgjengelig for autentiserte roller via RLS (by design).
  Bulk-eksport er begrenset; ytterligere kolonnebegrensning vurderes ved
  compliance-behov.
- Bruksstatistikk (siste besøk / side) logges for innloggede brukere med
  5-min throttle og 90 dagers retention; kun `super` ser oversikten.

Sett også i Netlify: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
(**påkrevd i produksjon** — rate limit fail-closed uten Redis),
`NEXT_PUBLIC_SITE_URL` og **`SITE_URL`** (prod = `https://app.biloversikt.com`).
**`SITE_URL` er påkrevd i produksjon** (runtime for glemt-passord/invite) — ikke
stol på bake-in `NEXT_PUBLIC_*` alene. Redeploy etter env-endring.

Aktiver MFA i Supabase Dashboard → Authentication → Providers / Multi-Factor
(TOTP), og beskytt Deploy Previews under Site configuration → Access control.

### E-postmaler (glemt passord / invitasjon)

Én callback: `/auth/confirm` (token_hash anbefalt; PKCE `?code=` støttes som
fallback). Appen registrerer `redirectTo` mot samme sti.

**Redirect URLs** må inkludere `https://app.biloversikt.com/**`.

**Reset password** (Authentication → Email Templates):

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/oppdater-passord">
  Tilbakestill passord
</a>
```

**Invite user** (samme mønster med `type=invite`):

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/oppdater-passord">
  Sett passord
</a>
```

`volvo-ofv.netlify.app` 301’es til `app.biloversikt.com`, unntatt
`/.netlify/functions/*` (pg_cron).
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
   - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
   - `NEXT_PUBLIC_SITE_URL` (produksjon: `https://app.biloversikt.com`)
   - `SITE_URL` (samme verdi – runtime for glemt-passord/invite)

   `URL` settes automatisk av Netlify og brukes av cron-jobben.

   Beskytt Deploy Previews: **Site configuration → Access control → Deploy
   notifications / Visitor access → Password protection** (kun previews).

### Automatisk datasynk (cron)

OFV-synk styres av **Supabase pg_cron** (`trigger_ofv_sync`) daglig kl. **10:00 og 14:00 UTC**.
SSB-synk styres av **pg_cron** (`trigger_ssb_sync`) ukentlig mandag kl. **06:00 UTC**.

| Funksjon | Type | Rolle |
| --- | --- | --- |
| `ofv-sync-background` | Background (15 min) | Kjører `runOfvSync` (full synk) |
| `ssb-sync-background` | Background | Kjører `runSsbSync` |

Splittingen er nødvendig fordi scheduled functions har 30s-grense, mens full
synk kan ta flere minutter. Full synk er versjons-bevisst og hopper over hvis
OFVs `dataVersion` allerede er synket – daglig kjøring er derfor trygt og fanger
nye publiseringer automatisk.

> Cron-jobber konfigureres i `supabase/migrations/20260707080000_pg_cron_ofv_sync.sql`
> og `supabase/migrations/20260709110000_pg_cron_ssb_sync.sql`.
> Background-funksjoner krever `Authorization: Bearer $SYNC_SECRET`.
> Scheduled/background-funksjoner kjører **kun på publiserte produksjons-deploys**
> (ikke i deploy previews eller lokalt).

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
| **7** | PKK-modul, region & distrikt, sikkerhetsforsterkning | ✅ |

## Designprofil (Volvo Trucks)

- Primær: Volvo Trucks-blå `#003087`
- Aksent: Volvo Trucks-gul `#FFCC00`
- Nøytral: mørk grå, sølv, ren hvit / svært lys grå

## Prosjektstruktur

```
src/
  app/
    (app)/            # Beskyttede sider (krever innlogging)
      pkk/            # PKK-modul (rolle: pkk)
    api/sync/         # OFV → Supabase synk-endepunkt
    api/export/       # Excel-eksport (krever side-tilgang)
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
