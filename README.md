# PANCORE

Full-stack platform for converting mined BTC to cash.

## Requirements

- Node.js 18+
- MongoDB (local or [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) free tier)

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Recommended | Secret for JWT tokens |
| `NODE_ENV` | Optional | Set to `production` on Render |
| `PORT` | Optional | Default 3000 |

## Local setup

```bash
npm install
export MONGODB_URI="mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/pancore?retryWrites=true&w=majority"
export JWT_SECRET="your_random_secret"
npm start
```

## Deploy on Render

1. Push this repo to GitHub
2. Create a Web Service on Render
3. Build: `npm install`
4. Start: `node server.js`
5. Add environment variables:
   - `MONGODB_URI` = your Atlas connection string
   - `JWT_SECRET` = long random string
   - `NODE_ENV` = `production`

## Admin

- URL: `/admin-login.html`
- Default: `admin` / `admin123`

## Features

- User register / login (no email verification)
- Dashboard, recharge codes, deposit / withdraw (BTC)
- Account activation: min $25 deposit before recharge codes work
- Admin panel: users, funds, deposits, withdraws, codes, settings
- Data stored in MongoDB (persists on Render)
