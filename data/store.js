const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname);
const FILES = {
  users: path.join(DATA_DIR, 'users.json'),
  rechargeCodes: path.join(DATA_DIR, 'recharge_codes.json'),
  depositRequests: path.join(DATA_DIR, 'deposit_requests.json'),
  withdrawRequests: path.join(DATA_DIR, 'withdraw_requests.json'),
  supportMessages: path.join(DATA_DIR, 'support_messages.json'),
  notifications: path.join(DATA_DIR, 'notifications.json'),
  settings: path.join(DATA_DIR, 'settings.json')
};

function ensureFile(file, defaultValue) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaultValue, null, 2));
  }
}

function read(file, fallback = []) {
  ensureFile(file, fallback);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function write(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Users
function getUsers() { return read(FILES.users, []); }
function saveUsers(users) { write(FILES.users, users); }
function findUser(predicate) { return getUsers().find(predicate); }
function findUserById(id) { return findUser(u => u.id === id); }
function updateUser(id, patch) {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx < 0) return null;
  users[idx] = { ...users[idx], ...patch };
  saveUsers(users);
  return users[idx];
}

// Recharge codes
function getCodes() { return read(FILES.rechargeCodes, []); }
function saveCodes(codes) { write(FILES.rechargeCodes, codes); }

// Deposit requests
function getDeposits() { return read(FILES.depositRequests, []); }
function saveDeposits(list) { write(FILES.depositRequests, list); }

// Withdraw requests
function getWithdraws() { return read(FILES.withdrawRequests, []); }
function saveWithdraws(list) { write(FILES.withdrawRequests, list); }

// Support
function getMessages() { return read(FILES.supportMessages, []); }
function saveMessages(list) { write(FILES.supportMessages, list); }

// Notifications
function getNotifications() { return read(FILES.notifications, []); }
function saveNotifications(list) { write(FILES.notifications, list); }
function addNotification(type, message, meta = {}) {
  const list = getNotifications();
  list.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    type, message, meta, read: false, date: new Date().toISOString()
  });
  saveNotifications(list.slice(0, 200));
}

// Settings
function getSettings() {
  return read(FILES.settings, {
    btcWallet: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    contactEmail: '',
    contactPhone: '',
    contactAddress: '',
    adminUsername: 'admin',
    adminPasswordHash: null // set on first run
  });
}
function saveSettings(s) { write(FILES.settings, s); }

module.exports = {
  getUsers, saveUsers, findUser, findUserById, updateUser,
  getCodes, saveCodes,
  getDeposits, saveDeposits,
  getWithdraws, saveWithdraws,
  getMessages, saveMessages,
  getNotifications, saveNotifications, addNotification,
  getSettings, saveSettings
};
