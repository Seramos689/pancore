const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// API
app.use('/api', apiRoutes);

// Static frontend
app.use(express.static(path.join(__dirname, 'public')));

// SPA-style fallback for HTML pages
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const file = path.join(__dirname, 'public', req.path === '/' ? 'index.html' : req.path);
  res.sendFile(file, (err) => {
    if (err) res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 PANCORE running at http://localhost:${PORT}`);
  console.log(`   User site:  http://localhost:${PORT}/`);
  console.log(`   Admin:      http://localhost:${PORT}/admin-login.html`);
  console.log(`   Default admin: admin / admin123\n`);
});
