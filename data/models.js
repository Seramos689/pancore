const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  id: String,
  type: String,
  amount: Number,
  status: String,
  code: String,
  wallet: String,
  note: String,
  date: String
}, { _id: false });

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  firstName: String,
  lastName: String,
  username: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true, index: true },
  phone: String,
  country: String,
  countryCode: String,
  password: String,
  balance: { type: Number, default: 0 },
  transactions: { type: [transactionSchema], default: [] },
  totalDeposited: { type: Number, default: 0 },
  activated: { type: Boolean, default: false },
  verified: { type: Boolean, default: true },
  active: { type: Boolean, default: true },
  verifyCode: String,
  verifyExpires: Number,
  recoveryCode: String,
  recoveryExpires: Number,
  createdAt: { type: String, default: () => new Date().toISOString() }
});

const rechargeCodeSchema = new mongoose.Schema({
  id: String,
  code: { type: String, required: true, unique: true, index: true },
  price: Number,
  used: { type: Boolean, default: false },
  usedBy: String,
  usedAt: String,
  createdAt: String
});

const depositSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: String,
  email: String,
  username: String,
  amount: Number,
  status: { type: String, default: 'pending' },
  date: String
});

const withdrawSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: String,
  email: String,
  username: String,
  amount: Number,
  wallet: String,
  status: { type: String, default: 'pending' },
  date: String
});

const messageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: String,
  email: String,
  username: String,
  subject: String,
  message: String,
  date: String,
  read: { type: Boolean, default: false }
});

const notificationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  type: String,
  message: String,
  meta: mongoose.Schema.Types.Mixed,
  read: { type: Boolean, default: false },
  date: String
});

const settingsSchema = new mongoose.Schema({
  key: { type: String, default: 'main', unique: true },
  btcWallet: { type: String, default: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' },
  contactEmail: { type: String, default: '' },
  contactPhone: { type: String, default: '' },
  contactAddress: { type: String, default: '' },
  adminUsername: { type: String, default: 'admin' },
  adminPasswordHash: { type: String, default: null }
});

const User = mongoose.models.User || mongoose.model('User', userSchema);
const RechargeCode = mongoose.models.RechargeCode || mongoose.model('RechargeCode', rechargeCodeSchema);
const Deposit = mongoose.models.Deposit || mongoose.model('Deposit', depositSchema);
const Withdraw = mongoose.models.Withdraw || mongoose.model('Withdraw', withdrawSchema);
const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);
const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
const Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);

function toPlain(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject() : { ...doc };
  delete o._id;
  delete o.__v;
  return o;
}

module.exports = {
  User,
  RechargeCode,
  Deposit,
  Withdraw,
  Message,
  Notification,
  Settings,
  toPlain
};
