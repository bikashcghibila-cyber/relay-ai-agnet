const toast = document.querySelector('#toast');
const drawer = document.querySelector('#drawer');
let toastTimer;
let callTimer;
let callStep = 0;
let currentConversationId = null;
let callSaved = false;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
}
function avatarClass(name) {
  const colors = ['a1', 'a2', 'a3', 'a4'];
  return colors[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % colors.length];
}
function timeLabel(value) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}
function statusClass(status) {
  if (status === 'Booked') return 'booked';
  if (status === 'Urgent') return 'urgent';
  if (status === 'Needs follow-up') return 'followup';
  return '';
}

function renderConversations(items) {
  const list = document.querySelector('#conversationList');
  list.replaceChildren();
  document.querySelector('#navCount').textContent = items.length;
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No calls yet. Use “Test your AI receptionist” to create a demo call.';
    list.append(empty);
    return;
  }
  for (const item of items) {
    const row = document.createElement('button');
    row.className = 'conversation-row';
    row.type = 'button';
    const avatar = document.createElement('div');
    avatar.className = `contact-avatar ${avatarClass(item.customer_name)}`;
    avatar.textContent = initials(item.customer_name);
    const main = document.createElement('div');
    main.className = 'conversation-main';
    const headline = document.createElement('div');
    headline.className = 'contact-line';
    const name = document.createElement('strong');
    name.textContent = item.customer_name;
    const time = document.createElement('span');
    time.className = 'time';
    time.textContent = timeLabel(item.created_at);
    headline.append(name, time);
    const preview = document.createElement('div');
    preview.className = 'conversation-preview';
    preview.textContent = item.issue;
    const tags = document.createElement('div');
    tags.className = 'conversation-tags';
    const status = document.createElement('span');
    status.className = `tag ${statusClass(item.status)}`;
    status.textContent = `● ${item.status}`;
    const category = document.createElement('span');
    category.className = 'tag';
    category.textContent = item.category;
    tags.append(status, category);
    main.append(headline, preview, tags);
    const arrow = document.createElement('div');
    arrow.className = 'row-chevron';
    arrow.textContent = '›';
    row.append(avatar, main, arrow);
    row.addEventListener('click', () => openConversation(item.id));
    list.append(row);
  }
}

function renderActivity(days) {
  const chart = document.querySelector('#activityChart');
  chart.replaceChildren(...[1, 2, 3, 4].map(index => {
    const line = document.createElement('div');
    line.className = `grid-line gl${index}`;
    return line;
  }));
  const max = Math.max(4, ...days.map(day => day.calls));
  for (const day of days) {
    const group = document.createElement('div');
    group.className = 'bar-group';
    const pair = document.createElement('div');
    pair.className = 'bar-pair';
    const calls = document.createElement('i');
    const booked = document.createElement('b');
    calls.style.height = `${Math.max(3, day.calls / max * 88)}%`;
    booked.style.height = `${Math.max(2, day.booked / max * 88)}%`;
    pair.append(calls, booked);
    const label = document.createElement('small');
    label.textContent = new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(`${day.date}T12:00:00`));
    group.append(pair, label);
    chart.append(group);
  }
  document.querySelector('#weekCalls').textContent = days.reduce((sum, day) => sum + day.calls, 0);
}

async function refreshDashboard() {
  const data = await api('/api/dashboard');
  const { metrics } = data;
  document.querySelector('.breadcrumb').firstChild.textContent = `${data.business.name} `;
  document.querySelector('#callsHandled').textContent = metrics.calls_handled;
  document.querySelector('#jobsBooked').textContent = metrics.jobs_booked;
  document.querySelector('#bookingRate').textContent = `${metrics.booking_rate_percent}% call-to-book rate`;
  document.querySelector('#revenueRecovered').textContent = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(metrics.revenue_recovered);
  document.querySelector('#responseTime').innerHTML = `${metrics.average_response_seconds}<span class="unit"> sec</span>`;
  document.querySelector('#todayLabel').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date()).toUpperCase();
  renderConversations(data.recent_conversations);
  renderActivity(data.activity);
}

async function openConversation(id) {
  try {
    const item = await api(`/api/conversations/${encodeURIComponent(id)}`);
    currentConversationId = item.id;
    document.querySelector('#drawerName').textContent = item.customer_name;
    document.querySelector('#drawerTime').textContent = timeLabel(item.created_at);
    document.querySelector('#drawerIssue').textContent = item.issue;
    document.querySelector('#drawerAvatar').textContent = initials(item.customer_name);
    document.querySelector('#drawerAvatar').className = `contact-avatar ${avatarClass(item.customer_name)}`;
    document.querySelector('#drawerStatus').textContent = `● ${item.status}`;
    document.querySelector('#drawerStatus').className = `drawer-status ${statusClass(item.status)}`;
    const messages = document.querySelector('#drawerMessages');
    messages.replaceChildren();
    for (const message of item.messages) {
      const bubble = document.createElement('div');
      bubble.className = `chat-bubble ${message.sender === 'customer' ? 'customer-bubble' : 'ai-bubble'}`;
      const label = document.createElement('small');
      label.textContent = `${message.sender.toUpperCase()} · ${timeLabel(message.created_at)}`;
      const text = document.createElement('p');
      text.textContent = message.body;
      bubble.append(label, text);
      messages.append(bubble);
    }
    const action = document.querySelector('#drawerAction');
    action.dataset.status = item.status === 'Needs follow-up' ? 'Resolved' : 'Needs follow-up';
    action.innerHTML = `${item.status === 'Needs follow-up' ? 'Mark resolved' : 'Mark as needs follow-up'} <span>→</span>`;
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
  } catch (error) { showToast(`Could not open conversation: ${error.message}`); }
}

