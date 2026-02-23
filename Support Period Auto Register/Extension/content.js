// content.js — runs on 5starstudents.com

// ── Helpers ──────────────────────────────────────────────────────────────────

function sendLog(msg, level = 'info') {
  chrome.runtime.sendMessage({ type: 'log', msg, level });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Extract the user token — tries every possible location on the page
function getUserToken() {
  // 1. Try current URL path
  const pathMatch = window.location.pathname.match(/\/agourahighschool\/([a-f0-9]{32})/);
  if (pathMatch) return pathMatch[1];

  // 2. Scan ALL anchor tags on the page for the token pattern
  const allLinks = document.querySelectorAll('a[href]');
  for (const link of allLinks) {
    const href = link.getAttribute('href') || '';
    const m = href.match(/\/agourahighschool\/([a-f0-9]{32})/);
    if (m) return m[1];
  }

  // 3. Scan script tags for data-token attribute (dashboard.js uses this)
  const scripts = document.querySelectorAll('script[data-token]');
  for (const s of scripts) {
    const t = s.getAttribute('data-token');
    if (t && /^[a-f0-9]{32}$/.test(t)) return t;
  }

  // 4. Scan all elements with data-token
  const tokenEl = document.querySelector('[data-token]');
  if (tokenEl) {
    const t = tokenEl.getAttribute('data-token');
    if (t && /^[a-f0-9]{32}$/.test(t)) return t;
  }

  // 5. Check hidden inputs
  const hiddenInputs = document.querySelectorAll('input[type="hidden"]');
  for (const inp of hiddenInputs) {
    const val = inp.value || '';
    const m = val.match(/\/agourahighschool\/([a-f0-9]{32})/);
    if (m) return m[1];
  }

  // 6. Last resort: search full page HTML
  const bodyMatch = document.body.innerHTML.match(/\/agourahighschool\/([a-f0-9]{32})/);
  if (bodyMatch) return bodyMatch[1];

  return null;
}

// ── Main automation ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'autoRegister') {
    sendResponse({ started: true });
    runAutoRegister(msg.teacher, msg.days);
  }
});

async function runAutoRegister(teacherQuery, days) {
  try {
    sendLog('Starting automation...');
    sendLog('Current URL: ' + window.location.pathname);

    const token = getUserToken();
    if (!token) {
      sendLog('Token not found on this page!', 'error');
      sendLog('Navigate to the Dashboard or My Sign Ups page first, then try again.', 'warn');
      chrome.runtime.sendMessage({ type: 'error' });
      return;
    }

    sendLog('Token found: ' + token.substring(0, 8) + '...');

    const base = '/agourahighschool/dashboard/' + token;

    sendLog('Fetching upcoming dates...');
    const signupsPage = await fetchPage(base + '/signups');
    if (!signupsPage) {
      sendLog('Could not load the sign-ups page. Are you still logged in?', 'error');
      chrome.runtime.sendMessage({ type: 'error' });
      return;
    }

    const dates = parseUpcomingDates(signupsPage, days);
    sendLog('Found ' + dates.length + ' eligible date(s) to process.');

    if (dates.length === 0) {
      sendLog('No Tuesday/Wednesday dates found in upcoming list.', 'warn');
      chrome.runtime.sendMessage({ type: 'done' });
      return;
    }

    const alreadySignedUp = parseSignedUpDates(signupsPage);
    if (alreadySignedUp.length > 0) {
      sendLog('Already signed up for ' + alreadySignedUp.length + ' date(s) — will skip.');
    }

    let registered = 0;
    let skipped = 0;
    let atCapacity = 0;

    for (const date of dates) {
      const { dateStr, display } = date;

      if (alreadySignedUp.includes(dateStr)) {
        sendLog(display + ' — already registered, skipping.', 'warn');
        skipped++;
        continue;
      }

      sendLog('Processing ' + display + '...');

      const dayPage = await fetchPage(base + '/signups/sessions/' + dateStr);
      if (!dayPage) {
        sendLog(display + ' — could not load sessions page.', 'error');
        continue;
      }

      const result = findTeacherSignup(dayPage, teacherQuery);

      if (result === 'not_found') {
        sendLog(display + ' — teacher "' + teacherQuery + '" not found.', 'warn');
        skipped++;
        continue;
      }

      if (result === 'at_capacity') {
        sendLog(display + ' — "' + teacherQuery + '" is at capacity, skipping.', 'warn');
        atCapacity++;
        continue;
      }

      sendLog(display + ' — signing up with ' + result.name + '...');
      const success = await signUp(base, result.code, dateStr);

      if (success) {
        sendLog(display + ' — Signed up with ' + result.name + '!', 'success');
        registered++;
      } else {
        sendLog(display + ' — sign-up request failed.', 'error');
      }

      await sleep(700);
    }

    sendLog('───────────────────────');
    sendLog('Done! Registered: ' + registered + ' | Skipped: ' + skipped + ' | At capacity: ' + atCapacity, 'success');
    chrome.runtime.sendMessage({ type: 'done' });

  } catch (err) {
    sendLog('Unexpected error: ' + err.message, 'error');
    chrome.runtime.sendMessage({ type: 'error' });
  }
}

