# Self-host without Manus

Run this OMS on a Linux VPS (Oracle Cloud Free Tier is enough) or Railway with Docker. The stack is the Node app and MySQL 8. Manus is not required for the process, the database, browser sign-in, or `POST /api/import/orders`.

Public URL for this deployment: `https://readygo-oms.duckdns.org`.

## What still depends on Manus

| Feature | Without these env vars |
| --- | --- |
| Browser sign-in | Use `OMS_ADMIN_USERNAME` and `OMS_ADMIN_PASSWORD` (runtime). The login screen shows that form when Manus is unset. Manus OAuth remains available when `VITE_OAUTH_PORTAL_URL` and `VITE_APP_ID` are set at **image build** time and `OAUTH_SERVER_URL` is set at runtime; the screen then shows the Manus button instead of the password form. |
| Owner notifications | Skipped. Creating an order or changing status still saves. |
| Product images and PDF file URLs | Upload calls fail until `BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY` are set. |
| Maps and AI helpers | Same forge credentials. |
| Card checkout | `/api/stripe/webhook` returns 503 until the Stripe vars are set. |
| PDF font and logo | Generation downloads a font from CloudFront and a logo from `files.manuscdn.com`. The rest of the app does not. |

Stock deduction is unchanged. The import API is unchanged. See [order-import.md](./order-import.md).

## One-time VM setup

Install Docker Engine and the Compose plugin. On a 1 GB Oracle VM, add swap before the first image build so `pnpm build` is not killed:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Build on the VM. An image built on amd64 will not run on an Ampere (arm64) Free Tier box.

Open ports 80 and 443 in the Oracle security list and on the host firewall. Leave port 3000 closed to the internet. Compose publishes the app on `127.0.0.1` only.

Point the DuckDNS name at the VM's public IP (DuckDNS dashboard, or their update URL on a cron). HTTP-01 certificates need that name to resolve to this machine before Caddy starts.

## Configure

```bash
cp .env.example .env
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # OMS_IMPORT_API_KEY
```

Edit `.env`. Passwords must be letters and numbers only.