const viewCopy = {
  overview: ['Good morning, Jordan', 'Here’s what’s happening with your calls today.'],
  conversations: ['Your conversations', 'Every customer gets a thoughtful response, around the clock.'],
  calendar: ['Upcoming bookings', 'The jobs Relay helped put on your calendar.'],
  analytics: ['Your business at a glance', 'See how every answered call turns into an opportunity.'],
  assistant: ['Meet your AI receptionist', 'A helpful first hello for every customer who calls.'],
  settings: ['Make Relay yours', 'Set up the details your customers need.']
};
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  button.classList.add('active');
  const view = button.dataset.view;
  document.querySelector('#crumb').textContent = button.textContent.trim().replace(/\s+\d+$/, '');
  document.querySelector('#pageTitle').textContent = viewCopy[view][0];
  document.querySelector('#pageSubtitle').textContent = viewCopy[view][1];
  if (view === 'conversations') refreshDashboard().catch(error => showToast(error.message));
  else if (view === 'calendar') api('/api/bookings').then(bookings => showToast(`${bookings.length} confirmed bookings in your workspace`)).catch(error => showToast(error.message));
  else if (view === 'assistant') openModal();
  else if (view !== 'overview') showToast(`${viewCopy[view][0]} · Preview`);
}));
document.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => {
  document.querySelector(`[data-view="${button.dataset.open}"]`)?.click();
}));

function closeDrawer() { drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); }
document.querySelector('#drawerClose').addEventListener('click', closeDrawer);
document.querySelector('#drawerAction').addEventListener('click', async event => {
  if (!currentConversationId) return;
  try {
    await api(`/api/conversations/${encodeURIComponent(currentConversationId)}/status`, {
      method: 'POST', body: JSON.stringify({ status: event.currentTarget.dataset.status })
    });
    await refreshDashboard();
    closeDrawer();
    showToast('Conversation status saved.');
  } catch (error) { showToast(`Could not save status: ${error.message}`); }
});

const modal = document.querySelector('#modal');
function openModal() { modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); }
function closeModal() { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); resetCall(); }
document.querySelector('#testCall').addEventListener('click', openModal);
document.querySelector('#assistantLink').addEventListener('click', openModal);
document.querySelector('#modalClose').addEventListener('click', closeModal);
modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
const callLines = [
  ['Calling Harbor Plumbing…', 'Starting the local demo flow.'],
  ['“Thanks for calling Harbor Plumbing!”', 'The receptionist greets the customer and listens.'],
  ['“A pipe burst in my basement.”', 'Relay identifies an urgent plumbing request.'],
  ['“I’ll alert the on-call team now.”', 'The conversation will be saved to your workspace.']
];
function resetCall() {
  clearInterval(callTimer);
  callStep = 0;
  callSaved = false;
  document.querySelector('#callDemo').classList.remove('calling');
  document.querySelector('#callState').textContent = 'Ready when you are';
  document.querySelector('#callCaption').textContent = 'No setup needed for this demo.';
  const button = document.querySelector('#callButton');
  button.classList.remove('end');
  button.innerHTML = '<span>☎</span> Start demo call';
}
async function saveDemoCall() {
  if (callSaved) return;
  callSaved = true;
  try {
    await api('/api/demo/calls', { method: 'POST', body: '{}' });
    await refreshDashboard();
    document.querySelector('#callState').textContent = 'Lead saved ✓';
    document.querySelector('#callCaption').textContent = 'The demo call is now in your conversations.';
  } catch (error) {
    document.querySelector('#callState').textContent = 'Could not save call';
    document.querySelector('#callCaption').textContent = error.message;
    showToast('Start the Relay server to save demo calls.');
  }
  document.querySelector('#callDemo').classList.remove('calling');
  const button = document.querySelector('#callButton');
  button.classList.remove('end');
  button.innerHTML = '<span>↻</span> Try again';
  callStep = 0;
}
document.querySelector('#callButton').addEventListener('click', () => {
  if (callStep > 0) { resetCall(); return; }
  callStep = 1;
  callSaved = false;
  document.querySelector('#callDemo').classList.add('calling');
  const button = document.querySelector('#callButton');
  button.classList.add('end');
  button.innerHTML = '<span>■</span> End demo';
  const advance = () => {
    const [state, caption] = callLines[callStep - 1];
    document.querySelector('#callState').textContent = state;
    document.querySelector('#callCaption').textContent = caption;
    callStep += 1;
    if (callStep > callLines.length) { clearInterval(callTimer); saveDemoCall(); }
  };
  advance();
  callTimer = setInterval(advance, 1600);
});

document.querySelector('#helpBtn').addEventListener('click', () => showToast('Support chat is not connected in this local MVP.'));
document.querySelector('#notifBtn').addEventListener('click', () => showToast('You’re all caught up.'));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { closeModal(); closeDrawer(); }
});

refreshDashboard().catch(error => {
  document.querySelector('#conversationList').innerHTML = '<div class="empty-state">Could not connect to Relay. Start the backend with <code>python3 server.py</code>.</div>';
  showToast(`Relay API is unavailable: ${error.message}`);
});
