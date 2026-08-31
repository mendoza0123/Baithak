# Baithak Briefs

Mobile-first internal viewer for the meetings Plaud records and the English briefs the hourly
pipeline writes for them. Read-only, except one action: an admin approving / skipping / requeueing
a meeting via `baithak.review_meeting()`.

## Run it

```bash
npm install
cp .env.example .env.local   # fill in the real values
npm run dev                  # or: npm run build && npm start
npm test                     # node --test, no framework
```

## The gate — two steps

1. **Google sign-in.** Identifies the person. Issues a 15-minute cookie carrying only their email;
   that cookie opens nothing on its own.
2. **Access code.** `ACCESS_CODE` → `member`, `ADMIN_CODE` → `admin`. Only now does the cookie get a
   role, and only a cookie with a role gets past `proxy.ts`.

Neither half works alone: the right code with no Google session is rejected, and a Google session
with no code never leaves `/login`. Approvals are recorded against the signed-in address, so
`status_reason` reads `approved in dashboard by <email>` instead of just `approved in dashboard`.

### Google Cloud setup (once)

1. console.cloud.google.com → **APIs & Services → Credentials → Create credentials → OAuth client ID**
2. Application type **Web application**.
3. **Authorised JavaScript origins** — add every origin the app is served from:
   `http://localhost:3100` and `https://<your-vercel-domain>`.
4. Copy the **Client ID** into `GOOGLE_CLIENT_ID`. There is no client secret to copy — this uses the
   ID-token flow, and the client ID is public by design (it ships in the page).

Adding a new domain later means adding it to the authorised origins, or sign-in fails there.

## Env

| var | what |
| --- | --- |
| `DATABASE_URL` | Supabase **transaction pooler** (port 6543), role `baithak_app` |
| `GOOGLE_CLIENT_ID` | web OAuth client ID; without it `/login` refuses to proceed |
| `ALLOWED_EMAILS` | optional, comma-separated. Empty = any Google account may reach step 2 |
| `ACCESS_CODE` | team code → `member` |
| `ADMIN_CODE` | admin code → `admin` (approve / skip / requeue) |
| `AUTH_SECRET` | 32+ random chars, signs the session cookie |

`.env*` and `HANDOFF.md` are gitignored. Rotate the DB password any time with
`alter role baithak_app with password '...';`.

## Shape

- `proxy.ts` — the gate. Everything except `/login`, `/api/login`, `/api/auth/google` and static
  assets needs a cookie **with a role**; API routes get a 401 instead of a redirect. Site-wide
  `noindex` + `robots.txt`.
- `lib/auth.ts` — HMAC-SHA256 cookie over a small JSON payload, Web Crypto so it runs in the proxy
  too. One token type covers both steps: no `role` means the code step is still pending.
- `app/api/auth/google/route.ts` — verifies the ID token against Google's keys via
  `google-auth-library`, requires a verified email, checks `ALLOWED_EMAILS`.
- `lib/db.ts` / `lib/queries.ts` — every query, parameterized, `$1`-style only (the transaction
  pooler rejects named prepared statements). Server-only; nothing DB-ish reaches the client.
- `app/api/review/route.ts` — re-checks the admin role server-side, then calls
  `baithak.review_meeting($1,$2,$3)`. The database decides which transitions are legal; an illegal
  one comes back as a 409 with the function's own message.
- Pages are all `force-dynamic` — this is a live operations view.

Light mode only: one `@custom-variant` rule in `globals.css` stops the `dark:` utilities from ever
matching, so restoring dark mode is deleting that rule.

Filters, search and the collapsible transcript / Hindi-note sections are plain links, a GET form and
native `<details>`, so the only client components are the Google button and the review buttons.

## Hindi text: script toggle

Plaud's note and the transcript are Hindi. `?lang=hinglish` on a meeting page renders them in
Roman script via `lib/hinglish.ts` — IAST from sanscript, then Hindi schwa deletion. It is
**transliteration, not translation**: same words, different script, done on the server so no
library ships to the browser.

Hindi and Hinglish versions of the English *brief* are translation, not script conversion, so they
have to come from the pipeline. No migration needed when they do — `summaries.brief` is already
`jsonb`, so writing `summary_md_hi` and `summary_md_hinglish` keys into it is enough and the
dashboard can read them straight away.

## Deploy (Vercel)

Set the six env vars in Project → Settings → Environment Variables, add the deployment domain to the
Google client's authorised origins, then deploy. Nothing in the build touches the database.
