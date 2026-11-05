const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const store = require('../data/store');
const { signUser, signAdmin, authUser, authAdmin, isValidPassword } = require('../middleware/auth');

const router = express.Router();

// ---------- Auth: Register ----------
router.post('/register', async (req, res) => {
  try {
    const {
      firstName, lastName, username, email, phone,
      country, countryCode, password, confirmPassword, terms
    } = req.body;

    if (!firstName || !lastName || !username || !email || !phone || !country || !countryCode || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    if (!terms) return res.status(400).json({ success: false, message: 'You must agree to the Terms and Conditions.' });
    if (password !== confirmPassword) return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    if (!isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters and include uppercase, lowercase, number, and a symbol.'
      });
    }

    const users = store.getUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Username already taken.' });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = {
      id: uuidv4(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      username: username.trim(),
      email: email.trim().toLowerCase(),
      phone: `${countryCode} ${phone.trim()}`,
      country,
      countryCode,
      password: hashed,
      balance: 0,
      transactions: [],
      verified: true, // no email service — account active immediately
      active: true,
      createdAt: new Date().toISOString()
    };

    users.push(user);
    store.saveUsers(users);

    res.json({
      success: true,
      message: 'Registration successful! You can now log in.',
      email: user.email
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// ---------- Verify ----------
router.post('/verify', (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ success: false, message: 'Email and code required.' });

    const users = store.getUsers();
    const user = users.find(u => u.email === email.toLowerCase());
    if (!user) return res.status(400).json({ success: false, message: 'User not found.' });
    if (user.verified) return res.json({ success: true, message: 'Already verified.' });
    if (user.verifyExpires && Date.now() > user.verifyExpires) {
      return res.status(400).json({ success: false, message: 'Code expired. Register again or resend.' });
    }
    if (user.verifyCode !== code.trim().toUpperCase()) {
      return res.status(400).json({ success: false, message: 'Invalid verification code.' });
    }

    user.verified = true;
    delete user.verifyCode;
    delete user.verifyExpires;
    store.saveUsers(users);
    res.json({ success: true, message: 'Email verified successfully! You can now log in.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.post('/resend-code', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email required.' });
  const users = store.getUsers();
  const user = users.find(u => u.email === email.toLowerCase());
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  if (user.verified) return res.status(400).json({ success: false, message: 'Already verified.' });

  const code = uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase();
  user.verifyCode = code;
  user.verifyExpires = Date.now() + 60 * 60 * 1000;
  store.saveUsers(users);
  console.log(`[PANCORE] New verification code for ${user.email}: ${code}`);
  res.json({ success: true, message: 'New code sent.', demoToken: code });
});

// ---------- Login ----------
router.post('/login', async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;
    if (!emailOrUsername || !password) {
      return res.status(400).json({ success: false, message: 'Email/Username and password required.' });
    }

    const user = store.findUser(
      u => u.email === emailOrUsername.toLowerCase() || u.username.toLowerCase() === emailOrUsername.toLowerCase()
    );
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ success: false, message: 'Invalid credentials.' });

    if (user.active === false) {
      return res.status(403).json({ success: false, message: 'Your account has been deactivated. Contact support.' });
    }

    const token = signUser(user);
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });

    res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
        phone: user.phone,
        country: user.country,
        balance: user.balance || 0
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out.' });
});

// ---------- Me ----------
router.get('/me', authUser, (req, res) => {
  const user = store.findUserById(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  res.json({
    success: true,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      email: user.email,
      phone: user.phone,
      country: user.country,
      balance: user.balance || 0,
      transactions: user.transactions || [],
      createdAt: user.createdAt,
      active: user.active !== false,
      verified: user.verified
    }
  });
});

// ---------- Profile ----------
router.put('/profile', authUser, (req, res) => {
  const { firstName, lastName, phone } = req.body;
  const user = store.updateUser(req.user.id, {
    firstName: (firstName || '').trim(),
    lastName: (lastName || '').trim(),
    phone: (phone || '').trim()
  });
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  res.json({ success: true, message: 'Profile updated.', user: { firstName: user.firstName, lastName: user.lastName, phone: user.phone } });
});