// ── Fetch a page ──────────────────────────────────────────────────────────────

async function fetchPage(path) {
  try {
    const res = await fetch('https://5starstudents.com' + path, {
      credentials: 'include',
      headers: { 'Accept': 'text/html' }
    });
    if (!res.ok) return null;
    const text = await res.text();
    const parser = new DOMParser();
    return parser.parseFromString(text, 'text/html');
  } catch {
    return null;
  }
}

// ── Parse upcoming Tue/Wed dates ──────────────────────────────────────────────

function parseUpcomingDates(doc, days) {
  const results = [];
  const links = doc.querySelectorAll('a[href*="/signups/sessions/"]');

  links.forEach(link => {
    const href = link.getAttribute('href') || '';
    const dateMatch = href.match(/\/signups\/sessions\/(\d{8})$/);
    if (!dateMatch) return;

    const dateStr = dateMatch[1];
    const container = link.closest('.d-sm-flex');
    if (!container) return;
    const label = container.querySelector('h6');
    if (!label) return;
    const text = label.textContent.trim();

    const isTuesday = text.toLowerCase().startsWith('tuesday');
    const isWednesday = text.toLowerCase().startsWith('wednesday');

    if ((days.tuesday && isTuesday) || (days.wednesday && isWednesday)) {
      results.push({ dateStr, display: text });
    }
  });

  return results;
}

// ── Parse already-signed-up dates ─────────────────────────────────────────────

function parseSignedUpDates(doc) {
  const dates = [];
  const links = doc.querySelectorAll('a[href*="/signups/sessions/"][href*="/replace/"]');
  links.forEach(link => {
    const m = (link.getAttribute('href') || '').match(/\/signups\/sessions\/(\d{8})\/replace/);
    if (m) dates.push(m[1]);
  });
  return dates;
}

// ── Find teacher on a day's page ──────────────────────────────────────────────

function findTeacherSignup(doc, teacherQuery) {
  const query = teacherQuery.toLowerCase().trim();
  const teacherHeadings = doc.querySelectorAll('h6.fw-light');

  for (const h6 of teacherHeadings) {
    const name = h6.textContent.trim();
    if (!name.toLowerCase().includes(query)) continue;

    const container = h6.closest('.d-sm-flex');
    if (!container) continue;

    const danger = container.querySelector('.text-danger');
    if (danger && danger.textContent.toLowerCase().includes('capacity')) {
      return 'at_capacity';
    }

    const btn = container.querySelector('button[data-bs-code]');
    if (btn) {
      const code = btn.getAttribute('data-bs-code');
      return { code, name };
    }
  }

  return 'not_found';
}

// ── Sign up POST ──────────────────────────────────────────────────────────────

async function signUp(base, sessionCode, dateStr) {
  try {
    const url = 'https://5starstudents.com' + base + '/session/' + sessionCode + '/addsignup/' + dateStr;

    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: ''
    });

    if (res.status === 200 || res.status === 201 || res.status === 302) return true;

    const text = await res.text();
    if (text.toLowerCase().includes('success') || text.toLowerCase().includes('signed')) return true;

    return false;
  } catch {
    return false;
  }
}
