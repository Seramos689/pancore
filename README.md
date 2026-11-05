# PANCORE – Full Stack Web App

Dark-blue platform to turn mined BTC into cash.

## Local run

```bash
npm install
npm start
```

Open http://localhost:3000  
Admin: http://localhost:3000/admin-login.html (`admin` / `admin123`)

---

## Deploy on Render (step by step)

### Option A – From your GitHub (recommended)

1. **Create a GitHub repo** and push this project:

```bash
cd PANCORE-app
git init
git add .
git commit -m "PANCORE full stack app"
# Create a new empty repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/pancore.git
git branch -M main
git push -u origin main
```

2. Go to [https://dashboard.render.com](https://dashboard.render.com) and sign in (GitHub login works).

3. Click **New +** → **Web Service**.

4. Connect the GitHub account if needed, then select the **pancore** repository.

5. Configure the service:

| Setting | Value |
|--------|--------|
| Name | `pancore` (or any name) |
| Region | Choose closest to you |
| Runtime | **Node** |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance type | **Free** |

6. **Environment variables** (click Advanced → Add Environment Variable):

| Key | Value |
|-----|--------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | any long random string (e.g. `pancore_secret_9f3k2m...`) |

7. Click **Create Web Service**.

8. Wait 1–3 minutes for the build. When status is **Live**, open the URL Render gives you (e.g. `https://pancore-xxxx.onrender.com`).

9. Admin panel: `https://YOUR-APP.onrender.com/admin-login.html`  
   Login: **admin** / **admin123** — change this after first login if possible.

### Option B – Blueprint (render.yaml)

If you push the included `render.yaml`:

1. Dashboard → **New +** → **Blueprint**
2. Select the repo
3. Render will read `render.yaml` and create the service

---

## Important notes on Render Free tier

- **Sleep**: Free services sleep after ~15 minutes of inactivity. First request after sleep can take 30–60 seconds.
- **Data**: The free plan filesystem is **ephemeral** — redeploys wipe `data/*.json`.  
  For real use, either:
  - Upgrade and add a **Persistent Disk** mounted at `./data`, or
  - Later switch storage to MongoDB Atlas / PostgreSQL (free tiers available).

---

## Project structure

```
PANCORE-app/
  server.js
  package.json
  render.yaml
  Procfile
  middleware/auth.js
  routes/api.js
  data/           # JSON persistence
  public/         # Frontend
```
