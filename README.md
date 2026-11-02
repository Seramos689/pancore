# PANCORE – Full Stack Web App

Dark-blue themed platform to convert mined BTC to cash.

## Features

- User registration, email verification, login
- Dashboard with balance, history, statement, support
- Recharge via one-time codes
- Deposit (BTC QR) → admin approval
- Withdraw → admin approval
- Admin panel: users, funds, deposits, withdraws, codes, settings, notifications

## Quick start (local)

```bash
cd PANCORE-app
npm install
npm start
```

Open http://localhost:3000

**Admin:** http://localhost:3000/admin-login.html  
Default: `admin` / `admin123`

## Deploy

Works on any Node host (Render, Railway, Heroku, VPS, etc.).

1. Set environment variables (optional but recommended):
   - `PORT` – default 3000
   - `JWT_SECRET` – strong random string
   - `NODE_ENV=production`

2. Ensure the `data/` folder is writable (JSON file storage).

### Example: Render / Railway

- Build: `npm install`
- Start: `npm start`
- Add a persistent disk for the `data/` directory if available

### Example: VPS

```bash
git clone <your-repo>
cd PANCORE-app
npm install --production
NODE_ENV=production JWT_SECRET=your_secret npm start
# or use pm2: pm2 start server.js --name pancore
```

## Project structure

```
PANCORE-app/
  server.js          # Express entry
  package.json
  middleware/auth.js
  routes/api.js      # All REST APIs
  data/              # JSON persistence (auto-created)
  public/            # Frontend HTML/CSS/JS
```

## Security notes for production

- Change `JWT_SECRET`
- Change default admin password after first login (or set `adminPasswordHash` in settings)
- Use HTTPS
- Consider moving from JSON files to MongoDB/PostgreSQL for high traffic
