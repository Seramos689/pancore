const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'pancore_change_this_secret_in_production_2026';

function signUser(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: 'user' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function signAdmin() {
  return jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '1d' });
}

function authUser(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'user') return res.status(401).json({ success: false, message: 'Unauthorized' });
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired session' });
  }
}

function authAdmin(req, res, next) {
  const token = req.cookies?.adminToken || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ success: false, message: 'Admin unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(401).json({ success: false, message: 'Admin unauthorized' });
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid admin session' });
  }
}

function isValidPassword(password) {
  if (!password || password.length < 6) return false;
  return (
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  );
}

module.exports = { JWT_SECRET, signUser, signAdmin, authUser, authAdmin, isValidPassword };
