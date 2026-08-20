---
name: weekly-security-audit
description: >-
  Super-critical weekly security and reliability audit for Volvo OFV. Use for
  scheduled security reviews, auth/RLS/CSP hardening checks, or when the user
  asks for a weekly sikkerhetssjekk, kritisk sikkerhetsgjennomgang, or
  cutting-edge auth review.
---

# Volvo OFV — Weekly Security Audit (fail closed)

Du er senior sikkerhetsansvarlig. Målet er **cutting-edge** for en intern B2B-app med PII (OFV-registreringer). Vær streng. Anta at «det ser greit ut» er utilstrekkelig — krev bevis i kode, migrasjoner, env/runtime og RLS.

Les denne skillen **før** du konkluderer. Følg sjekklisten nedenfor i rekkefølge.

## Stance

1. **Fail closed** slår fail open. Tom/ukjent rolle, merkevare eller secret = deny.
2. **App-lag ≠ sikkerhetsgrense.** UI-deny uten matching RLS/API er et funn.
3. **Maskerte statuskoder er bugs.** `catch → 401` når det er 500 er et H-funn.
4. **Env-inventar ≠ health.** «Variabel er satt» er ikke nok — verifiser kanonisk host, Redis-ping, faktisk redirectTo.
5. **Ikke soft-pedal.** Hvis noe er «legacy bakoverkompat» uten migrering, kall det en bakdør.

## Scope (hver uke)

### A. Diff + baseline

1. Checkout `main` (eller angitt branch). Les siste ukes commits (`git log --since=7.days`).
2. Kjør `npm run typecheck` og `npm test`. Feil = kritiske funn.
3. Les `src/lib/auth/**`, `src/lib/security/**`, `src/middleware.ts`, `next.config.ts`, `supabase/migrations/**` (siste + RLS-hjelpere).

### B. Auth / roller (must pass)

| Sjekk | Forventet |
|-------|-----------|
| `resolveRole` | Ukjent/tom/`admin` → `null` (ingen legacy `admin→super`) |
| `roleCanAccess(null, …)` | `false` |
| Layout | Ugyldig rolle **eller** merkevare → `/ingen-tilgang` uten app-chrome |
| `requireApiPageAccess` | JSON 401/403; ukjent → 500; `isRedirectError` rethrow |
| Server actions | `assertPageAccess` (kast), ikke `requirePageAccess` (redirect) inne i `{ error }`-actions |
| MFA | Super uten TOTP låst til `/admin/sikkerhet`; invite/reset/slett krever MFA |
| Invite | Feilet rolle-set → rollback/slett bruker (ingen halvbruker) |

### C. RLS / database (must pass)

| Sjekk | Forventet |
|-------|-----------|
| `jwt_app_role()` | **Ingen** `coalesce(…, 'salg')`. Tom → null → deny |
| `jwt_can_read_*` / policies | Ingen `'admin'` i tillatte roller |
| Policies vs `ROLE_PAGES` | Speiler app-roller; avvik = funn |

Hvis Supabase er tilgjengelig: verifiser live `pg_get_functiondef` / `pg_policies`. Ellers: les migrasjoner + flagg «må verifiseres live».

### D. Export / PII

| Sjekk | Forventet |
|-------|-----------|
| Alle `src/app/api/export/**` | `requireApiPageAccess` + `apiErrorResponse` |
| Rate limit | Export begrenset; Upstash fail-closed i prod |
| Excel | Formel-sanitering (`sanitizeSpreadsheet` / tilsvarende) |
| Nested helpers | Ingen `requirePageAccess` inne i API-ruter (redirect→500-felle) |

### E. Site URL / e-post / cron

| Sjekk | Forventet |
|-------|-----------|
| `getServerSiteUrl` | Prod krever `SITE_URL` (ingen stille NEXT_PUBLIC-fallback for auth) |
| Kanonisk host | `https://app.biloversikt.com` |
| `authCallbackUrl` | `/auth/confirm?next=…` (én e-poststi) |
| Auth health | `/admin/sikkerhet` pinger Upstash, matcher kanonisk host, viser mal-sjekkliste |
| Cron / Netlify | `/.netlify/functions/*` ikke force-301’et bort; sync beholder Authorization |

### F. CSP / headers

| Sjekk | Forventet |
|-------|-----------|
| Prod `script-src` | Nonce + `strict-dynamic`; **ikke** `'unsafe-inline'`; **ikke** `'unsafe-eval'` |
| Dev | `'unsafe-eval'` tillatt kun i development |
| `style-src` | `'unsafe-inline'` OK (Tailwind/themes) — dokumenter som kjent rest |
| Øvrig | HSTS, `frame-ancestors 'none'`, `X-Frame-Options DENY`, nosniff |

### G. CI / regresjon

| Sjekk | Forventet |
|-------|-----------|
| `.github/workflows/ci.yml` | typecheck + test (+ lint) på push/PR |
| Tester | `resolveRole`, `resolveBrandId`, CSP-builder dekket |

## Severity scale

- **C (Critical):** Auth bypass, RLS fail-open, secret-lekkasje, uautentisert sync/admin.
- **H (High):** MFA-omgåelse, invite uten rolle, rate-limit fail-open i prod, maskert 401, SITE_URL mismatch i prod.
- **M (Medium):** Fail-open metadata (brand), svak CSP, manglende tester, ops-blindhet.
- **L (Low):** Copy, kosmetikk, kjente aksepterte rester (f.eks. style-src unsafe-inline).

## Output format (obligatorisk)

1. **Dom:** én setning — cutting-edge / nesten / ikke.
2. **Tabell** med kolonner: Severity | Location (`file:line` eller `sql:function`) | Finding | Bevis | Anbefalt fix.
3. **Allerede solid:** kort liste (ikke fyll).
4. **Prioritert fix-liste** (maks 7 punkter, strengest først).
5. Hvis du fikser: kun klare, lave-risiko-fikser med tester; åpne PR mot `main`. Ellers: stopp etter rapport.

## Cutting-edge bar (pass/fail)

Si **cutting-edge** bare hvis **alle** B–G «must pass» er grønne (eller eksplisitt verifisert live).  
Hvis ett must-pass feiler: **ikke cutting-edge** — list gapet først.

## Anti-patterns (ikke gjør dette)

- Default rolle til `salg` «for bakoverkompatibilitet».
- Godta `admin` i JWT uten migrering.
- Si at UI-redirect er nok når RLS er løsere.
- Markere env «satt» som OK uten kanonisk host / Redis-ping.
- Svelge Next `redirect()` i API `catch`.
- Bred refaktor eller feature-arbeid i samme runde som sikkerhetsfix.
