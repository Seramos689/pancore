const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const store = require('../data/store');
const { signUser, signAdmin, authUser, authAdmin, isValidPassword } = require('../middleware/auth');

const router = express.Router();
const MIN_ACTIVATION_DEPOSIT = 25;

function getTotalDeposited(user) {
  if (user.totalDeposited != null && user.totalDeposited !== undefined) {
    return Number(user.totalDeposited) || 0;
  }
  return (user.transactions || [])
    .filter(t => t.type === 'deposit' && t.status === 'completed')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
}

function isAccountActivated(user) {
  if (user.activated === true) return true;
  return getTotalDeposited(user) >= MIN_ACTIVATION_DEPOSIT;
}

async function applyDepositCredit(userId, amount) {
  const user = await store.findUserById(userId);
  if (!user) return null;
  const amt = Number(amount) || 0;
  const balance = Number(user.balance || 0) + amt;
  let totalDeposited;
  if (user.totalDeposited == null || user.totalDeposited === undefined) {
    totalDeposited = (user.transactions || [])
      .filter(t => t.type === 'deposit' && t.status === 'completed')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    if (totalDeposited < amt) totalDeposited += amt;
  } else {
    totalDeposited = Number(user.totalDeposited) + amt;
  }
  const activated = totalDeposited >= MIN_ACTIVATION_DEPOSIT ? true : !!user.activated;
  return store.updateUser(userId, { balance, totalDeposited, activated });
}

async function resolveUser(reqUser) {
  if (!reqUser) return null;
  let user = await store.findUserById(reqUser.id);
  if (!user && reqUser.email) user = await store.findUserByEmail(reqUser.email);
  return user;
}

