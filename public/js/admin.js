// PANCORE Admin – API driven

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
    window.location.href = 'admin-login.html';
    return { ok: false, data };
  }
  return { ok: res.ok, status: res.status, data };
}

function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }

function adminLogout() {
  api('/admin/logout', { method: 'POST' }).finally(() => {
    window.location.href = 'admin-login.html';
  });
}

function setupTabs() {
  document.querySelectorAll('.admin-nav button[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-nav button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      refreshTab(btn.dataset.tab);
    });
  });
}

function refreshTab(tab) {
  if (tab === 'users') renderUsers();
  if (tab === 'funds') populateFundUsers();
  if (tab === 'deposits') renderDeposits();
  if (tab === 'withdraws') renderWithdraws();
  if (tab === 'codes') renderCodes();
  if (tab === 'settings') loadSettingsForm();
  if (tab === 'notifications') renderNotifications();
  if (tab === 'messages') renderMessages();
}

async function renderUsers() {
  const { ok, data } = await api('/admin/users');
  const tbody = document.getElementById('adminUsersTable');
  if (!ok || !data.users || !data.users.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No users yet</td></tr>';
    return;
  }
  tbody.innerHTML = data.users.map(u =>
    '<tr><td>' + (u.firstName || '') + ' ' + (u.lastName || '') + '</td><td>@' + u.username +
    '</td><td>' + u.email + '</td><td>$' + Number(u.balance || 0).toFixed(2) +
    '</td><td><span class="badge ' + (u.active === false ? 'badge-danger' : 'badge-success') + '">' +
    (u.active === false ? 'Inactive' : 'Active') + '</span>' +
    (u.verified ? '' : ' <span class="badge badge-warning">Unverified</span>') +
    '</td><td class="action-btns">' +
    '<button onclick="toggleUserActive(\'' + u.id + '\')">' + (u.active === false ? 'Activate' : 'Deactivate') +
    '</button> <button onclick="adminDeleteUser(\'' + u.id + '\')" class="danger">Delete</button></td></tr>'
  ).join('');
}

