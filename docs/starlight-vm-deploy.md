# Starlight VM deploy

This app can replace an existing app on a Starlight VM by building Loafers in GitHub Actions, backing up the current website files, and copying the built `dist` folder into the VM's existing web root.

The recommended setup keeps Supabase and Resend exactly as they are. The VM only hosts the frontend.

## What the deploy does

1. Builds Loafers with `npm run build`.
2. Packages the `dist` folder.
3. Copies the package to the VM over SSH.
4. Backs up the current website folder to a timestamped `.tgz` file.
5. Replaces the existing website files with Loafers.
6. Preserves `.well-known` so SSL/domain verification files are not removed.
7. Writes `.loafers-release` into the web root.

## GitHub setup

Open the repository settings:

`Settings → Secrets and variables → Actions`

Add this repository variable when you are ready for automatic VM deploys:

| Type | Name | Value |
| --- | --- | --- |
| Variable | `STARLIGHT_DEPLOY_ENABLED` | `true` |

Leave that variable unset or set to `false` until the VM secrets are ready. The workflow can still be run manually from the Actions tab.

Add these repository secrets:

| Secret | Required | Example |
| --- | --- | --- |
| `STARLIGHT_HOST` | Yes | `203.0.113.10` or `example.com` |
| `STARLIGHT_USER` | Yes | `deploy` |
| `STARLIGHT_SSH_PRIVATE_KEY` | Yes | private key for the deploy user |
| `STARLIGHT_WEB_ROOT` | Yes | `/var/www/current-app` or `/srv/starlight/app` |
| `STARLIGHT_PORT` | No | `22` |
| `STARLIGHT_BACKUP_ROOT` | No | `/var/backups/loafers-site` |
| `STARLIGHT_PUBLIC_URL` | No | `https://your-domain.com` |
| `STARLIGHT_KNOWN_HOSTS` | No | output of `ssh-keyscan -p 22 your-host` |

The existing Supabase secrets are also used by this workflow:

| Secret | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | public Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | public Supabase anon key |

## Finding the current website folder

On the VM, the web root is usually in one of these places:

```bash
/var/www/html
/var/www/<site-name>
/srv/<site-name>
/home/<user>/<app-folder>
```

Useful checks:

```bash
sudo nginx -T | grep -E "server_name|root "
sudo caddy validate --config /etc/caddy/Caddyfile
docker ps
```

Use the exact folder that the web server is already serving for the current app. That folder becomes `STARLIGHT_WEB_ROOT`.

## One-time VM preparation

Create a deploy user or use an existing limited user that can write to the web root:

```bash
sudo adduser deploy
sudo usermod -aG www-data deploy
sudo chown -R deploy:www-data /path/to/current/web/root
sudo chmod -R u+rwX,g+rwX /path/to/current/web/root
```

If backups should live outside the website folder:

```bash
sudo mkdir -p /var/backups/loafers-site
sudo chown -R deploy:deploy /var/backups/loafers-site
```

Add the public half of your deploy key to:

```bash
/home/deploy/.ssh/authorized_keys
```

## Reverting if needed

Each deploy creates a backup like:

```bash
/var/backups/loafers-site/pre-loafers-<release>-<timestamp>.tgz
```

To restore one:

```bash
cd /path/to/current/web/root
sudo find . -mindepth 1 -maxdepth 1 ! -name ".well-known" -exec rm -rf -- {} +
sudo tar -xzf /var/backups/loafers-site/pre-loafers-<release>-<timestamp>.tgz -C .
```

## After setup

Once the secrets and variable are in GitHub, every publish to `main` can also replace the Starlight-hosted app automatically.

GitHub Pages can remain as a fallback URL while the VM becomes the main customer-facing URL.