// ---------- Reset password ----------
router.post('/reset/send-code', authUser, (req, res) => {
  const user = store.findUserById(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  const code = uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase();
  store.updateUser(user.id, { recoveryCode: code, recoveryExpires: Date.now() + 15 * 60 * 1000 });
  console.log(`[PANCORE] Recovery code for ${user.email}: ${code}`);
  res.json({ success: true, message: 'Recovery code sent.', demoToken: code });
});

router.post('/reset/confirm', authUser, async (req, res) => {
  const { code, newPassword, confirmPassword } = req.body;
  const user = store.findUserById(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  if (!user.recoveryCode || user.recoveryCode !== (code || '').trim().toUpperCase()) {
    return res.status(400).json({ success: false, message: 'Invalid recovery code.' });
  }
  if (user.recoveryExpires && Date.now() > user.recoveryExpires) {
    return res.status(400).json({ success: false, message: 'Code expired.' });
  }
  if (!isValidPassword(newPassword)) {
    return res.status(400).json({ success: false, message: 'Password does not meet requirements.' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'Passwords do not match.' });
  }
  const hashed = await bcrypt.hash(newPassword, 10);
  store.updateUser(user.id, { password: hashed, recoveryCode: undefined, recoveryExpires: undefined });
  res.json({ success: true, message: 'Password reset successfully.' });
});

// ---------- Recharge ----------
router.post('/recharge', authUser, (req, res) => {
  const code = (req.body.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ success: false, message: 'Enter a recharge code.' });

  const codes = store.getCodes();
  const found = codes.find(c => c.code === code);
  if (!found) return res.status(400).json({ success: false, message: 'Invalid recharge code.' });
  if (found.used) return res.status(400).json({ success: false, message: 'This code has already been used.' });

  const user = store.findUserById(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

  found.used = true;
  found.usedBy = user.email;
  found.usedAt = new Date().toISOString();
  store.saveCodes(codes);

  const amount = Number(found.price);
  user.balance = Number(user.balance || 0) + amount;
  if (!user.transactions) user.transactions = [];
  user.transactions.unshift({
    id: uuidv4(),
    type: 'recharge',
    amount,
    status: 'completed',
    code: found.code,
    date: new Date().toISOString()
  });
  store.updateUser(user.id, { balance: user.balance, transactions: user.transactions });

  store.addNotification('recharge', `User ${user.email} recharged $${amount} with code ${code}`, {
    userId: user.id, amount
  });

  res.json({ success: true, message: `$${amount.toFixed(2)} added to your account.`, balance: user.balance });
});

// ---------- Deposit ----------
router.post('/deposit', authUser, (req, res) => {
  const amount = parseFloat(req.body.amount);
  if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Invalid amount.' });

  const user = store.findUserById(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

  if (!user.transactions) user.transactions = [];
  user.transactions.unshift({
    id: uuidv4(),
    type: 'deposit',
    amount,
    status: 'pending',
    date: new Date().toISOString()
  });
  store.updateUser(user.id, { transactions: user.transactions });

  const deposits = store.getDeposits();
  deposits.unshift({
    id: uuidv4(),
    userId: user.id,
    email: user.email,
    username: user.username,
    amount,
    status: 'pending',
    date: new Date().toISOString()
  });
  store.saveDeposits(deposits);

  store.addNotification('deposit', `Deposit request of $${amount.toFixed(2)} from ${user.email}`, {
    userId: user.id, amount, status: 'pending'
  });

  const settings = store.getSettings();
  res.json({
    success: true,
    message: 'Deposit request submitted.',
    btcWallet: settings.btcWallet,
    amount
  });
});

// ---------- Withdraw ----------
router.post('/withdraw', authUser, (req, res) => {
  const amount = parseFloat(req.body.amount);
  const wallet = (req.body.wallet || '').trim();
  if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Invalid amount.' });
  if (!wallet || wallet.length < 20) return res.status(400).json({ success: false, message: 'Invalid BTC wallet.' });

  const user = store.findUserById(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  if (amount > Number(user.balance || 0)) {
    return res.status(400).json({ success: false, message: 'Insufficient balance.' });
  }

  user.balance = Number(user.balance || 0) - amount;
  if (!user.transactions) user.transactions = [];
  user.transactions.unshift({
    id: uuidv4(),
    type: 'withdraw',
    amount,
    status: 'pending',
    wallet,
    date: new Date().toISOString()
  });
  store.updateUser(user.id, { balance: user.balance, transactions: user.transactions });

  const withdraws = store.getWithdraws();
  withdraws.unshift({
    id: uuidv4(),
    userId: user.id,
    email: user.email,
    username: user.username,
    amount,
    wallet,
    status: 'pending',
    date: new Date().toISOString()
  });
  store.saveWithdraws(withdraws);

  store.addNotification('withdraw', `Withdraw request of $${amount.toFixed(2)} from ${user.email}`, {
    userId: user.id, amount
  });

  res.json({ success: true, message: 'Withdrawal initiated.', balance: user.balance });
});

// ---------- Support ----------
router.post('/support', authUser, (req, res) => {
  const { subject, message } = req.body;
  if (!subject || !message) return res.status(400).json({ success: false, message: 'Subject and message required.' });
  const user = store.findUserById(req.user.id);
  const msgs = store.getMessages();
  msgs.unshift({
    id: uuidv4(),
    userId: user?.id,
    email: user?.email,
    username: user?.username,
    subject: subject.trim(),
    message: message.trim(),
    date: new Date().toISOString(),
    read: false
  });
  store.saveMessages(msgs);
  store.addNotification('support', `Support message from ${user?.email}: ${subject}`);
  res.json({ success: true, message: 'Message sent.' });
});

router.get('/contact', (req, res) => {
  const s = store.getSettings();
  res.json({
    success: true,
    contact: {
      email: s.contactEmail || '',
      phone: s.contactPhone || '',
      address: s.contactAddress || ''
    },
    btcWallet: s.btcWallet
  });
});

// ==================== ADMIN ====================

router.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  const settings = store.getSettings();

  // Bootstrap default admin on first run
  if (!settings.adminPasswordHash) {
    settings.adminUsername = 'admin';
    settings.adminPasswordHash = await bcrypt.hash('admin123', 10);
    store.saveSettings(settings);
  }

  if (username !== settings.adminUsername) {
    return res.status(401).json({ success: false, message: 'Invalid credentials.' });
  }
  const ok = await bcrypt.compare(password, settings.adminPasswordHash);
  if (!ok) return res.status(401).json({ success: false, message: 'Invalid credentials.' });

  const token = signAdmin();
  res.cookie('adminToken', token, {
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });
  res.json({ success: true, token });
});

router.post('/admin/logout', (req, res) => {
  res.clearCookie('adminToken');
  res.json({ success: true });
});

router.get('/admin/users', authAdmin, (req, res) => {
  const users = store.getUsers().map(u => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    username: u.username,
    email: u.email,
    balance: u.balance || 0,
    active: u.active !== false,
    verified: !!u.verified,
    createdAt: u.createdAt
  }));
  res.json({ success: true, users });
});

