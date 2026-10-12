const addressForm = document.getElementById('browser-address-form');
const addressInput = document.getElementById('browser-address');
const frame = document.getElementById('browser-frame');
const status = document.getElementById('browser-status');
const backButton = document.getElementById('browser-back');
const forwardButton = document.getElementById('browser-forward');
const reloadButton = document.getElementById('browser-reload');
const homeButton = document.getElementById('browser-home');

const visitedPages = [];
let activePage = -1;

function updateControls() {
  backButton.disabled = activePage <= 0;
  forwardButton.disabled = activePage < 0 || activePage >= visitedPages.length - 1;
}

function navigateTo(value, addToHistory = true) {
  let target;
  try {
    target = new URL(value.includes('://') ? value : `https://${value}`);
  } catch {
    status.textContent = 'Enter a valid HTTP or HTTPS address.';
    return false;
  }

  if (!['http:', 'https:'].includes(target.protocol)) {
    status.textContent = 'Only HTTP and HTTPS websites are supported.';
    return false;
  }

  target.hash = '';
  if (addToHistory) {
    visitedPages.splice(activePage + 1);
    visitedPages.push(target.href);
    activePage = visitedPages.length - 1;
  }

  addressInput.value = target.href;
  status.textContent = `Loading ${target.href}`;
  frame.src = `/proxy?url=${encodeURIComponent(target.href)}`;
  updateControls();
  return true;
}

addressForm.addEventListener('submit', (event) => {
  event.preventDefault();
  navigateTo(addressInput.value.trim());
});

backButton.addEventListener('click', () => {
  if (activePage <= 0) return;
  activePage -= 1;
  navigateTo(visitedPages[activePage], false);
});

forwardButton.addEventListener('click', () => {
  if (activePage >= visitedPages.length - 1) return;
  activePage += 1;
  navigateTo(visitedPages[activePage], false);
});

reloadButton.addEventListener('click', () => {
  if (activePage < 0) return;
  status.textContent = `Reloading ${visitedPages[activePage]}`;
  frame.src = `/proxy?url=${encodeURIComponent(visitedPages[activePage])}`;
});

homeButton.addEventListener('click', () => navigateTo('https://example.com'));

frame.addEventListener('load', () => {
  if (activePage >= 0) status.textContent = `Loaded ${visitedPages[activePage]}`;
});

window.addEventListener('message', (event) => {
  if (event.source !== frame.contentWindow) return;
  if (!event.data || event.data.type !== 'system-core-navigate') return;
  if (typeof event.data.url !== 'string') return;
  navigateTo(event.data.url);
});

fetch('/health')
  .then((response) => {
    if (!response.ok) throw new Error('The local backend is unavailable.');
    return response.json();
  })
  .then(({ proxyPort }) => {
    status.textContent = `Browser ready · local proxy on port ${proxyPort}`;
  })
  .catch(() => {
    status.textContent = 'Start the local backend with: node server.js';
  });

updateControls();
