// PANCORE Dashboard – API driven

async function api(path, options = {}) {
  const opts = {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  };
  if (opts.body && typeof opts.body === 'object') opts.body = JSON.stringify(opts.body);
  const res = await fetch('/api' + path, opts);
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    window.location.href = 'login.html';
    return { ok: false, data };
  }
  return { ok: res.ok, status: res.status, data };
}

let currentUser = null;
let pendingDepositAmount = 0;
let pendingWithdraw = { amount: 0, wallet: '' };

async function initDashboard() {
  const { ok, data } = await api('/me');
  if (!ok || !data.user) {
    window.location.href = 'login.html';
    return;
  }
  currentUser = data.user;
  renderUser(currentUser);
  renderHistory(currentUser);
  renderStatement(currentUser);
  renderRechargeHistory(currentUser);
  loadContactInfo();
  setupSidebar();
  setupCoinMenu();
}

function renderUser(user) {
  const bal = Number(user.balance || 0).toFixed(2);
  document.getElementById('mainBalance').textContent = '$' + bal;
  document.getElementById('dropUsername').textContent = '@' + user.username;
  document.getElementById('dropBalance').textContent = 'Balance: $' + bal;
  document.getElementById('welcomeMsg').textContent =
    'Hello ' + (user.firstName || user.username) + ', welcome to your PANCORE dashboard.';

  const txs = user.transactions || [];
  const deposits = txs.filter(t => (t.type === 'deposit' || t.type === 'recharge') && t.status === 'completed')
    .reduce((s, t) => s + Number(t.amount), 0);
  const withdrawals = txs.filter(t => t.type === 'withdraw' && t.status === 'completed')
    .reduce((s, t) => s + Number(t.amount), 0);
  document.getElementById('totalDeposits').textContent = '$' + deposits.toFixed(2);
  document.getElementById('totalWithdrawals').textContent = '$' + withdrawals.toFixed(2);
}

function renderHistory(user) {
  const tbody = document.getElementById('historyTable');
  const txs = user.transactions || [];
  if (!txs.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No transactions yet</td></tr>';
    return;
  }
  tbody.innerHTML = txs.map(t =>
    '<tr><td>' + new Date(t.date).toLocaleString() + '</td><td style="text-transform:capitalize;">' + t.type +
    '</td><td style="color:' + (t.type === 'withdraw' ? 'var(--warning)' : 'var(--success)') + '">' +
    (t.type === 'withdraw' ? '-' : '+') + '$' + Number(t.amount).toFixed(2) +
    '</td><td>' + t.status + '</td></tr>'
  ).join('');
}

function renderRechargeHistory(user) {
  const tbody = document.getElementById('rechargeHistoryTable');
  const txs = (user.transactions || []).filter(t => t.type === 'recharge');
  if (!txs.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No recharges yet</td></tr>';
    return;
  }
  tbody.innerHTML = txs.map(t =>
    '<tr><td>' + new Date(t.date).toLocaleString() + '</td><td style="font-family:monospace;">' +
    (t.code || '—') + '</td><td style="color:var(--success)">+$' + Number(t.amount).toFixed(2) +
    '</td><td>' + t.status + '</td></tr>'
  ).join('');
}

function renderStatement(user) {
  const el = document.getElementById('statementContent');
  const txs = user.transactions || [];
  el.innerHTML = '<p><strong>Account:</strong> ' + user.email + '</p>' +
    '<p><strong>Current Balance:</strong> $' + Number(user.balance || 0).toFixed(2) + '</p>' +
    '<p style="margin-top:0.75rem;"><strong>Recent activity:</strong></p>' +
    (txs.length
      ? '<ul style="margin-left:1.2rem;color:var(--text-muted);">' +
        txs.slice(0, 10).map(t => '<li>' + new Date(t.date).toLocaleDateString() + ' — ' + t.type +
          ' $' + Number(t.amount).toFixed(2) + ' (' + t.status + ')</li>').join('') + '</ul>'
      : '<p style="color:var(--text-muted);">No activity yet.</p>');
}