function openAddUserModal() {
  ['newFirstName','newLastName','newUsername','newEmail','newPassword'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('newBalance').value = '0';
  openModal('addUserModal');
}

async function adminCreateUser() {
  const body = {
    firstName: document.getElementById('newFirstName').value.trim(),
    lastName: document.getElementById('newLastName').value.trim(),
    username: document.getElementById('newUsername').value.trim(),
    email: document.getElementById('newEmail').value.trim(),
    password: document.getElementById('newPassword').value,
    balance: parseFloat(document.getElementById('newBalance').value) || 0
  };
  const { ok, data } = await api('/admin/users', { method: 'POST', body });
  if (ok && data.success) {
    closeModal('addUserModal');
    renderUsers();
    alert('User created.');
  } else alert(data.message || 'Failed.');
}

async function toggleUserActive(id) {
  await api('/admin/users/' + id + '/toggle', { method: 'POST' });
  renderUsers();
}

async function adminDeleteUser(id) {
  if (!confirm('Delete this user permanently?')) return;
  await api('/admin/users/' + id, { method: 'DELETE' });
  renderUsers();
}

async function populateFundUsers() {
  const { data } = await api('/admin/users');
  const sel = document.getElementById('fundUserSelect');
  if (!data.users) { sel.innerHTML = '<option value="">No users</option>'; return; }
  sel.innerHTML = data.users.map(u =>
    '<option value="' + u.id + '">' + u.username + ' (' + u.email + ') — $' +
    Number(u.balance || 0).toFixed(2) + '</option>'
  ).join('');
}

async function adminAddFunds() {
  const userId = document.getElementById('fundUserSelect').value;
  const amount = parseFloat(document.getElementById('fundAmount').value);
  const { ok, data } = await api('/admin/funds', { method: 'POST', body: { userId, amount } });
  if (ok && data.success) {
    document.getElementById('fundAmount').value = '';
    populateFundUsers();
    alert('Funds added.');
  } else alert(data.message || 'Failed.');
}

async function renderDeposits() {
  const { data } = await api('/admin/deposits');
  const tbody = document.getElementById('adminDepositsTable');
  const list = data.deposits || [];
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No deposit requests</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(r =>
    '<tr><td>' + new Date(r.date).toLocaleString() + '</td><td>' + (r.username || r.email) +
    '</td><td>$' + Number(r.amount).toFixed(2) + '</td><td><span class="badge ' +
    (r.status === 'pending' ? 'badge-warning' : r.status === 'approved' ? 'badge-success' : 'badge-danger') +
    '">' + r.status + '</span></td><td class="action-btns">' +
    (r.status === 'pending'
      ? '<button onclick="approveDeposit(\'' + r.id + '\')">Approve</button> ' +
        '<button onclick="rejectDeposit(\'' + r.id + '\')" class="danger">Reject</button>'
      : '—') + '</td></tr>'
  ).join('');
}

async function approveDeposit(id) {
  await api('/admin/deposits/' + id + '/approve', { method: 'POST' });
  renderDeposits();
  alert('Deposit approved.');
}
async function rejectDeposit(id) {
  if (!confirm('Reject this deposit?')) return;
  await api('/admin/deposits/' + id + '/reject', { method: 'POST' });
  renderDeposits();
}

async function renderWithdraws() {
  const { data } = await api('/admin/withdraws');
  const tbody = document.getElementById('adminWithdrawsTable');
  const list = data.withdraws || [];
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No withdraw requests</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(r =>
    '<tr><td>' + new Date(r.date).toLocaleString() + '</td><td>' + (r.username || r.email) +
    '</td><td>$' + Number(r.amount).toFixed(2) +
    '</td><td style="font-size:0.75rem;word-break:break-all;max-width:140px;">' + r.wallet +
    '</td><td><span class="badge ' +
    (r.status === 'pending' ? 'badge-warning' : r.status === 'approved' ? 'badge-success' : 'badge-danger') +
    '">' + r.status + '</span></td><td class="action-btns">' +
    (r.status === 'pending'
      ? '<button onclick="approveWithdraw(\'' + r.id + '\')">Approve</button> ' +
        '<button onclick="rejectWithdraw(\'' + r.id + '\')" class="danger">Reject</button>'
      : '—') + '</td></tr>'
  ).join('');
}

async function approveWithdraw(id) {
  await api('/admin/withdraws/' + id + '/approve', { method: 'POST' });
  renderWithdraws();
  alert('Withdrawal approved.');
}
async function rejectWithdraw(id) {
  if (!confirm('Reject and refund user?')) return;
  await api('/admin/withdraws/' + id + '/reject', { method: 'POST' });
  renderWithdraws();
  alert('Rejected and refunded.');
}

async function generateCodes() {
  const price = parseFloat(document.getElementById('codePrice').value);
  const count = parseInt(document.getElementById('codeCount').value, 10) || 1;
  const { ok, data } = await api('/admin/codes', { method: 'POST', body: { price, count } });
  if (ok && data.success) {
    renderCodes();
    alert(count + ' code(s) generated.');
  } else alert(data.message || 'Failed.');
}

async function renderCodes() {
  const { data } = await api('/admin/codes');
  const tbody = document.getElementById('adminCodesTable');
  const codes = data.codes || [];
  if (!codes.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No codes yet</td></tr>';
    return;
  }
  tbody.innerHTML = codes.map(c =>
    '<tr><td style="font-family:monospace;font-weight:600;">' + c.code +
    '</td><td>$' + Number(c.price).toFixed(2) + '</td><td><span class="badge ' +
    (c.used ? 'badge-danger' : 'badge-success') + '">' + (c.used ? 'Used' : 'Available') +
    '</span></td><td>' + (c.usedBy || '—') + '</td><td>' +
    new Date(c.createdAt).toLocaleDateString() + '</td></tr>'
  ).join('');
}

async function loadSettingsForm() {
  const { data } = await api('/admin/settings');
  const s = data.settings || {};
  document.getElementById('adminBtcWallet').value = s.btcWallet || '';
  document.getElementById('adminContactEmail').value = s.contactEmail || '';
  document.getElementById('adminContactPhone').value = s.contactPhone || '';
  document.getElementById('adminContactAddress').value = s.contactAddress || '';
}

async function saveAdminSettings() {
  const { ok } = await api('/admin/settings', {
    method: 'PUT',
    body: {
      btcWallet: document.getElementById('adminBtcWallet').value.trim(),
      contactEmail: document.getElementById('adminContactEmail').value.trim(),
      contactPhone: document.getElementById('adminContactPhone').value.trim(),
      contactAddress: document.getElementById('adminContactAddress').value.trim()
    }
  });
  if (ok) alert('Settings saved.');
  else alert('Failed to save.');
}

async function renderNotifications() {
  const { data } = await api('/admin/notifications');
  const el = document.getElementById('adminNotifList');
  const list = data.notifications || [];
  if (!list.length) { el.innerHTML = '<div class="empty-state">No notifications</div>'; return; }
  el.innerHTML = list.slice(0, 50).map(n =>
    '<div class="notif-item"><div><div><span class="badge badge-info">' + n.type +
    '</span> ' + n.message + '</div><div class="meta">' + new Date(n.date).toLocaleString() +
    '</div></div></div>'
  ).join('');
}

async function renderMessages() {
  const { data } = await api('/admin/messages');
  const el = document.getElementById('adminMsgList');
  const list = data.messages || [];
  if (!list.length) { el.innerHTML = '<div class="empty-state">No messages</div>'; return; }
  el.innerHTML = list.map(m =>
    '<div class="notif-item"><div><div><strong>' + m.subject + '</strong> — from ' +
    (m.username || m.email) + '</div><div style="margin-top:0.3rem;color:var(--text-muted);">' +
    m.message + '</div><div class="meta">' + new Date(m.date).toLocaleString() +
    '</div></div></div>'
  ).join('');
}

document.addEventListener('DOMContentLoaded', async () => {
  // Check admin session by hitting a protected endpoint
  const { ok } = await api('/admin/users');
  if (!ok) return; // redirect handled in api()
  setupTabs();
  renderUsers();
  populateFundUsers();
  renderDeposits();
  renderWithdraws();
  renderCodes();
  loadSettingsForm();
  renderNotifications();
  renderMessages();
});