| Variable | Required | When it is read |
| --- | --- | --- |
| `MYSQL_ROOT_PASSWORD` | yes, for compose | MySQL container |
| `MYSQL_PASSWORD` | yes, for compose | MySQL user, and the `DATABASE_URL` compose injects (`mysql://oms:<password>@mysql:3306/oms`) |
| `MYSQL_DATABASE` | no (default `oms`) | MySQL database name |
| `MYSQL_USER` | no (default `oms`) | MySQL user |
| `JWT_SECRET` | yes | Runtime. Session cookie signature. |
| `DATABASE_URL` | yes for bare metal | Compose **replaces** this with the internal MySQL URL above. |
| `PORT` | no (default `3000`) | Runtime. Inside compose the process stays on 3000. |
| `APP_PORT` | no (default `3000`) | Host side of `127.0.0.1:APP_PORT:3000`. |
| `OMS_IMPORT_API_KEY` | yes, to accept imports | Runtime. Empty disables the route (503). |
| `OMS_ADMIN_USERNAME`, `OMS_ADMIN_PASSWORD` | yes, for password sign-in | Runtime. Both must be non-empty. No image rebuild. |
| `OAUTH_SERVER_URL`, `OWNER_OPEN_ID` | only for Manus login | Runtime. |
| `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL` | only for Manus login | **Image build**. Also pass `VITE_APP_ID` at runtime; the server stores it on the session. Leave both empty to show the password form. |
| `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` | only for storage, maps, AI, notifications | Runtime. |
| `VITE_FRONTEND_FORGE_API_URL`, `VITE_FRONTEND_FORGE_API_KEY` | only for the map widget | **Image build**. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VITE_STRIPE_PUBLISHABLE_KEY` | only for card payments | Secret and webhook: runtime. Publishable key: **image build**. |
| `VITE_ANALYTICS_ENDPOINT`, `VITE_ANALYTICS_WEBSITE_ID` | no | **Image build**. If either is empty the Umami tag is omitted. |

Do not commit `.env`.

## Build, migrate, first boot

```bash
docker compose up -d --build
docker compose logs -f app
```

The app container applies every SQL file under `drizzle/` (including `drizzle/0014_external_orders.sql`) with `drizzle-kit migrate`, then starts `node dist/index.js`. Later boots skip migrations that are already recorded.

Do not run `pnpm db:push` on the server. That command generates new migration files. Use `pnpm db:migrate` or the container entrypoint.

Changing `OMS_IMPORT_API_KEY`, `OMS_ADMIN_USERNAME`, `OMS_ADMIN_PASSWORD`, or `JWT_SECRET` needs a recreate, not a rebuild:

```bash
docker compose up -d
```

Changing any `VITE_*` value needs a rebuild: `docker compose up -d --build`.

### Bare metal (no Docker)

Node 22, pnpm 10.4.1, MySQL 8. From a checkout:

```bash
pnpm install --frozen-lockfile
SKIP_MANUS_RUNTIME=1 pnpm build
# DATABASE_URL must be in the environment or in .env
pnpm db:migrate
pnpm start
```

## Health check

Inside the VM:

```bash
curl -fsS http://127.0.0.1:3000/api/health
```

Through the domain, after the proxy is up:

```bash
curl -fsS https://readygo-oms.duckdns.org/api/health
```

A ready process returns `{"ok":true}`. Missing database config or a failed `SELECT 1` returns HTTP 503.

## Browser sign-in

Set both variables, then recreate the process. On Railway, set them on the service and redeploy. They are not `VITE_*` build args.

```bash
# .env
OMS_ADMIN_USERNAME=admin
OMS_ADMIN_PASSWORD=$(openssl rand -hex 32)
```

Open the site. When `VITE_OAUTH_PORTAL_URL` and `VITE_APP_ID` are empty, the login card shows 帳號, 密碼, and 登入系統. A match sets the same `app_session_id` session cookie the Manus callback sets (`JWT_SECRET` signs it) and stores an admin user with `openId` `local-admin` and `loginMethod` `password`. On HTTPS the cookie is `SameSite=None; Secure`. On plain HTTP it is `SameSite=Lax` so the browser will keep it. Wrong credentials return 帳號或密碼不正確. If either variable is empty, sign-in is refused and a blank password is never accepted.

Surrounding whitespace on the username and password is ignored. Symbols are allowed. This password is not interpolated into `DATABASE_URL`.

`GET /api/health` stays public. `POST /api/import/orders` still uses `OMS_IMPORT_API_KEY` and does not accept this password.

When the Manus Vite variables are baked into the image, the card keeps the Manus button and hides the password form. The password mutation stays available, and the Manus callback is unchanged.

## Import API key

Set `OMS_IMPORT_API_KEY` in `.env`, then `docker compose up -d`. Callers send `Authorization: Bearer <key>` or `X-API-Key: <key>` to `POST /api/import/orders`. If the variable is empty, the route returns **503** `API_KEY_NOT_CONFIGURED` and does not write orders.

## HTTPS

Caddy on the host is the short path. It obtains a Let's Encrypt certificate and sets `X-Forwarded-Proto`, which the app uses for the session cookie.

`/etc/caddy/Caddyfile`:

```caddy
readygo-oms.duckdns.org {
	reverse_proxy 127.0.0.1:3000
}
```

```bash
sudo systemctl reload caddy
```

nginx with a certificate from certbot:

```nginx
server {
	listen 443 ssl;
	server_name readygo-oms.duckdns.org;

	# ssl_certificate and ssl_certificate_key from certbot

	location / {
		proxy_pass http://127.0.0.1:3000;
		proxy_set_header Host $host;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto $scheme;
	}
}
```

## Manus Vite plugin

`vite-plugin-manus-runtime` is a dev preview script injected into `index.html`. `vite build` uses production mode and does not load it. `SKIP_MANUS_RUNTIME=1` skips it for any mode, including the dev server. The Docker build sets that variable. If a local production build still tries to load the package, run:

```bash
SKIP_MANUS_RUNTIME=1 pnpm build
```

## Upgrade

```bash
git pull
docker compose up -d --build
```

The MySQL volume `oms_mysql` is kept. Migrations run again and only apply new files.
