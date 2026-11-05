// PANCORE Frontend – API client

const countries = [
  { name: "United States", code: "+1", iso: "US" },
  { name: "United Kingdom", code: "+44", iso: "GB" },
  { name: "Canada", code: "+1", iso: "CA" },
  { name: "Australia", code: "+61", iso: "AU" },
  { name: "Germany", code: "+49", iso: "DE" },
  { name: "France", code: "+33", iso: "FR" },
  { name: "India", code: "+91", iso: "IN" },
  { name: "Nigeria", code: "+234", iso: "NG" },
  { name: "Kenya", code: "+254", iso: "KE" },
  { name: "South Africa", code: "+27", iso: "ZA" },
  { name: "Brazil", code: "+55", iso: "BR" },
  { name: "Japan", code: "+81", iso: "JP" },
  { name: "China", code: "+86", iso: "CN" },
  { name: "Singapore", code: "+65", iso: "SG" },
  { name: "United Arab Emirates", code: "+971", iso: "AE" },
  { name: "Saudi Arabia", code: "+966", iso: "SA" },
  { name: "Egypt", code: "+20", iso: "EG" },
  { name: "Ghana", code: "+233", iso: "GH" },
  { name: "Netherlands", code: "+31", iso: "NL" },
  { name: "Spain", code: "+34", iso: "ES" },
  { name: "Italy", code: "+39", iso: "IT" },
  { name: "Mexico", code: "+52", iso: "MX" },
  { name: "Philippines", code: "+63", iso: "PH" },
  { name: "Indonesia", code: "+62", iso: "ID" },
  { name: "Pakistan", code: "+92", iso: "PK" },
  { name: "Bangladesh", code: "+880", iso: "BD" },
  { name: "Turkey", code: "+90", iso: "TR" },
  { name: "South Korea", code: "+82", iso: "KR" },
  { name: "Sweden", code: "+46", iso: "SE" },
  { name: "Switzerland", code: "+41", iso: "CH" },
  { name: "Other", code: "+", iso: "XX" }
];

