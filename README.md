# Baithak Briefs

Mobile-first internal viewer for the meetings Plaud records and the English briefs the pipeline
writes for them — built for 2-hour meetings nobody's taking notes in, so the next one starts from
"here's what's still open," not from memory. Read-only, except one thing: anyone signed in can
mark an action item done or reopen it, via `baithak.set_action_status()`.

There used to be an approve/skip review step here (`baithak.review_meeting()`, admin-only). It's
gone by request — every meeting the pipeline writes now shows up immediately, sensitive ones
included. The function still exists in the database; nothing here calls it.

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
with no code never leaves `/login`. `ADMIN_CODE` vs `ACCESS_CODE` only decides the badge shown in
the header today — there's no admin-only action left to gate. Kept because a future feature may
want it, not because anything currently checks it.

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
| `ADMIN_CODE` | admin code → `admin` (badge only, see above) |
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
- `app/api/actions/status/route.ts` — any signed-in session (no admin check — see above), calls
  `baithak.set_action_status($1,$2)`. The database enforces the only two legal values (`open`,
  `done`) and refuses to touch a `dropped` item; an illegal call comes back as a 409 with the
  function's own message.
- Pages are all `force-dynamic` — this is a live operations view.

Light mode only: one `@custom-variant` rule in `globals.css` stops the `dark:` utilities from ever
matching, so restoring dark mode is deleting that rule.

Filters, search and the collapsible transcript / Hindi-note sections are plain links, a GET form and
native `<details>`, so the only client components are the Google button and the action-item toggle.

## Meeting continuity

The two features that replace the review step, both aimed at the 2-hour-meeting problem — walking
in with no notes, fully dependent on what the pipeline wrote:

- **Recap** (`app/m/[id]/page.tsx`) — `brief.decisions[]`, `brief.open_issues[]` and
  `brief.next_meeting_agenda[]` rendered as three scannable lists, straight from the existing
  `summaries.brief` jsonb. No schema change; the pipeline already writes these fields, they just
  weren't surfaced outside the prose brief before. Scoped to that one meeting — nothing else.
- **The toggle** — a checkbox on every action item, everywhere one is shown, backed by
  `db-migration-set-action-status.sql` (already applied to the live project). Deliberately binary
  — open or done, not a three-state tracker. Nobody had a concrete picture of what "in progress"
  should mean yet; add it as a third allowed value in the function and the toggle component if a
  plain checkbox turns out too coarse.

An earlier version also put a "carried forward" panel of every open item, from *any* meeting, on
every meeting page. Dropped: `meeting_type` is `unclassified` on 46 of 49 recordings (the pipeline
only types at `confidence_threshold`), so there's no reliable way to know an item on the Auditor
onboarding meeting belongs to the Auditor onboarding thread rather than a completely unrelated
Flipkart-returns discussion — showing it inline read as part of that meeting's own checklist, and
it wasn't. The full cross-meeting backlog belongs on `/actions`, which is already clearly labeled
as everything open, not scoped to whatever meeting you happened to open.

## The Actions tab

`owner` is free text the pipeline writes from what it heard — 127 distinct values across 279 open
items at last count, "Mahesh" next to "Mahesh + team" next to "Mahesh, Aditya" as three separate
groups. Grouping by it, as the page originally did, was never going to hold up past a couple of
weeks of volume. What replaced it, all reusing the exact chip-and-search pattern already proven on
the Meetings page rather than inventing a second one:

- **Meeting-type chips** (MIS / Sales / Other) — `meeting_type` is populated now (199/52/28 open,
  unlike when the carried-forward panel was cut), so this is a real, cheap axis.
- **Overdue and High-priority chips** — 30 of 279 open items are already overdue and had no
  dedicated view before this; a filter chip made them findable in one tap.
- **Search over description + owner**, not owner-as-group-header — "Mahesh" now matches every
  variant instead of needing 127 buckets collapsed into one.
- **An "open 2+ weeks" badge** on any card past that age with no due date — due dates only exist on
  35 of 279 items, so age-since-the-meeting is the only staleness signal that covers the rest.
- **A Completed tab** (`completedActions()` in `lib/queries.ts`), most-recently-finished first, with
  the toggle still live so a mis-click is one tap to undo.

`set_action_status` now takes an optional third `actor` argument
(`db-migration-action-status-note.sql`) and writes it into a new `status_note` column — "marked
done by \<email\>" / "reopened by \<email\>", the same one-line-not-a-history-table pattern
`meetings.status_reason` already used for `review_meeting`. It shows on the card whenever present.
Toggles made before this migration have no note; that's correct, not a bug — there's no way to
retroactively know who did those.

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
