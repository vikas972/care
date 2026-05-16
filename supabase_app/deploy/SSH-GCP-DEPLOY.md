# Complete CI/CD: GitHub Actions → GCP VM → Domain + HTTPS

This guide explains **how Voice Studio is deployed** (`voice.genaiforge.in`) and how to **repeat the same pattern on a new project**.

Use it when you forget a step, onboard someone, or set up another app on GCP.

---

## 1. Big picture (in simple words)

| Piece | What it does | Why we need it |
|--------|----------------|----------------|
| **GitHub** | Stores code; runs workflows on push | Automate build + deploy |
| **CI workflow** | Builds frontend + checks backend on every PR/push | Catch errors before production |
| **CD workflow** | SSH to VM, copy code, `docker compose up --build` | Ship new version without manual SSH every time |
| **GCP VM** | Linux server that runs Docker | Cheap, full control, one box for app + proxy |
| **Docker** | Runs frontend + backend in containers | Same environment every deploy |
| **Host nginx** | Public door on ports 80/443 | HTTPS + send traffic to app on localhost |
| **DNS** | `voice.genaiforge.in` → VM IP | Humans use a name, not an IP |
| **Let’s Encrypt** | Free SSL certificate | Browser mic/camera need **HTTPS** |

**Flow when you merge to `supabase_Bass`:**

```
You push/merge code
    → GitHub Actions (CI) builds & tests
    → GitHub Actions (Deploy) SSH to VM
    → tar copy supabase_app/ to ~/supabase_app/
    → docker compose build + up
    → Users open https://voice.genaiforge.in
    → Host nginx (443) → 127.0.0.1:8081 (frontend container)
    → Container nginx → /voice/* → backend container
```

---

## 2. Architecture (two nginx layers — don’t confuse them)

```
Internet
   │
   ▼
┌──────────────────────────────────────────────┐
│  GCP VM (Ubuntu)                              │
│  Host nginx :80 / :443  ← Certbot TLS here   │
│       │ proxy_pass http://127.0.0.1:8081      │
│       ▼                                       │
│  ┌─────────────────────────────────────┐     │
│  │  Docker: deploy-frontend-1 (nginx)   │     │
│  │  - Serves React static files         │     │
│  │  - Proxies /voice/ → backend:8080    │     │
│  │  - Port map: 127.0.0.1:8081 → 80     │     │
│  └──────────────┬──────────────────────┘     │
│                 │ Docker network only         │
│                 ▼                             │
│  ┌─────────────────────────────────────┐     │
│  │  Docker: deploy-backend-1 (FastAPI)  │     │
│  │  - No public port (expose 8080 only) │     │
│  │  - Reads ~/supabase_app/deploy/      │     │
│  │    backend.env (secrets)             │     │
│  └─────────────────────────────────────┘     │
└──────────────────────────────────────────────┘
```

**Why two nginx?**

- **Host nginx**: owns **public** ports 80/443 and the **SSL certificate**.
- **Container nginx**: serves the built React app and routes `/voice` to the API **inside Docker** (backend is not exposed to the internet).

**Why `127.0.0.1:8081` and not `80:80` on Docker?**

So only host nginx is on the public internet. The app container is reachable only from the VM itself — safer.

---

## 3. Files in this repo (what each one is for)

| File | Role |
|------|------|
| `.github/workflows/supabase-app-ci.yml` | **CI** — `npm run build`, Python compile check |
| `.github/workflows/deploy-supabase-gcp-vm.yml` | **CD** — SSH deploy to VM |
| `supabase_app/deploy/docker-compose.yml` | Defines `frontend` + `backend` services |
| `supabase_app/deploy/Dockerfile.frontend` | Build React → nginx image |
| `supabase_app/deploy/Dockerfile.backend` | Build FastAPI image |
| `supabase_app/deploy/nginx.conf` | **Inside** frontend container (SPA + `/voice` proxy) |
| `~/supabase_app/deploy/backend.env` on VM | **Production secrets** (never in git) |
| `/etc/nginx/sites-available/voice.genaiforge.in` on VM | **Host** nginx + HTTPS (not in git) |

