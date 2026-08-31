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

## Env

| var | what |
| --- | --- |
| `DATABASE_URL` | Supabase **transaction pooler** (port 6543), role `baithak_app` |
| `ACCESS_CODE` | team code → `member` |
| `ADMIN_CODE` | admin code → `admin` (approve / skip / requeue) |
| `AUTH_SECRET` | 32+ random chars, signs the session cookie |

`.env*` and `HANDOFF.md` are gitignored. Rotate the DB password any time with
`alter role baithak_app with password '...';`.

## Shape

- `proxy.ts` — gate. Everything except `/login`, `/api/login` and static assets needs a valid
  signed cookie; API routes get a 401 instead of a redirect. Site-wide `noindex` + `robots.txt`.
- `lib/auth.ts` — HMAC-SHA256 cookie (`role.exp.sig`), Web Crypto so it runs in the proxy too.
- `lib/db.ts` / `lib/queries.ts` — every query, parameterized, `$1`-style only (the transaction
  pooler rejects named prepared statements). Server-only; nothing DB-ish reaches the client.
- `app/api/review/route.ts` — re-checks the admin cookie server-side, then calls
  `baithak.review_meeting($1,$2,$3)`. The database decides which transitions are legal; an illegal
  one comes back as a 409 with the function's own message.
- Pages are all `force-dynamic` — this is a live operations view.

Filters, search and the collapsible transcript / Hindi-note sections are plain links, a GET form and
native `<details>`, so the only client component in the app is the review buttons.

## Deploy (Vercel)

Set the four env vars in Project → Settings → Environment Variables, then deploy. Nothing else —
no build step needs the database.