async function api(path, options = {}) {
  const opts = {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  };
  if (opts.body && typeof opts.body === 'object') {
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch('/api' + path, opts);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function populateCountries() {
  const countrySelect = document.getElementById('country');
  const codeSelect = document.getElementById('countryCode');
  if (!countrySelect || !codeSelect) return;
  countries.forEach(c => {
    const o1 = document.createElement('option');
    o1.value = c.name; o1.textContent = c.name;
    countrySelect.appendChild(o1);
    const o2 = document.createElement('option');
    o2.value = c.code; o2.textContent = c.code + ' (' + c.iso + ')';
    codeSelect.appendChild(o2);
  });
  countrySelect.addEventListener('change', () => {
    const selected = countries.find(c => c.name === countrySelect.value);
    if (selected) codeSelect.value = selected.code;
  });
}

function checkPasswordStrength(password) {
  const checks = {
    length: password.length >= 6,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  };
  const hints = document.querySelectorAll('.password-hints .hint');
  if (hints.length >= 5) {
    hints[0].className = 'hint ' + (checks.length ? 'valid' : 'invalid');
    hints[1].className = 'hint ' + (checks.upper ? 'valid' : 'invalid');
    hints[2].className = 'hint ' + (checks.lower ? 'valid' : 'invalid');
    hints[3].className = 'hint ' + (checks.number ? 'valid' : 'invalid');
    hints[4].className = 'hint ' + (checks.symbol ? 'valid' : 'invalid');
  }
  return Object.values(checks).every(Boolean);
}

function showAlert(el, message, type = 'error') {
  if (!el) return;
  el.textContent = message;
  el.className = 'alert alert-' + type + ' show';
}
function hideAlert(el) { if (el) el.className = 'alert'; }

async function handleRegister(e) {
  e.preventDefault();
  const form = e.target;
  const alertEl = document.getElementById('formAlert');
  const btn = form.querySelector('button[type="submit"]');
  hideAlert(alertEl);

  const password = form.password.value;
  if (!checkPasswordStrength(password)) {
    showAlert(alertEl, 'Password must be at least 6 characters with uppercase, lowercase, number and symbol.');
    return;
  }
  if (password !== form.confirmPassword.value) {
    showAlert(alertEl, 'Passwords do not match.');
    return;
  }
  if (!form.terms.checked) {
    showAlert(alertEl, 'You must agree to the Terms and Conditions.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Creating account...';

  const { ok, data } = await api('/register', {
    method: 'POST',
    body: {
      firstName: form.firstName.value.trim(),
      lastName: form.lastName.value.trim(),
      username: form.username.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      country: form.country.value,
      countryCode: form.countryCode.value,
      password,
      confirmPassword: form.confirmPassword.value,
      terms: form.terms.checked
    }
  });

  if (ok && data.success) {
    showAlert(alertEl, data.message || 'Registration successful! Redirecting to login...', 'success');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 1200);
  } else {
    showAlert(alertEl, data.message || 'Registration failed.');
    btn.disabled = false;
    btn.textContent = 'Register';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const form = e.target;
  const alertEl = document.getElementById('formAlert');
  const btn = form.querySelector('button[type="submit"]');
  hideAlert(alertEl);
  btn.disabled = true;
  btn.textContent = 'Signing in...';

  const { ok, data } = await api('/login', {
    method: 'POST',
    body: {
      emailOrUsername: form.emailOrUsername.value.trim(),
      password: form.password.value
    }
  });

  if (ok && data.success) {
    if (data.token) localStorage.setItem('pancore_token', data.token);
    window.location.href = 'dashboard.html';
  } else {
    showAlert(alertEl, data.message || 'Login failed.');
    btn.disabled = false;
    btn.textContent = 'Login';
  }
}

async function handleVerify(e) {
  e.preventDefault();
  const form = e.target;
  const alertEl = document.getElementById('formAlert');
  const btn = form.querySelector('button[type="submit"]');
  const email = form.email.value.trim();
  const code = form.code.value.trim().toUpperCase();
  hideAlert(alertEl);
  if (!code) { showAlert(alertEl, 'Please enter the verification code.'); return; }

  btn.disabled = true;
  btn.textContent = 'Verifying...';

  const { ok, data } = await api('/verify', { method: 'POST', body: { email, code } });
  if (ok && data.success) {
    showAlert(alertEl, data.message, 'success');
    setTimeout(() => { window.location.href = 'login.html'; }, 1400);
  } else {
    showAlert(alertEl, data.message || 'Verification failed.');
    btn.disabled = false;
    btn.textContent = 'Verify Email';
  }
}

async function resendCode(email) {
  const alertEl = document.getElementById('formAlert');
  const { ok, data } = await api('/resend-code', { method: 'POST', body: { email } });
  if (ok && data.success) {
    showAlert(alertEl, 'New code generated (demo).', 'info');
    if (data.demoToken) {
      sessionStorage.setItem('pancore_demo_code', data.demoToken);
      const codeInput = document.getElementById('code');
      if (codeInput) codeInput.value = data.demoToken;
    }
  } else {
    showAlert(alertEl, data.message || 'Could not resend.');
  }
}

async function handleLogout() {
  await api('/logout', { method: 'POST' });
  localStorage.removeItem('pancore_token');
  window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', () => {
  populateCountries();
  const passwordInput = document.getElementById('password');
  if (passwordInput) passwordInput.addEventListener('input', (e) => checkPasswordStrength(e.target.value));

  const registerForm = document.getElementById('registerForm');
  if (registerForm) registerForm.addEventListener('submit', handleRegister);

  const loginForm = document.getElementById('loginForm');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  const verifyForm = document.getElementById('verifyForm');
  if (verifyForm) {
    verifyForm.addEventListener('submit', handleVerify);
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email') || sessionStorage.getItem('pancore_pending_email') || '';
    const emailInput = document.getElementById('email');
    if (emailInput && emailParam) emailInput.value = emailParam;
    const demoCode = sessionStorage.getItem('pancore_demo_code');
    const codeInput = document.getElementById('code');
    if (demoCode && codeInput) {
      codeInput.value = demoCode;
      const hint = document.getElementById('demoHint');
      if (hint) hint.style.display = 'block';
    }
  }

  const resendBtn = document.getElementById('resendBtn');
  if (resendBtn) {
    resendBtn.addEventListener('click', () => {
      const email = document.getElementById('email')?.value;
      if (email) resendCode(email);
    });
  }
});
