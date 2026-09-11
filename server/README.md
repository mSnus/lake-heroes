# Lake Heroes — multiplayer backend

A thin, password-light state store for online play: it persists the serialized
`GameState` JSON per game and hands out one 8-char join code per player slot.
No game rules live here — the React client stays authoritative. Sync happens at
turn boundaries (active client `PUT`s; others poll `GET`).

## Stack
Docker Compose: **nginx** (proxy) + **php-fpm/Laravel** (API) + **MySQL 8**.

## Layout
```
server/
├─ docker-compose.yml
├─ .env                       # compose + DB env (read by Laravel via env())
├─ docker/
│  ├─ php/Dockerfile
│  └─ nginx/default.conf
└─ laravel/                   # Laravel app — custom files committed; skeleton filled on first run
   ├─ app/Models/Game.php
   ├─ app/Models/GamePlayer.php
   ├─ app/Http/Controllers/GameController.php
   ├─ database/migrations/2026_01_01_000000_create_games_tables.php
   └─ routes/api.php
```

Only the **custom** source files are committed under `laravel/`. The Laravel
framework skeleton (composer.json, bootstrap, public/index.php, artisan, …) is
generated on first run with `cp -rn` so it fills in around the custom files
**without overwriting them**.

## First-time setup
From `server/`:

```bash
# 1. Build images and start MySQL + PHP
docker compose up -d --build

# 2. Scaffold the Laravel skeleton into the bind mount WITHOUT clobbering
#    our committed custom files. NB: the image is Alpine, so `cp` is BusyBox
#    and `cp -rn . DEST` silently copies NOTHING -- use tar -k (keep existing)
#    instead, which is what actually preserves the committed files.
docker compose exec app sh -c '
  composer create-project laravel/laravel /tmp/skel --no-interaction &&
  (cd /tmp/skel && tar -cf - . | tar -xkf - -C /var/www/html) &&
  rm -rf /tmp/skel
'

# 3. Enable API routing (wires routes/api.php into bootstrap/app.php).
#    Our routes/api.php already exists, so keep it if prompted.
docker compose exec app php artisan install:api --no-interaction || true

# 4. App key + DB schema
docker compose exec app php artisan key:generate
docker compose exec app php artisan migrate

# 5. No CORS setup needed: the Vite dev server proxies /api to this container
#    (see vite.config.ts), and in production the site's nginx proxies
#    /heroes/api/ here -- both make the API same-origin.
docker compose exec app php artisan config:clear
```

The DB credentials come from `server/.env` (passed to both the `mysql` service
and the `app` container's environment, where Laravel reads them via `env()`).
After `key:generate`, `laravel/.env` holds `APP_KEY`; make sure its `DB_*`
match `server/.env` (host `mysql`, db `lakeheroes`, user `lake`).

## API
| Method | Route | Body | Returns |
|--------|-------|------|---------|
| POST | `/api/games` | `{ state }` (full GameState JSON string; `state.players[]` has name+color) | `{ codes: [{code, playerIndex, color, name}…], version }` |
| GET | `/api/games/{code}` | — | `{ state, version, status, playerIndex, color }` |
| PUT | `/api/games/{code}/state` | `{ state, version }` | `{ version }` or `409 {error:'stale', version}` |

Codes are uppercase, 8 chars from `A–Z2–9` (no `0/O/1/I`). Case-insensitive
(`{code}` is upper-cased server-side).

## Smoke test
```bash
curl -s -X POST 127.0.0.1:8091/api/games -H 'Content-Type: application/json' \
  -d '{"state":"{\"players\":[{\"name\":\"A\",\"color\":\"red\"},{\"name\":\"B\",\"color\":\"blue\"}],\"version\":1}"}'
# → {"codes":[{"code":"...","playerIndex":0,...},{...}],"version":1}

curl -s 127.0.0.1:8091/api/games/<CODE>

curl -s -X PUT 127.0.0.1:8091/api/games/<CODE>/state -H 'Content-Type: application/json' \
  -d '{"state":"{\"players\":[...],\"gameOver\":false}","version":1}'
# → {"version":2}   (re-PUT with stale version → 409)
```

## Production wiring

The API is served **same-origin** from the main site, at
`https://vinetsky.com/heroes/api/` — the client calls that path via
`VITE_API_BASE` (set in `.github/workflows/deploy.yml`).

The proxy lives in fastpanel's per-site includes file, which survives vhost
regeneration, as section 8 of:

```
/etc/nginx/fastpanel2-sites/msnus/vinetsky.com.includes
  location ^~ /heroes/api/ { proxy_pass http://127.0.0.1:8091/api/; ... }
```

That file also holds this site's post-compromise hardening, so keep edits
additive. Backup taken before the change:
`vinetsky.com.includes.bak-2026-09-11`. To apply an edit:
`sudo nginx -t && sudo systemctl reload nginx`.

**Why not the `heroes.vinetsky.com` vhost**, which also exists and points at
`/var/www/msnus/data/www/vinetsky.com/heroes-server`: it listens on `:80` only,
and the TLS certificate covers just `vinetsky.com` (no wildcard, no SAN for the
subdomain). An HTTPS page could therefore not call it without a new
certificate, and it would additionally need CORS, being a different origin. The
path proxy needs neither. If that subdomain is ever preferred it needs its own
cert plus a CORS allow-list in Laravel, after which `VITE_API_BASE` becomes the
full `https://heroes.vinetsky.com/api` and nothing else in the client changes.

The containers run with `restart: unless-stopped`, so the stack returns after a
reboot; without it the game stays deployed while the API silently stops
answering.