async function loadContactInfo() {
  const { data } = await api('/contact');
  const el = document.getElementById('contactInfoDisplay');
  if (!el || !data.contact) return;
  const c = data.contact;
  if (c.email || c.phone || c.address) {
    el.innerHTML = (c.email ? '<p>Email: ' + c.email + '</p>' : '') +
      (c.phone ? '<p>Phone: ' + c.phone + '</p>' : '') +
      (c.address ? '<p>Address: ' + c.address + '</p>' : '');
  } else {
    el.innerHTML = '<p>No contact information set yet.</p>';
  }
}

function setupSidebar() {
  const toggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  function closeSidebar() {
    sidebar.classList.remove('open');
    toggle.classList.remove('open');
    overlay.classList.remove('show');
  }
  toggle.addEventListener('click', () => {
    if (sidebar.classList.contains('open')) closeSidebar();
    else { sidebar.classList.add('open'); toggle.classList.add('open'); overlay.classList.add('show'); }
  });
  overlay.addEventListener('click', closeSidebar);
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
      const target = document.getElementById('section-' + link.dataset.section);
      if (target) target.classList.add('active');
      closeSidebar();
    });
  });
}

function setupCoinMenu() {
  const btn = document.getElementById('coinBtn');
  const drop = document.getElementById('accountDropdown');
  btn.addEventListener('click', (e) => { e.stopPropagation(); drop.classList.toggle('show'); });
  document.addEventListener('click', () => drop.classList.remove('show'));
  drop.addEventListener('click', (e) => e.stopPropagation());
}
function closeAccountMenu() { document.getElementById('accountDropdown').classList.remove('show'); }

function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }

async function submitRechargeCode() {
  const input = document.getElementById('rechargeCode');
  const code = (input.value || '').trim().toUpperCase();
  if (!code) { alert('Please enter a recharge code.'); return; }
  const { ok, data } = await api('/recharge', { method: 'POST', body: { code } });
  if (ok && data.success) {
    input.value = '';
    alert(data.message);
    await initDashboard();
  } else {
    alert(data.message || 'Recharge failed.');
  }
}

function openDepositModal() {
  document.getElementById('depositAmount').value = '';
  openModal('depositModal');
}

async function submitDepositAmount() {
  const amount = parseFloat(document.getElementById('depositAmount').value);
  if (!amount || amount <= 0) { alert('Please enter a valid amount.'); return; }
  pendingDepositAmount = amount;
  closeModal('depositModal');

  const { data: contact } = await api('/contact');
  const wallet = (contact && contact.btcWallet) || 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
  document.getElementById('btcAmountDisplay').textContent = '$' + amount.toFixed(2);
  document.getElementById('btcAddress').textContent = wallet;
  document.getElementById('btcQrImg').src =
    'https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=' + encodeURIComponent(wallet);
  openModal('btcModal');
}

function copyBtcAddress() {
  const addr = document.getElementById('btcAddress').textContent;
  navigator.clipboard.writeText(addr).then(() => alert('BTC address copied!'))
    .catch(() => prompt('Copy this address:', addr));
}

async function confirmDeposit() {
  const { ok, data } = await api('/deposit', { method: 'POST', body: { amount: pendingDepositAmount } });
  if (ok && data.success) {
    closeModal('btcModal');
    openModal('depositSuccessModal');
    await initDashboard();
  } else {
    alert(data.message || 'Deposit failed.');
  }
}

function openWithdrawModal() {
  document.getElementById('withdrawAmount').value = '';
  document.getElementById('withdrawWallet').value = '';
  openModal('withdrawModal');
}

function submitWithdraw() {
  const amount = parseFloat(document.getElementById('withdrawAmount').value);
  const wallet = document.getElementById('withdrawWallet').value.trim();
  if (!amount || amount <= 0) { alert('Please enter a valid amount.'); return; }
  if (!wallet || wallet.length < 20) { alert('Please enter a valid BTC wallet.'); return; }
  if (currentUser && amount > Number(currentUser.balance || 0)) {
    alert('Insufficient balance.');
    return;
  }
  pendingWithdraw = { amount, wallet };
  closeModal('withdrawModal');
  document.getElementById('withdrawConfirmText').innerHTML =
    'Are you sure you want to withdraw <strong>$' + amount.toFixed(2) +
    '</strong> to<br><code style="font-size:0.8rem;word-break:break-all;">' + wallet + '</code>?';
  openModal('withdrawConfirmModal');
}