---

## 4. GitHub workflows explained

### 4.1 CI — `supabase-app-ci.yml`

**When it runs:** push or PR to `supabase_Bass` when `supabase_app/**` changes.

**What it does:**

1. **Frontend job** — `npm ci` + `npm run build` (TypeScript + Vite).
2. **Backend job** — `pip install` + `python -m compileall` (syntax check).

**Why:** Broken builds fail in GitHub before they hit your server. PRs can require this check to pass before merge.

**It does NOT deploy** — only validates.

---

### 4.2 CD (Deploy) — `deploy-supabase-gcp-vm.yml`

**When it runs:**

- Push to `supabase_Bass` (including after PR merge), or
- Manual **Run workflow**.

**What it does (step by step):**

1. Checkout code on GitHub’s Ubuntu runner.
2. Write `.deploy-build.env` with `VITE_*` values from GitHub Secrets (baked into frontend at build time).
3. SSH to VM using `GCP_VM_USER` + `GCP_VM_HOST` + private key secret.
4. Stream `supabase_app/` as **tar over SSH** (no `rsync` needed on runner).
5. On VM: prune Docker cache if disk is low, then `docker compose up -d --build`.
6. Delete `.deploy-build.env` on VM after build.

**Why tar instead of git pull on VM?**

- VM does not need git credentials.
- Exact copy of what’s in the branch; excludes `node_modules`, `.env`, `backend.env`.

**Why prune Docker before build?**

- Small GCP disks fill up with old images/layers → `no space left on device`.

---

## 5. GitHub Secrets (Actions)

Set in: **GitHub repo → Settings → Secrets and variables → Actions**.

| Secret | Example | Why |
|--------|---------|-----|
| `GCP_VM_HOST` | `35.207.226.82` or `voice.genaiforge.in` | Where to SSH. Use **static** GCP IP so it never changes. |
| `GCP_VM_USER` | `genaiforgex` | Linux user that owns `~/.ssh/authorized_keys` on VM. |
| `GCP_VM_SSH_PRIVATE_KEY` | contents of `github-deploy-care` | Lets Actions log in without a password. |
| `GCP_VM_SSH_PRIVATE_KEY_B64` | (optional) base64 of same key | Use if pasting key in UI breaks newlines. |
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | Baked into React at **build** time. |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Public anon key for browser (still use RLS in Supabase). |
| `VITE_API_BASE_URL` | *(leave empty)* | Empty = same-origin `/voice` via nginx. **Recommended.** |

**Set private key safely (preserves newlines):**

```bash
gh auth login
REPO=YOUR_ORG/YOUR_REPO

gh secret set GCP_VM_USER --body "genaiforgex" --repo "$REPO"
gh secret set GCP_VM_HOST --body "YOUR_STATIC_IP" --repo "$REPO"
gh secret set GCP_VM_SSH_PRIVATE_KEY < ./github-deploy-care --repo "$REPO"

gh secret set VITE_SUPABASE_URL --body "https://YOUR.supabase.co" --repo "$REPO"
gh secret set VITE_SUPABASE_ANON_KEY --body "YOUR_ANON_KEY" --repo "$REPO"
```

**Do NOT put in secrets:** `service_role` key, LiveKit secret, JWT secret — those stay in VM `backend.env` only.

---

## 6. Do’s and Don’ts

### Do

