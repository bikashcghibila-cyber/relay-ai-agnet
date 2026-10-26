const toast = document.querySelector('#toast');
let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
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
  if (view !== 'overview') showToast(`${viewCopy[view][0]} · Preview`);
}));
document.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => {
  const target = document.querySelector(`[data-view="${button.dataset.open}"]`);
  if (target) target.click();
}));

const drawer = document.querySelector('#drawer');
document.querySelectorAll('.conversation-row').forEach(row => row.addEventListener('click', () => {
  document.querySelector('#drawerName').textContent = row.dataset.name;
  document.querySelector('#drawerTime').textContent = row.dataset.time;
  document.querySelector('#drawerIssue').textContent = row.dataset.issue;
  document.querySelector('#drawerStatus').textContent = `● ${row.dataset.status}`;
  document.querySelector('#drawerAvatar').textContent = row.dataset.name.split(' ').map(n => n[0]).join('');
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
}));
function closeDrawer() { drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); }
document.querySelector('#drawerClose').addEventListener('click', closeDrawer);
document.querySelector('#drawerAction').addEventListener('click', () => { closeDrawer(); showToast('Conversation view is ready to connect to your phone system.'); });

const modal = document.querySelector('#modal');
function openModal() { modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); }
function closeModal() { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); resetCall(); }
document.querySelector('#testCall').addEventListener('click', openModal);
document.querySelector('#assistantLink').addEventListener('click', openModal);
document.querySelector('#modalClose').addEventListener('click', closeModal);
modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
let callTimer;
let callStep = 0;
const callLines = [
  ['Calling Harbor Plumbing…', 'Relay is picking up the phone.'],
  ['“Thanks for calling Harbor Plumbing!”', 'The receptionist greets the customer and listens.'],
  ['“A pipe burst in my basement.”', 'Relay recognizes an urgent plumbing request.'],
  ['“I’ll get the on-call team right away.”', 'The lead is captured and your team is notified.']
];
function resetCall() {
  clearInterval(callTimer);
  callStep = 0;
  document.querySelector('#callDemo').classList.remove('calling');
  document.querySelector('#callState').textContent = 'Ready when you are';
  document.querySelector('#callCaption').textContent = 'No setup needed for this demo.';
  const button = document.querySelector('#callButton');
  button.classList.remove('end');
  button.innerHTML = '<span>☎</span> Start demo call';
}
document.querySelector('#callButton').addEventListener('click', () => {
  if (callStep > 0) { resetCall(); return; }
  callStep = 1;
  document.querySelector('#callDemo').classList.add('calling');
  const button = document.querySelector('#callButton');
  button.classList.add('end');
  button.innerHTML = '<span>■</span> End demo';
  const advance = () => {
    const [state, caption] = callLines[callStep - 1];
    document.querySelector('#callState').textContent = state;
    document.querySelector('#callCaption').textContent = caption;
    callStep += 1;
    if (callStep > callLines.length) {
      clearInterval(callTimer);
      document.querySelector('#callDemo').classList.remove('calling');
      document.querySelector('#callState').textContent = 'Lead captured ✓';
      document.querySelector('#callCaption').textContent = 'Your team can take it from here.';
      button.classList.remove('end');
      button.innerHTML = '<span>↻</span> Try again';
      callStep = 0;
    }
  };
  advance();
  callTimer = setInterval(advance, 1800);
});

document.querySelector('#periodBtn').addEventListener('click', event => {
  const button = event.currentTarget;
  button.innerHTML = button.textContent.includes('This week') ? 'Last week <span>⌄</span>' : 'This week <span>⌄</span>';
  document.querySelector('.chart-summary strong').textContent = button.textContent.includes('Last week') ? '76' : '84';
  showToast(`Showing ${button.textContent.trim().replace('⌄', '').trim().toLowerCase()} activity`);
});
document.querySelector('#helpBtn').addEventListener('click', () => showToast('Support chat is ready to connect.'));
document.querySelector('#notifBtn').addEventListener('click', () => showToast('You’re all caught up.'));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { closeModal(); closeDrawer(); }
});
