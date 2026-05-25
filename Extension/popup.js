// popup.js

const runBtn = document.getElementById('runBtn');
const logBox = document.getElementById('logBox');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const teacherInput = document.getElementById('teacherName');
const toggleMon = document.getElementById('toggleMon');
const toggleTue = document.getElementById('toggleTue');
const toggleWed = document.getElementById('toggleWed');
const toggleThu = document.getElementById('toggleThu');
const toggleFri = document.getElementById('toggleFri');
const toggleSat = document.getElementById('toggleSat');
const toggleSun = document.getElementById('toggleSun');
const mainUI = document.getElementById('mainUI');
const pageGuard = document.getElementById('pageGuard');

let isRunning = false;

// ── Persist settings ──────────────────────────────────────────────────────────
chrome.storage.sync.get(['teacherName', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], (data) => {
  if (data.teacherName) teacherInput.value = data.teacherName;
  if (data.monday === false) toggleMon.classList.remove('active');
  if (data.tuesday === false) toggleTue.classList.remove('active');
  if (data.wednesday === false) toggleWed.classList.remove('active');
  if (data.thursday === false) toggleThu.classList.remove('active');
  if (data.friday === false) toggleFri.classList.remove('active');
  if (data.saturday === false) toggleSat.classList.remove('active');
  if (data.sunday === false) toggleSun.classList.remove('active');
});

function saveSettings() {
  chrome.storage.sync.set({
    teacherName: teacherInput.value,
    monday: toggleMon.classList.contains('active'),
    tuesday: toggleTue.classList.contains('active'),
    wednesday: toggleWed.classList.contains('active'),
    thursday: toggleThu.classList.contains('active'),
    friday: toggleFri.classList.contains('active'),
    saturday: toggleSat.classList.contains('active'),
    sunday: toggleSun.classList.contains('active'),
  });
}

teacherInput.addEventListener('input', saveSettings);

// ── Day toggles ───────────────────────────────────────────────────────────────
[toggleMon, toggleTue, toggleWed, toggleThu, toggleFri, toggleSat, toggleSun].forEach(el => {
  el.addEventListener('click', () => {
    el.classList.toggle('active');
    saveSettings();
  });
});

// ── Logging ───────────────────────────────────────────────────────────────────
function log(msg, type = 'info') {
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  const tags = { info: '[INFO]', success: '[OK]', warn: '[SKIP]', error: '[ERR]' };
  entry.innerHTML = `<span class="tag">${tags[type] || '[INFO]'}</span><span class="msg">${msg}</span>`;
  logBox.appendChild(entry);
  logBox.scrollTop = logBox.scrollHeight;
}

function clearLog() {
  logBox.innerHTML = '';
}

function setStatus(state, text) {
  statusDot.className = `status-dot ${state}`;
  statusText.textContent = text;
}

// ── Check we're on the right site ─────────────────────────────────────────────
async function checkPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !tab.url.includes('5starstudents.com')) {
    mainUI.classList.add('hidden');
    pageGuard.classList.remove('hidden');
    return false;
  }
  mainUI.classList.remove('hidden');
  pageGuard.classList.add('hidden');
  return true;
}

checkPage();

// ── Run ───────────────────────────────────────────────────────────────────────
runBtn.addEventListener('click', async () => {
  if (isRunning) return;

  const teacher = teacherInput.value.trim();
  if (!teacher) {
    log('Please enter a teacher name first.', 'error');
    return;
  }

  const doMonday = toggleMon.classList.contains('active');
  const doTuesday = toggleTue.classList.contains('active');
  const doWednesday = toggleWed.classList.contains('active');
  const doThursday = toggleThu.classList.contains('active');
  const doFriday = toggleFri.classList.contains('active');
  const doSaturday = toggleSat.classList.contains('active');
  const doSunday = toggleSun.classList.contains('active');

  if (!doMonday && !doTuesday && !doWednesday && !doThursday && !doFriday && !doSaturday && !doSunday) {
    log('Select at least one day.', 'error');
    return;
  }

  const onPage = await checkPage();
  if (!onPage) return;

  clearLog();
  isRunning = true;
  runBtn.disabled = true;
  runBtn.innerHTML = '<span class="spinner">⟳</span> &nbsp;Running...';
  setStatus('running', 'Running...');

  log(`Target teacher: "${teacher}"`);
  log(`Days: ${[doMonday && 'Mon', doTuesday && 'Tue', doWednesday && 'Wed', doThursday && 'Thu', doFriday && 'Fri', doSaturday && 'Sat', doSunday && 'Sun'].filter(Boolean).join(', ')}`);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Send message to content script
  chrome.tabs.sendMessage(tab.id, {
    action: 'autoRegister',
    teacher,
    days: { monday: doMonday, tuesday: doTuesday, wednesday: doWednesday, thursday: doThursday, friday: doFriday, saturday: doSaturday, sunday: doSunday }
  }, (response) => {
    if (chrome.runtime.lastError) {
      log('Could not connect to page. Make sure you are on 5starstudents.com and reload the tab.', 'error');
      finish('error', 'Error');
      return;
    }
  });
});

// ── Listen for logs from content script ──────────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'log') {
    log(msg.msg, msg.level);
  }
  if (msg.type === 'done') {
    finish('ready', 'Done');
  }
  if (msg.type === 'error') {
    finish('error', 'Error');
  }
});

function finish(state, text) {
  isRunning = false;
  runBtn.disabled = false;
  runBtn.innerHTML = '▶ &nbsp;Run Auto-Register';
  setStatus(state, text);
}
