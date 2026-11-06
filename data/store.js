/**
 * MongoDB-backed data store for PANCORE
 * Requires MONGODB_URI environment variable
 */
const {
  User, RechargeCode, Deposit, Withdraw, Message, Notification, Settings, toPlain
} = require('./models');

// ---------- Users ----------
async function getUsers() {
  const list = await User.find().lean();
  return list.map(u => { const o = { ...u }; delete o._id; delete o.__v; return o; });
}

async function findUser(predicate) {
  // predicate is a function for compatibility — prefer specific helpers when possible
  const users = await getUsers();
  return users.find(predicate) || null;
}

async function findUserById(id) {
  if (!id) return null;
  const u = await User.findOne({ id }).lean();
  if (!u) return null;
  delete u._id;
  delete u.__v;
  return u;
}

async function findUserByEmail(email) {
  if (!email) return null;
  const u = await User.findOne({ email: String(email).toLowerCase() }).lean();
  if (!u) return null;
  delete u._id;
  delete u.__v;
  return u;
}

async function findUserByLogin(emailOrUsername) {
  const q = String(emailOrUsername || '').toLowerCase();
  const u = await User.findOne({
    $or: [{ email: q }, { username: new RegExp(`^${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }]
  }).lean();
  if (!u) return null;
  delete u._id;
  delete u.__v;
  return u;
}

async function createUser(userData) {
  const doc = await User.create(userData);
  return toPlain(doc);
}

async function updateUser(id, patch) {
  const doc = await User.findOneAndUpdate({ id }, { $set: patch }, { new: true }).lean();
  if (!doc) return null;
  delete doc._id;
  delete doc.__v;
  return doc;
}

async function deleteUser(id) {
  await User.deleteOne({ id });
}

// ---------- Recharge codes ----------
async function getCodes() {
  const list = await RechargeCode.find().sort({ createdAt: -1 }).lean();
  return list.map(c => { const o = { ...c }; delete o._id; delete o.__v; return o; });
}

async function findCode(code) {
  const c = await RechargeCode.findOne({ code: String(code).toUpperCase() }).lean();
  if (!c) return null;
  delete c._id;
  delete c.__v;
  return c;
}

async function createCode(data) {
  const doc = await RechargeCode.create(data);
  return toPlain(doc);
}

async function updateCode(code, patch) {
  const doc = await RechargeCode.findOneAndUpdate(
    { code: String(code).toUpperCase() },
    { $set: patch },
    { new: true }
  ).lean();
  if (!doc) return null;
  delete doc._id;
  delete doc.__v;
  return doc;
}

async function deleteCode(id) {
  await RechargeCode.deleteOne({ id });
}

// ---------- Deposits ----------
async function getDeposits() {
  const list = await Deposit.find().sort({ date: -1 }).lean();
  return list.map(d => { const o = { ...d }; delete o._id; delete o.__v; return o; });
}

async function createDeposit(data) {
  const doc = await Deposit.create(data);
  return toPlain(doc);
}

async function updateDeposit(id, patch) {
  const doc = await Deposit.findOneAndUpdate({ id }, { $set: patch }, { new: true }).lean();
  if (!doc) return null;
  delete doc._id;
  delete doc.__v;
  return doc;
}

async function findDeposit(id) {
  const d = await Deposit.findOne({ id }).lean();
  if (!d) return null;
  delete d._id;
  delete d.__v;
  return d;
}

// ---------- Withdraws ----------
async function getWithdraws() {
  const list = await Withdraw.find().sort({ date: -1 }).lean();
  return list.map(w => { const o = { ...w }; delete o._id; delete o.__v; return o; });
}

async function createWithdraw(data) {
  const doc = await Withdraw.create(data);
  return toPlain(doc);
}

async function updateWithdraw(id, patch) {
  const doc = await Withdraw.findOneAndUpdate({ id }, { $set: patch }, { new: true }).lean();
  if (!doc) return null;
  delete doc._id;
  delete doc.__v;
  return doc;
}

async function findWithdraw(id) {
  const w = await Withdraw.findOne({ id }).lean();
  if (!w) return null;
  delete w._id;
  delete w.__v;
  return w;
}

// ---------- Support messages ----------
async function getMessages() {
  const list = await Message.find().sort({ date: -1 }).lean();
  return list.map(m => { const o = { ...m }; delete o._id; delete o.__v; return o; });
}

async function createMessage(data) {
  const doc = await Message.create(data);
  return toPlain(doc);
}

// ---------- Notifications ----------
async function getNotifications() {
  const list = await Notification.find().sort({ date: -1 }).limit(200).lean();
  return list.map(n => { const o = { ...n }; delete o._id; delete o.__v; return o; });
}

async function addNotification(type, message, meta = {}) {
  await Notification.create({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    type,
    message,
    meta,
    read: false,
    date: new Date().toISOString()
  });
}

// ---------- Settings ----------
async function getSettings() {
  let s = await Settings.findOne({ key: 'main' }).lean();
  if (!s) {
    const doc = await Settings.create({ key: 'main' });
    s = doc.toObject();
  }
  delete s._id;
  delete s.__v;
  delete s.key;
  return s;
}

async function saveSettings(patch) {
  const doc = await Settings.findOneAndUpdate(
    { key: 'main' },
    { $set: patch },
    { new: true, upsert: true }
  ).lean();
  if (!doc) return getSettings();
  delete doc._id;
  delete doc.__v;
  delete doc.key;
  return doc;
}

module.exports = {
  getUsers,
  findUser,
  findUserById,
  findUserByEmail,
  findUserByLogin,
  createUser,
  updateUser,
  deleteUser,
  getCodes,
  findCode,
  createCode,
  updateCode,
  deleteCode,
  getDeposits,
  createDeposit,
  updateDeposit,
  findDeposit,
  getWithdraws,
  createWithdraw,
  updateWithdraw,
  findWithdraw,
  getMessages,
  createMessage,
  getNotifications,
  addNotification,
  getSettings,
  saveSettings
};