| Do | Why |
|----|-----|
| Use a **deploy-only** SSH key (no passphrase) for CI | Actions cannot type a passphrase |
| Reserve a **static external IP** on the GCP VM | Ephemeral IP breaks `GCP_VM_HOST` and DNS |
| Keep `backend.env` **only on the VM** | Server secrets must not be in git or frontend bundle |
| Bind Docker frontend to **`127.0.0.1:8081:80`** | Public traffic goes through host nginx + HTTPS |
| Set `CORS_ORIGINS=https://your-domain` after HTTPS | Browser blocks API if origin mismatch |
| Disable unused services that grab **port 443** (e.g. `livekit-docker.service`) | Only one process can listen on 443 |
| Run `docker compose -p livekit down` with correct **project name** if stopping LiveKit stack | Wrong folder → “No resource found” |
| Test SSH from laptop before blaming GitHub | `ssh -i ./github-deploy-care USER@IP 'echo OK'` |

### Don’t

| Don’t | Why |
|-------|-----|
| Commit `.pem`, `github-deploy-care`, or `backend.env` | Anyone with repo access owns your server |
| Paste private key in GitHub UI without care | Often **strips newlines** → `Invalid private key` |
| Put `from="YOUR_HOME_IP"` on deploy key in `authorized_keys` | Works from home, **fails from GitHub** runners |
| Publish backend on `0.0.0.0:8080` on the host | Exposes API without going through nginx |
| Use `http://` in production for mic/WebRTC | `getUserMedia` needs **HTTPS** (or localhost) |
| Run `certbot --nginx` while **Caddy** still holds 443 | Certbot cannot bind 443 |
| Re-run old failed workflow jobs expecting new YAML | Old runs use old workflow file — push fix + **new run** |

---

## 7. One-time setup: GCP VM

### 7.1 Create VM

- Ubuntu LTS, boot disk **≥ 30 GB** (Docker builds eat space).
- Note **external IP** → reserve as **static** in GCP → VPC → IP addresses.

### 7.2 Firewall (GCP)

| Port | Purpose |
|------|---------|
| **22** | SSH (GitHub deploy + you) |
| **80** | HTTP (redirect + Let’s Encrypt challenge) |
| **443** | HTTPS |

### 7.3 Install Docker on VM

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin
sudo usermod -aG docker "$USER"
newgrp docker   # or log out and back in
```

**Why:** Deploy workflow runs `docker compose` on the VM.

### 7.4 Create app secrets on VM

```bash
mkdir -p ~/supabase_app/deploy
nano ~/supabase_app/deploy/backend.env
```

Copy from `platform/api/.env.example`. Minimum for production:

```env
APP_BASE_URL=https://voice.genaiforge.in
CORS_ORIGINS=https://voice.genaiforge.in

LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...

SUPABASE_URL=https://YOUR.supabase.co
SUPABASE_JWT_SECRET=...
SUPABASE_JWT_ISSUER=https://YOUR.supabase.co/auth/v1
SUPABASE_SERVICE_ROLE_KEY=...
```

**Why `CORS_ORIGINS` must match your HTTPS URL:** Browser sends `Origin: https://voice.genaiforge.in`; FastAPI rejects others.

### 7.5 SSH key for GitHub Actions

On **your laptop**:

```bash
ssh-keygen -t ed25519 -f ./github-deploy-care -C "github-actions-deploy" -N ""
```

On **VM** (as `GCP_VM_USER`):

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
# Paste ONE line from github-deploy-care.pub:
cat >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

**Important:** No `from="..."` restriction on that line.

Test:

```bash
ssh -i ./github-deploy-care genaiforgex@YOUR_STATIC_IP 'echo OK'
```

Then add secrets to GitHub (section 5).

### 7.6 Stop conflicting services on 443

If you had LiveKit on the same VM:

```bash
cd ~/livekit/livekit.genaiforge.in   # path may differ
docker compose -p livekit down

# Prevent auto-restart on boot:
sudo systemctl disable --now livekit-docker.service
systemctl is-enabled livekit-docker.service   # should say disabled
```

**Why:** Host nginx + Certbot need port **443** free.

---

## 8. Domain mapping (DNS → VM)

**Goal:** `voice.genaiforge.in` opens your app.