router.post('/admin/users', authAdmin, async (req, res) => {
  const { firstName, lastName, username, email, password, balance } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ success: false, message: 'Username, email and password required.' });
  }
  const users = store.getUsers();
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ success: false, message: 'Email exists.' });
  }
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(400).json({ success: false, message: 'Username taken.' });
  }
  const hashed = await bcrypt.hash(password, 10);
  users.push({
    id: uuidv4(),
    firstName: firstName || '',
    lastName: lastName || '',
    username: username.trim(),
    email: email.trim().toLowerCase(),
    password: hashed,
    balance: Number(balance) || 0,
    transactions: [],
    verified: true,
    active: true,
    createdAt: new Date().toISOString()
  });
  store.saveUsers(users);
  res.json({ success: true, message: 'User created.' });
});

router.post('/admin/users/:id/toggle', authAdmin, (req, res) => {
  const user = store.findUserById(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'Not found.' });
  const active = user.active === false ? true : false;
  store.updateUser(user.id, { active });
  res.json({ success: true, active });
});

router.delete('/admin/users/:id', authAdmin, (req, res) => {
  let users = store.getUsers().filter(u => u.id !== req.params.id);
  store.saveUsers(users);
  res.json({ success: true });
});

router.post('/admin/funds', authAdmin, (req, res) => {
  const { userId, amount } = req.body;
  const amt = parseFloat(amount);
  if (!userId || !amt || amt <= 0) return res.status(400).json({ success: false, message: 'Invalid input.' });
  const user = store.findUserById(userId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  user.balance = Number(user.balance || 0) + amt;
  if (!user.transactions) user.transactions = [];
  user.transactions.unshift({
    id: uuidv4(), type: 'deposit', amount: amt, status: 'completed',
    date: new Date().toISOString(), note: 'Admin credit'
  });
  store.updateUser(user.id, { balance: user.balance, transactions: user.transactions });
  res.json({ success: true, balance: user.balance });
});

router.get('/admin/deposits', authAdmin, (req, res) => {
  res.json({ success: true, deposits: store.getDeposits() });
});

router.post('/admin/deposits/:id/approve', authAdmin, (req, res) => {
  const list = store.getDeposits();
  const reqItem = list.find(r => r.id === req.params.id);
  if (!reqItem || reqItem.status !== 'pending') {
    return res.status(400).json({ success: false, message: 'Invalid request.' });
  }
  reqItem.status = 'approved';
  store.saveDeposits(list);

  const user = store.findUserById(reqItem.userId);
  if (user) {
    user.balance = Number(user.balance || 0) + Number(reqItem.amount);
    if (user.transactions) {
      const tx = user.transactions.find(t => t.type === 'deposit' && t.amount === reqItem.amount && t.status === 'pending');
      if (tx) tx.status = 'completed';
    }
    store.updateUser(user.id, { balance: user.balance, transactions: user.transactions });
  }
  res.json({ success: true });
});

router.post('/admin/deposits/:id/reject', authAdmin, (req, res) => {
  const list = store.getDeposits();
  const reqItem = list.find(r => r.id === req.params.id);
  if (!reqItem || reqItem.status !== 'pending') {
    return res.status(400).json({ success: false, message: 'Invalid request.' });
  }
  reqItem.status = 'rejected';
  store.saveDeposits(list);
  const user = store.findUserById(reqItem.userId);
  if (user && user.transactions) {
    const tx = user.transactions.find(t => t.type === 'deposit' && t.amount === reqItem.amount && t.status === 'pending');
    if (tx) tx.status = 'rejected';
    store.updateUser(user.id, { transactions: user.transactions });
  }
  res.json({ success: true });
});

router.get('/admin/withdraws', authAdmin, (req, res) => {
  res.json({ success: true, withdraws: store.getWithdraws() });
});

router.post('/admin/withdraws/:id/approve', authAdmin, (req, res) => {
  const list = store.getWithdraws();
  const reqItem = list.find(r => r.id === req.params.id);
  if (!reqItem || reqItem.status !== 'pending') {
    return res.status(400).json({ success: false, message: 'Invalid request.' });
  }
  reqItem.status = 'approved';
  store.saveWithdraws(list);
  const user = store.findUserById(reqItem.userId);
  if (user && user.transactions) {
    const tx = user.transactions.find(t => t.type === 'withdraw' && t.amount === reqItem.amount && t.status === 'pending');
    if (tx) tx.status = 'completed';
    store.updateUser(user.id, { transactions: user.transactions });
  }
  res.json({ success: true });
});

router.post('/admin/withdraws/:id/reject', authAdmin, (req, res) => {
  const list = store.getWithdraws();
  const reqItem = list.find(r => r.id === req.params.id);
  if (!reqItem || reqItem.status !== 'pending') {
    return res.status(400).json({ success: false, message: 'Invalid request.' });
  }
  reqItem.status = 'rejected';
  store.saveWithdraws(list);
  const user = store.findUserById(reqItem.userId);
  if (user) {
    user.balance = Number(user.balance || 0) + Number(reqItem.amount);
    if (user.transactions) {
      const tx = user.transactions.find(t => t.type === 'withdraw' && t.amount === reqItem.amount && t.status === 'pending');
      if (tx) tx.status = 'rejected';
    }
    store.updateUser(user.id, { balance: user.balance, transactions: user.transactions });
  }
  res.json({ success: true });
});

router.get('/admin/codes', authAdmin, (req, res) => {
  res.json({ success: true, codes: store.getCodes() });
});

router.post('/admin/codes', authAdmin, (req, res) => {
  const price = parseFloat(req.body.price);
  const count = parseInt(req.body.count, 10) || 1;
  if (!price || price <= 0) return res.status(400).json({ success: false, message: 'Invalid price.' });
  if (count < 1 || count > 50) return res.status(400).json({ success: false, message: 'Count 1–50.' });

  const codes = store.getCodes();
  const created = [];
  for (let i = 0; i < count; i++) {
    const code = Array.from({ length: 3 }, () =>
      Math.random().toString(36).substring(2, 6).toUpperCase()
    ).join('-');
    const entry = { code, price, used: false, usedBy: null, usedAt: null, createdAt: new Date().toISOString() };
    codes.unshift(entry);
    created.push(entry);
  }
  store.saveCodes(codes);
  res.json({ success: true, created });
});

router.get('/admin/settings', authAdmin, (req, res) => {
  const s = store.getSettings();
  res.json({
    success: true,
    settings: {
      btcWallet: s.btcWallet || '',
      contactEmail: s.contactEmail || '',
      contactPhone: s.contactPhone || '',
      contactAddress: s.contactAddress || ''
    }
  });
});

router.put('/admin/settings', authAdmin, (req, res) => {
  const s = store.getSettings();
  if (req.body.btcWallet !== undefined) s.btcWallet = req.body.btcWallet.trim();
  if (req.body.contactEmail !== undefined) s.contactEmail = req.body.contactEmail.trim();
  if (req.body.contactPhone !== undefined) s.contactPhone = req.body.contactPhone.trim();
  if (req.body.contactAddress !== undefined) s.contactAddress = req.body.contactAddress.trim();
  store.saveSettings(s);
  res.json({ success: true });
});

router.get('/admin/notifications', authAdmin, (req, res) => {
  res.json({ success: true, notifications: store.getNotifications() });
});

router.get('/admin/messages', authAdmin, (req, res) => {
  res.json({ success: true, messages: store.getMessages() });
});

module.exports = router;
