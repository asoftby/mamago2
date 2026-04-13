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