// ---------- Register ----------
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

    if (await store.findUserByEmail(email)) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }
    const existingUser = await store.findUserByLogin(username);
    if (existingUser && existingUser.username.toLowerCase() === username.toLowerCase()) {
      return res.status(400).json({ success: false, message: 'Username already taken.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    await store.createUser({
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
      totalDeposited: 0,
      activated: false,
      verified: true,
      active: true,
      createdAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Registration successful! You can now log in.',
      email: email.trim().toLowerCase()
    });
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Email or username already exists.' });
    }
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// ---------- Login ----------
router.post('/login', async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;
    if (!emailOrUsername || !password) {
      return res.status(400).json({ success: false, message: 'Email/Username and password required.' });
    }

    const user = await store.findUserByLogin(emailOrUsername);
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
router.get('/me', authUser, async (req, res) => {
  try {
    const user = await resolveUser(req.user);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please log in again.'
      });
    }
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
        verified: user.verified,
        activated: isAccountActivated(user),
        totalDeposited: getTotalDeposited(user),
        minActivationDeposit: MIN_ACTIVATION_DEPOSIT
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ---------- Profile ----------
router.put('/profile', authUser, async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;
    const user = await store.updateUser(req.user.id, {
      firstName: (firstName || '').trim(),
      lastName: (lastName || '').trim(),
      phone: (phone || '').trim()
    });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({
      success: true,
      message: 'Profile updated.',
      user: { firstName: user.firstName, lastName: user.lastName, phone: user.phone }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ---------- Reset password ----------
router.post('/reset/send-code', authUser, async (req, res) => {
  try {
    const user = await resolveUser(req.user);
    if (!user) return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
    const code = uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase();
    await store.updateUser(user.id, { recoveryCode: code, recoveryExpires: Date.now() + 15 * 60 * 1000 });
    console.log(`[PANCORE] Recovery code for ${user.email}: ${code}`);
    res.json({ success: true, message: 'Recovery code sent.', demoToken: code });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.post('/reset/confirm', authUser, async (req, res) => {
  try {
    const { code, newPassword, confirmPassword } = req.body;
    const user = await resolveUser(req.user);
    if (!user) return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
    if (!user.recoveryCode || user.recoveryCode !== (code || '').trim().toUpperCase()) {
      return res.status(400).json({ success: false, message: 'Invalid recovery code.' });
    }
    if (user.recoveryExpires && Date.now() > user.recoveryExpires) {
      return res.status(400).json({ success: false, message: 'Code expired.' });
    }
    if (!isValidPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters with upper, lower, number and symbol.'
      });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await store.updateUser(user.id, {
      password: hashed,
      recoveryCode: undefined,
      recoveryExpires: undefined
    });
    res.json({ success: true, message: 'Password reset successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ---------- Recharge ----------
router.post('/recharge', authUser, async (req, res) => {
  try {
    const code = (req.body.code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ success: false, message: 'Enter a recharge code.' });

    const user = await resolveUser(req.user);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please log in again.'
      });
    }

    if (!isAccountActivated(user)) {
      return res.status(403).json({
        success: false,
        message: 'Please activate your account by depositing in your account',
        needsActivation: true,
        minDeposit: MIN_ACTIVATION_DEPOSIT
      });
    }

    const found = await store.findCode(code);
    if (!found) return res.status(400).json({ success: false, message: 'Invalid recharge code.' });
    if (found.used) return res.status(400).json({ success: false, message: 'This code has already been used.' });

    await store.updateCode(code, {
      used: true,
      usedBy: user.email,
      usedAt: new Date().toISOString()
    });

    const amount = Number(found.price);
    const transactions = user.transactions || [];
    transactions.unshift({
      id: uuidv4(),
      type: 'recharge',
      amount,
      status: 'completed',
      code: found.code,
      date: new Date().toISOString()
    });
    const balance = Number(user.balance || 0) + amount;
    await store.updateUser(user.id, { balance, transactions });

    await store.addNotification('recharge', `User ${user.email} recharged $${amount} with code ${code}`, {
      userId: user.id, amount
    });

    res.json({ success: true, message: `$${amount.toFixed(2)} added to your account.`, balance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ---------- Deposit ----------
router.post('/deposit', authUser, async (req, res) => {
  try {
    const amount = parseFloat(req.body.amount);
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Invalid amount.' });

    const user = await resolveUser(req.user);
    if (!user) return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });

    const transactions = user.transactions || [];
    transactions.unshift({
      id: uuidv4(),
      type: 'deposit',
      amount,
      status: 'pending',
      date: new Date().toISOString()
    });
    await store.updateUser(user.id, { transactions });

    await store.createDeposit({
      id: uuidv4(),
      userId: user.id,
      email: user.email,
      username: user.username,
      amount,
      status: 'pending',
      date: new Date().toISOString()
    });

    await store.addNotification('deposit', `Deposit request of $${amount.toFixed(2)} from ${user.email}`, {
      userId: user.id, amount, status: 'pending'
    });

    const settings = await store.getSettings();
    res.json({
      success: true,
      message: 'Deposit request submitted.',
      btcWallet: settings.btcWallet,
      amount
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ---------- Withdraw ----------
router.post('/withdraw', authUser, async (req, res) => {
  try {
    const amount = parseFloat(req.body.amount);
    const wallet = (req.body.wallet || '').trim();
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Invalid amount.' });
    if (!wallet || wallet.length < 20) return res.status(400).json({ success: false, message: 'Invalid BTC wallet.' });

    const user = await resolveUser(req.user);
    if (!user) return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
    if (amount > Number(user.balance || 0)) {
      return res.status(400).json({ success: false, message: 'Insufficient balance.' });
    }

    const balance = Number(user.balance || 0) - amount;
    const transactions = user.transactions || [];
    transactions.unshift({
      id: uuidv4(),
      type: 'withdraw',
      amount,
      status: 'pending',
      wallet,
      date: new Date().toISOString()
    });
    await store.updateUser(user.id, { balance, transactions });

    await store.createWithdraw({
      id: uuidv4(),
      userId: user.id,
      email: user.email,
      username: user.username,
      amount,
      wallet,
      status: 'pending',
      date: new Date().toISOString()
    });

    await store.addNotification('withdraw', `Withdraw request of $${amount.toFixed(2)} from ${user.email}`, {
      userId: user.id, amount
    });

    res.json({ success: true, message: 'Withdrawal initiated.', balance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ---------- Support ----------
router.post('/support', authUser, async (req, res) => {
  try {
    const { subject, message } = req.body;
    if (!subject || !message) return res.status(400).json({ success: false, message: 'Subject and message required.' });
    const user = await resolveUser(req.user);
    await store.createMessage({
      id: uuidv4(),
      userId: user?.id,
      email: user?.email,
      username: user?.username,
      subject: subject.trim(),
      message: message.trim(),
      date: new Date().toISOString(),
      read: false
    });
    await store.addNotification('support', `Support message from ${user?.email}: ${subject}`);
    res.json({ success: true, message: 'Message sent.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.get('/contact', async (req, res) => {
  try {
    const s = await store.getSettings();
    res.json({
      success: true,
      contact: {
        email: s.contactEmail || '',
        phone: s.contactPhone || '',
        address: s.contactAddress || ''
      },
      btcWallet: s.btcWallet
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ==================== ADMIN ====================

router.post('/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    let settings = await store.getSettings();

    if (!settings.adminPasswordHash) {
      settings = await store.saveSettings({
        adminUsername: 'admin',
        adminPasswordHash: await bcrypt.hash('admin123', 10)
      });
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.post('/admin/logout', (req, res) => {
  res.clearCookie('adminToken');
  res.json({ success: true });
});

router.get('/admin/users', authAdmin, async (req, res) => {
  try {
    const users = (await store.getUsers()).map(u => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      username: u.username,
      email: u.email,
      balance: u.balance || 0,
      active: u.active !== false,
      verified: !!u.verified,
      activated: isAccountActivated(u),
      createdAt: u.createdAt
    }));
    res.json({ success: true, users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.post('/admin/users', authAdmin, async (req, res) => {
  try {
    const { firstName, lastName, username, email, password, balance } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'Username, email and password required.' });
    }
    if (await store.findUserByEmail(email)) {
      return res.status(400).json({ success: false, message: 'Email already exists.' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await store.createUser({
      id: uuidv4(),
      firstName: firstName || '',
      lastName: lastName || '',
      username,
      email: email.toLowerCase(),
      phone: '',
      country: '',
      countryCode: '',
      password: hashed,
      balance: Number(balance) || 0,
      transactions: [],
      totalDeposited: Number(balance) || 0,
      activated: Number(balance) >= MIN_ACTIVATION_DEPOSIT,
      verified: true,
      active: true,
      createdAt: new Date().toISOString()
    });
    res.json({ success: true, user: { id: user.id, username: user.username, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.post('/admin/users/:id/toggle', authAdmin, async (req, res) => {
  try {
    const user = await store.findUserById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    const updated = await store.updateUser(user.id, { active: user.active === false });
    res.json({ success: true, active: updated.active });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.delete('/admin/users/:id', authAdmin, async (req, res) => {
  try {
    await store.deleteUser(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.post('/admin/funds', authAdmin, async (req, res) => {
  try {
    const { userId, amount } = req.body;
    const amt = parseFloat(amount);
    if (!userId || !amt || amt <= 0) return res.status(400).json({ success: false, message: 'Invalid input.' });
    const user = await store.findUserById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const transactions = user.transactions || [];
    transactions.unshift({
      id: uuidv4(),
      type: 'deposit',
      amount: amt,
      status: 'completed',
      date: new Date().toISOString(),
      note: 'Admin credit'
    });
    await store.updateUser(userId, { transactions });
    const updated = await applyDepositCredit(userId, amt);
    res.json({ success: true, balance: updated.balance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.get('/admin/deposits', authAdmin, async (req, res) => {
  try {
    res.json({ success: true, deposits: await store.getDeposits() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.post('/admin/deposits/:id/approve', authAdmin, async (req, res) => {
  try {
    const reqItem = await store.findDeposit(req.params.id);
    if (!reqItem || reqItem.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Invalid request.' });
    }
    await store.updateDeposit(reqItem.id, { status: 'approved' });

    const user = await store.findUserById(reqItem.userId);
    if (user) {
      const transactions = (user.transactions || []).map(t => {
        if (t.type === 'deposit' && t.amount === reqItem.amount && t.status === 'pending') {
          return { ...t, status: 'completed' };
        }
        return t;
      });
      await store.updateUser(user.id, { transactions });
      await applyDepositCredit(user.id, reqItem.amount);
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.post('/admin/deposits/:id/reject', authAdmin, async (req, res) => {
  try {
    const reqItem = await store.findDeposit(req.params.id);
    if (!reqItem || reqItem.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Invalid request.' });
    }
    await store.updateDeposit(reqItem.id, { status: 'rejected' });
    const user = await store.findUserById(reqItem.userId);
    if (user && user.transactions) {
      const transactions = user.transactions.map(t => {
        if (t.type === 'deposit' && t.amount === reqItem.amount && t.status === 'pending') {
          return { ...t, status: 'rejected' };
        }
        return t;
      });
      await store.updateUser(user.id, { transactions });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.get('/admin/withdraws', authAdmin, async (req, res) => {
  try {
    res.json({ success: true, withdraws: await store.getWithdraws() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.post('/admin/withdraws/:id/approve', authAdmin, async (req, res) => {
  try {
    const reqItem = await store.findWithdraw(req.params.id);
    if (!reqItem || reqItem.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Invalid request.' });
    }
    await store.updateWithdraw(reqItem.id, { status: 'approved' });
    const user = await store.findUserById(reqItem.userId);
    if (user && user.transactions) {
      const transactions = user.transactions.map(t => {
        if (t.type === 'withdraw' && t.amount === reqItem.amount && t.status === 'pending') {
          return { ...t, status: 'completed' };
        }
        return t;
      });
      await store.updateUser(user.id, { transactions });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.post('/admin/withdraws/:id/reject', authAdmin, async (req, res) => {
  try {
    const reqItem = await store.findWithdraw(req.params.id);
    if (!reqItem || reqItem.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Invalid request.' });
    }
    await store.updateWithdraw(reqItem.id, { status: 'rejected' });
    const user = await store.findUserById(reqItem.userId);
    if (user) {
      const balance = Number(user.balance || 0) + Number(reqItem.amount);
      const transactions = (user.transactions || []).map(t => {
        if (t.type === 'withdraw' && t.amount === reqItem.amount && t.status === 'pending') {
          return { ...t, status: 'rejected' };
        }
        return t;
      });
      await store.updateUser(user.id, { balance, transactions });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.get('/admin/codes', authAdmin, async (req, res) => {
  try {
    res.json({ success: true, codes: await store.getCodes() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.post('/admin/codes', authAdmin, async (req, res) => {
  try {
    const { code, price, count } = req.body;
    const priceNum = parseFloat(price);
    if (!priceNum || priceNum <= 0) return res.status(400).json({ success: false, message: 'Invalid price.' });

    const created = [];
    const n = Math.min(Math.max(parseInt(count, 10) || 1, 1), 50);
    for (let i = 0; i < n; i++) {
      const c = (code && n === 1)
        ? String(code).trim().toUpperCase()
        : uuidv4().replace(/-/g, '').slice(0, 12).toUpperCase();
      const item = await store.createCode({
        id: uuidv4(),
        code: c,
        price: priceNum,
        used: false,
        createdAt: new Date().toISOString()
      });
      created.push(item);
    }
    res.json({ success: true, codes: created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.delete('/admin/codes/:id', authAdmin, async (req, res) => {
  try {
    await store.deleteCode(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.get('/admin/messages', authAdmin, async (req, res) => {
  try {
    res.json({ success: true, messages: await store.getMessages() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.get('/admin/notifications', authAdmin, async (req, res) => {
  try {
    res.json({ success: true, notifications: await store.getNotifications() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.get('/admin/settings', authAdmin, async (req, res) => {
  try {
    const s = await store.getSettings();
    res.json({
      success: true,
      settings: {
        btcWallet: s.btcWallet,
        contactEmail: s.contactEmail,
        contactPhone: s.contactPhone,
        contactAddress: s.contactAddress
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.put('/admin/settings', authAdmin, async (req, res) => {
  try {
    const { btcWallet, contactEmail, contactPhone, contactAddress } = req.body;
    const s = await store.saveSettings({
      btcWallet: btcWallet || '',
      contactEmail: contactEmail || '',
      contactPhone: contactPhone || '',
      contactAddress: contactAddress || ''
    });
    res.json({ success: true, settings: s });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