async function acceptWithdraw() {
  const { ok, data } = await api('/withdraw', {
    method: 'POST',
    body: { amount: pendingWithdraw.amount, wallet: pendingWithdraw.wallet }
  });
  if (ok && data.success) {
    closeModal('withdrawConfirmModal');
    openModal('withdrawSuccessModal');
    await initDashboard();
  } else {
    alert(data.message || 'Withdraw failed.');
  }
}

function openUserInfoModal() {
  if (!currentUser) return;
  const u = currentUser;
  document.getElementById('userInfoContent').innerHTML =
    '<p><strong>Name:</strong> ' + (u.firstName || '') + ' ' + (u.lastName || '') + '</p>' +
    '<p><strong>Username:</strong> @' + u.username + '</p>' +
    '<p><strong>Email:</strong> ' + u.email + '</p>' +
    '<p><strong>Phone:</strong> ' + (u.phone || '—') + '</p>' +
    '<p><strong>Country:</strong> ' + (u.country || '—') + '</p>' +
    '<p><strong>Member since:</strong> ' + (u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—') + '</p>' +
    '<p><strong>Balance:</strong> $' + Number(u.balance || 0).toFixed(2) + '</p>';
  openModal('userInfoModal');
}

function openEditProfileModal() {
  if (!currentUser) return;
  document.getElementById('editFirstName').value = currentUser.firstName || '';
  document.getElementById('editLastName').value = currentUser.lastName || '';
  document.getElementById('editPhone').value = currentUser.phone || '';
  openModal('editProfileModal');
}

async function saveProfile() {
  const { ok, data } = await api('/profile', {
    method: 'PUT',
    body: {
      firstName: document.getElementById('editFirstName').value.trim(),
      lastName: document.getElementById('editLastName').value.trim(),
      phone: document.getElementById('editPhone').value.trim()
    }
  });
  if (ok && data.success) {
    closeModal('editProfileModal');
    alert('Profile updated successfully.');
    await initDashboard();
  } else {
    alert(data.message || 'Update failed.');
  }
}

function openResetPasswordModal() {
  document.getElementById('recoveryCodeBox').style.display = 'none';
  document.getElementById('recoveryCode').value = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('confirmNewPassword').value = '';
  openModal('resetPasswordModal');
}

async function sendRecoveryCode() {
  const { ok, data } = await api('/reset/send-code', { method: 'POST' });
  if (ok && data.success) {
    document.getElementById('recoveryCodeAlert').textContent =
      'Demo: Recovery code is ' + (data.demoToken || '(check server logs)');
    document.getElementById('recoveryCodeBox').style.display = 'block';
  } else {
    alert(data.message || 'Failed to send code.');
  }
}

async function confirmResetPassword() {
  const { ok, data } = await api('/reset/confirm', {
    method: 'POST',
    body: {
      code: document.getElementById('recoveryCode').value.trim(),
      newPassword: document.getElementById('newPassword').value,
      confirmPassword: document.getElementById('confirmNewPassword').value
    }
  });
  if (ok && data.success) {
    closeModal('resetPasswordModal');
    alert('Password reset successfully.');
  } else {
    alert(data.message || 'Reset failed.');
  }
}

async function submitSupport() {
  const subject = document.getElementById('supportSubject').value.trim();
  const message = document.getElementById('supportMessage').value.trim();
  if (!subject || !message) { alert('Please fill in both fields.'); return; }
  const { ok, data } = await api('/support', { method: 'POST', body: { subject, message } });
  if (ok && data.success) {
    alert('Support message sent!');
    document.getElementById('supportSubject').value = '';
    document.getElementById('supportMessage').value = '';
  } else {
    alert(data.message || 'Failed to send.');
  }
}

document.addEventListener('DOMContentLoaded', initDashboard);
