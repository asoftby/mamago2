## Local Development

Run the development server:

```bash
pnpm dev
```

Local development is host-based and mirrors the production multi-subdomain setup.

Add these entries to `/etc/hosts`:

```text
127.0.0.1 mamago.local
127.0.0.1 business.mamago.local
127.0.0.1 admin.mamago.local
```

Use these URLs in development:

- Public app: [http://mamago.local:3000](http://mamago.local:3000)
- Business cabinet: [http://business.mamago.local:3000](http://business.mamago.local:3000)
- Admin panel: [http://admin.mamago.local:3000](http://admin.mamago.local:3000)

`localhost:3000` is kept only as a legacy fallback for a few development flows such as local tunneling and compatibility checks. It is not the canonical app origin.

For Telegram or other incoming webhooks, point the tunnel to `http://localhost:3000`, then configure the webhook with the public tunnel URL.

## Production deploy checklist

After the first deploy on an empty database:

```bash
pnpm db:migrate:deploy
pnpm db:seed
pnpm bootstrap:admin   # optional: first admin user
```

Environment for production launch:

- `APP_ENV=production`
- `SITE_NOINDEX_DEFAULT=false` (required — `true` blocks search indexing)
- Rotate any secrets that were ever committed to git (e.g. Telegram bot token via BotFather)

If cities are missing after migrate, `/` shows a setup notice instead of redirecting to a 404 city page.
