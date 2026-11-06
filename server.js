const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || '';

app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

async function start() {
  if (!MONGODB_URI) {
    console.error('\n❌ MONGODB_URI is not set.');
    console.error('   Add your MongoDB Atlas connection string as an environment variable.\n');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  }

  const apiRoutes = require('./routes/api');
  app.use('/api', apiRoutes);

  app.use(express.static(path.join(__dirname, 'public')));

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
}

start();