### 8.1 At your DNS provider (where `genaiforge.in` is managed)

Add an **A record**:

| Type | Name / Host | Value | TTL |
|------|-------------|-------|-----|
| **A** | `voice` | `YOUR_VM_STATIC_IP` | 300 |

Result: `voice.genaiforge.in` → VM IP.

**Why A record?** Maps hostname to IPv4. (Use AAAA only if you have IPv6 on the VM.)

### 8.2 Verify DNS

```bash
dig +short voice.genaiforge.in
# Must print YOUR_VM_STATIC_IP
```

Wait a few minutes after saving DNS.

### 8.3 GCP

- VM must have that **static** IP attached.
- Firewall must allow **80** and **443** to the VM.

**Why static IP?** If the VM gets a new IP after stop/start, DNS and `GCP_VM_HOST` secret would point to the wrong place.

---

## 9. Host nginx + HTTPS (Let’s Encrypt)

Do this **after** Docker app runs and LiveKit (or other) is **not** on 443.

### 9.1 Install nginx + certbot on VM

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
sudo systemctl enable --now nginx
```

### 9.2 Host nginx site (HTTP first)

Create `/etc/nginx/sites-available/voice.genaiforge.in`:

```nginx
server {
    listen 80;
    server_name voice.genaiforge.in;

    location / {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable:

```bash
sudo ln -sf /etc/nginx/sites-available/voice.genaiforge.in /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

**Why port 8081?** Matches `docker-compose.yml`: `127.0.0.1:8081:80`.

Test: `http://voice.genaiforge.in/studio` should load (no 502).

### 9.3 Get SSL certificate

```bash
sudo certbot --nginx -d voice.genaiforge.in
```

Choose **redirect HTTP → HTTPS**.

```bash
sudo certbot renew --dry-run
```

**Why Certbot on host nginx?** Free auto-renew; browsers trust Let’s Encrypt.

### 9.4 Update backend CORS to HTTPS

```bash
sed -i 's|^CORS_ORIGINS=.*|CORS_ORIGINS=https://voice.genaiforge.in|' ~/supabase_app/deploy/backend.env
cd ~/supabase_app/deploy && docker compose up -d
```

### 9.5 Verify

- `https://voice.genaiforge.in/` — padlock valid
- `https://voice.genaiforge.in/health` — `{"status":"ok"}`
- Mic on demo page works (HTTPS required)

---

## 10. Day-to-day: how you deploy

1. Work on a branch → open PR to `supabase_Bass`.
2. CI runs (build must pass).
3. Merge PR → push to `supabase_Bass` → **Deploy** workflow runs automatically.
4. Or: Actions → **Deploy Supabase app (GCP VM)** → **Run workflow**.

**You do NOT** SSH to run deploy manually unless debugging.

**VM `backend.env` changes** (new LiveKit key, etc.): edit on VM, then:

```bash
cd ~/supabase_app/deploy && docker compose up -d
```

No GitHub push needed for env-only changes.

---

## 11. Branch protection (deploy only via merge)

GitHub → **Settings → Branches → Add rule** for `supabase_Bass`:

- Require pull request before merging
- Require status checks: **Supabase app CI** jobs

**Why:** Actions deploy on **push**; protection ensures pushes happen via merged PRs.

---

## 12. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|----------------|-----|
| `Permission denied (publickey)` | Wrong user/key/host; broken secret newlines | `gh secret set GCP_VM_SSH_PRIVATE_KEY < ./github-deploy-care`; test `ssh -i key user@ip` |
| `Invalid private key` | UI paste broke PEM | Use `gh secret set ... < file` or `GCP_VM_SSH_PRIVATE_KEY_B64` |
| `Connection timed out` on port 22 | GCP firewall blocks SSH | Allow TCP 22; check IP |
| `rsync: command not found` | Old workflow | Current workflow uses **tar** — pull latest YAML |
| `no space left on device` | VM disk full | `docker system prune -af`; resize GCP disk to 50GB+ |
| `address already in use` on 8081 | Old container or wrong port | `docker compose down`; match nginx `proxy_pass` to `docker ps` port |
| **502 Bad Gateway** | Host nginx → wrong port | `docker ps` shows `127.0.0.1:8081->80`; set `proxy_pass http://127.0.0.1:8081` |
| HTTPS won’t load | Something else on **443** | `sudo ss -ltnp \| grep :443`; stop Caddy/LiveKit; disable `livekit-docker.service` |
| LiveKit containers keep coming back | systemd unit | `sudo systemctl disable --now livekit-docker.service` |
| `docker compose down` “No resource found” | Wrong project name | `docker compose -p livekit down` from correct folder |
| Mic: `getUserMedia` undefined | Using **http://** on public domain | Use **https://** |
| CORS errors in browser | `CORS_ORIGINS` still `http://` | Set `https://voice.genaiforge.in` in `backend.env` |

**Useful commands on VM:**

```bash
docker ps
sudo ss -ltnp | grep -E ':80|:443|:8081'
df -h /
sudo nginx -t
sudo tail -n 50 /var/log/nginx/error.log
cd ~/supabase_app/deploy && docker compose logs -f --tail=100
```

---

## 13. Checklist for a **new project** (copy this)

### Repo

- [ ] Add `supabase_app/deploy/docker-compose.yml`, Dockerfiles, `nginx.conf`
- [ ] Add `.github/workflows/supabase-app-ci.yml` (build/test)
- [ ] Add `.github/workflows/deploy-supabase-gcp-vm.yml` (SSH deploy)
- [ ] `.gitignore`: `backend.env`, `.env`, `node_modules`, `dist`

### GCP

- [ ] VM with static IP, disk ≥ 30GB
- [ ] Firewall: 22, 80, 443
- [ ] Docker + compose plugin installed
- [ ] `~/YOUR_APP/deploy/backend.env` created on VM

### DNS

- [ ] A record: `subdomain.yourdomain.com` → static IP
- [ ] `dig +short` confirms IP

### HTTPS

- [ ] Nothing else on port 443
- [ ] Host nginx → `127.0.0.1:HOST_PORT` (match compose)
- [ ] `certbot --nginx -d subdomain.yourdomain.com`
- [ ] `CORS_ORIGINS=https://subdomain.yourdomain.com`

### GitHub

- [ ] Secrets: `GCP_VM_*`, `VITE_SUPABASE_*`
- [ ] Deploy key tested: `ssh -i key user@ip 'echo OK'`
- [ ] Branch protection on deploy branch (optional)

### First deploy

- [ ] Push to deploy branch → Actions green
- [ ] `https://subdomain.yourdomain.com/health` OK

---

## 14. Quick reference — this project

| Item | Value |
|------|--------|
| Production URL | `https://voice.genaiforge.in` |
| Deploy branch | `supabase_Bass` |
| VM app path | `~/supabase_app/deploy` |
| Docker frontend port (host) | `127.0.0.1:8081` |
| GitHub repo (example) | `vikas972/care` |
| Deploy workflow | `.github/workflows/deploy-supabase-gcp-vm.yml` |
| CI workflow | `.github/workflows/supabase-app-ci.yml` |

---

## 15. Rotate SSH deploy key (summary)

1. `ssh-keygen -t ed25519 -f ./github-deploy-care-new -N ""`
2. Append `.pub` to VM `~/.ssh/authorized_keys`
3. `ssh -i ./github-deploy-care-new user@ip 'echo OK'`
4. `gh secret set GCP_VM_SSH_PRIVATE_KEY < ./github-deploy-care-new --repo ORG/REPO`
5. Re-run deploy workflow

---

*Last updated for: tar-over-SSH deploy, host nginx on 8081, HTTPS via Certbot, LiveKit systemd disable, `voice.genaiforge.in`.*
