const terminalInput = document.getElementById('terminal-input');
const terminalOutput = document.getElementById('terminal-output');
const proxyForm = document.getElementById('proxy-form');
const proxyUrlInput = document.getElementById('proxy-url');
const proxyFrame = document.getElementById('proxy-frame');
const proxyStatus = document.getElementById('proxy-status');
const SEARCH_ENGINES = {
  duckduckgo: { label: 'DUCKDUCKGO', url: 'https://duckduckgo.com/?q=' },
  google: { label: 'GOOGLE', url: 'https://www.google.com/search?q=' },
  bing: { label: 'BING', url: 'https://www.bing.com/search?q=' }
};
const SEARCH_ENGINE_STORAGE_KEY = 'coreSearchEngine';
const THEME_COLOR_STORAGE_KEY = 'coreSearchThemeColor';
const APPEARANCE_STORAGE_KEY = 'coreSearchAppearance';
const PANIC_KEY_STORAGE_KEY = 'coreSearchPanicKey';
const PANIC_URL_STORAGE_KEY = 'coreSearchPanicUrl';
const DEFAULT_THEME_COLOR = '#61f99b';

function normalizePanicKey(key) {
  return key === ' ' ? 'space' : key.toLowerCase();
}

let isCapturingPanicKey = false;

function resolveAppearance(preference) {
  if (preference === 'light' || preference === 'dark') return preference;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(color, appearance) {
  const normalizedColor = /^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_THEME_COLOR;
  document.documentElement.style.setProperty('--theme-accent', normalizedColor);
  document.documentElement.dataset.appearance = resolveAppearance(appearance);
}

function getSavedThemeColor() {
  const savedColor = localStorage.getItem(THEME_COLOR_STORAGE_KEY);
  return savedColor && /^#[0-9a-fA-F]{6}$/.test(savedColor) ? savedColor : DEFAULT_THEME_COLOR;
}

function getSavedAppearance() {
  const appearance = localStorage.getItem(APPEARANCE_STORAGE_KEY);
  return ['dark', 'light', 'system'].includes(appearance) ? appearance : 'dark';
}

function updateThemeSwatches(color) {
  document.querySelectorAll('.theme-swatch').forEach((swatch) => {
    swatch.setAttribute('aria-pressed', String(swatch.dataset.color === color.toLowerCase()));
  });
}

applyTheme(getSavedThemeColor(), getSavedAppearance());
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
  if (getSavedAppearance() === 'system') applyTheme(getSavedThemeColor(), 'system');
});

const searchSettingsForm = document.getElementById('search-settings-form');
if (searchSettingsForm) {
  const engineSelect = document.getElementById('search-engine');
  const hexInput = document.getElementById('theme-hex');
  const colorPicker = document.getElementById('theme-color-picker');
  const panicUrlInput = document.getElementById('panic-url');
  const panicKeyInput = document.getElementById('panic-key');
  const panicCaptureButton = document.getElementById('panic-capture');
  const panicClearButton = document.getElementById('panic-clear');
  const panicCaptureStatus = document.getElementById('panic-capture-status');
  const settingsFeedback = document.getElementById('settings-feedback');
  const savedColor = getSavedThemeColor();
  engineSelect.value = getSearchEngine();
  hexInput.value = savedColor;
  colorPicker.value = savedColor;
  panicUrlInput.value = localStorage.getItem(PANIC_URL_STORAGE_KEY) || '';
  panicKeyInput.value = localStorage.getItem(PANIC_KEY_STORAGE_KEY) || '';
  document.querySelector(`input[name="appearance"][value="${getSavedAppearance()}"]`).checked = true;
  updateThemeSwatches(savedColor);

  document.querySelectorAll('.theme-swatch').forEach((swatch) => {
    swatch.addEventListener('click', () => {
      hexInput.value = swatch.dataset.color;
      colorPicker.value = swatch.dataset.color;
      updateThemeSwatches(swatch.dataset.color);
      hexInput.setCustomValidity('');
    });
  });

  colorPicker.addEventListener('input', () => {
    hexInput.value = colorPicker.value;
    updateThemeSwatches(colorPicker.value);
    hexInput.setCustomValidity('');
  });

  hexInput.addEventListener('input', () => {
    const color = hexInput.value.trim();
    hexInput.setCustomValidity(/^#[0-9a-fA-F]{6}$/.test(color) ? '' : 'Enter a hex color like #61f99b.');
    if (/^#[0-9a-fA-F]{6}$/.test(color)) {
      colorPicker.value = color;
      updateThemeSwatches(color);
    } else {
      updateThemeSwatches('');
    }
  });

  panicCaptureButton.addEventListener('click', () => {
    isCapturingPanicKey = !isCapturingPanicKey;
    panicCaptureButton.textContent = isCapturingPanicKey ? 'CANCEL' : 'SET KEY';
    panicCaptureStatus.textContent = isCapturingPanicKey
      ? 'Press one unmodified key to use as your shortcut.'
      : 'Key capture cancelled.';
  });

  panicClearButton.addEventListener('click', () => {
    panicKeyInput.value = '';
    isCapturingPanicKey = false;
    panicCaptureButton.textContent = 'SET KEY';
    panicCaptureStatus.textContent = 'Panic key cleared. Save settings to confirm.';
  });

  panicUrlInput.addEventListener('input', () => panicUrlInput.setCustomValidity(''));

  searchSettingsForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const color = hexInput.value.trim().toLowerCase();
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
      hexInput.setCustomValidity('Enter a hex color like #61f99b.');
      hexInput.reportValidity();
      return;
    }

    if (!Object.hasOwn(SEARCH_ENGINES, engineSelect.value)) {
      settingsFeedback.textContent = 'Choose a valid search engine.';
      return;
    }
    const appearance = searchSettingsForm.elements.appearance.value;
    if (!['dark', 'light', 'system'].includes(appearance)) {
      settingsFeedback.textContent = 'Choose a valid appearance.';
      return;
    }

    let panicUrl = panicUrlInput.value.trim();
    if (panicUrl) {
      try {
        const parsedUrl = new URL(panicUrl.includes('://') ? panicUrl : `https://${panicUrl}`);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error();
        panicUrl = parsedUrl.href;
      } catch {
        panicUrlInput.setCustomValidity('Enter a valid HTTP or HTTPS destination.');
        panicUrlInput.reportValidity();
        return;
      }
    }

    const panicKey = panicKeyInput.value;
    if (panicKey && panicKey.length !== 1 && !/^F(?:[1-9]|1[0-2])$/.test(panicKey)) {
      panicCaptureStatus.textContent = 'Choose a printable key or function key F1–F12.';
      return;
    }

    localStorage.setItem(SEARCH_ENGINE_STORAGE_KEY, engineSelect.value);
    localStorage.setItem(THEME_COLOR_STORAGE_KEY, color);
    localStorage.setItem(APPEARANCE_STORAGE_KEY, appearance);
    localStorage.setItem(PANIC_KEY_STORAGE_KEY, panicKey);
    localStorage.setItem(PANIC_URL_STORAGE_KEY, panicUrl);
    applyTheme(color, appearance);
    updateThemeSwatches(color);
    panicUrlInput.value = panicUrl;
    settingsFeedback.textContent = 'SETTINGS SAVED.';
  });
}

window.addEventListener('keydown', (event) => {
  if (isCapturingPanicKey) {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') {
      isCapturingPanicKey = false;
      const captureButton = document.getElementById('panic-capture');
      const captureStatus = document.getElementById('panic-capture-status');
      if (captureButton) captureButton.textContent = 'SET KEY';
      if (captureStatus) captureStatus.textContent = 'Key capture cancelled.';
      return;
    }
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
      const captureStatus = document.getElementById('panic-capture-status');
      if (captureStatus) captureStatus.textContent = 'Use a key without Ctrl, Alt, Shift, or Meta.';
      return;
    }
    const capturedKey = event.key === ' ' ? 'Space' : event.key;
    if (capturedKey.length !== 1 && !/^F(?:[1-9]|1[0-2])$/.test(capturedKey)) {
      const captureStatus = document.getElementById('panic-capture-status');
      if (captureStatus) captureStatus.textContent = 'Choose a printable key or function key F1–F12.';
      return;
    }
    const keyInput = document.getElementById('panic-key');
    const captureButton = document.getElementById('panic-capture');
    const captureStatus = document.getElementById('panic-capture-status');
    if (keyInput) keyInput.value = capturedKey;
    isCapturingPanicKey = false;
    if (captureButton) captureButton.textContent = 'SET KEY';
    if (captureStatus) captureStatus.textContent = `Shortcut key set to ${capturedKey}. Save settings to confirm.`;
    return;
  }

  const configuredKey = normalizePanicKey(localStorage.getItem(PANIC_KEY_STORAGE_KEY) || '');
  const eventTarget = event.target;
  const isFormControl = eventTarget instanceof Element && (
    Boolean(eventTarget.closest('input, textarea, select, button')) ||
    (eventTarget.isContentEditable ?? false)
  );
  if (
    !configuredKey ||
    normalizePanicKey(event.key) !== configuredKey ||
    event.repeat ||
    event.ctrlKey ||
    event.altKey ||
    event.metaKey ||
    event.shiftKey ||
    event.isComposing ||
    isFormControl
  ) {
    return;
  }

  const savedUrl = localStorage.getItem(PANIC_URL_STORAGE_KEY);
  if (!savedUrl) return;
  event.preventDefault();
  window.open(savedUrl, '_blank', 'noopener,noreferrer');
}, true);

function getSearchEngine() {
  const savedEngine = localStorage.getItem(SEARCH_ENGINE_STORAGE_KEY);
  return SEARCH_ENGINES[savedEngine] ? savedEngine : 'duckduckgo';
}

const searchForm = document.getElementById('search-form');
const activeSearchEngine = document.getElementById('active-search-engine');
if (activeSearchEngine) {
  const engine = SEARCH_ENGINES[getSearchEngine()];
  activeSearchEngine.textContent = engine.label;
}

if (searchForm) {
  const searchQuery = document.getElementById('search-query');
  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const query = searchQuery.value.trim();
    if (!query) return;
    const engine = SEARCH_ENGINES[getSearchEngine()];
    window.open(`${engine.url}${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer');
  });

  document.querySelectorAll('[data-search]').forEach((suggestion) => {
    suggestion.addEventListener('click', () => {
      searchQuery.value = suggestion.dataset.search;
      searchForm.requestSubmit();
    });
  });
}

function openProxyUrl(value) {
  if (!proxyFrame || !proxyUrlInput || !proxyStatus) return false;

  let target;
  try {
    target = new URL(value.includes('://') ? value : `https://${value}`);
  } catch {
    proxyStatus.textContent = 'Enter a valid HTTP or HTTPS URL.';
    return false;
  }

  if (!['http:', 'https:'].includes(target.protocol)) {
    proxyStatus.textContent = 'Only HTTP and HTTPS websites are supported.';
    return false;
  }

  proxyUrlInput.value = target.href;
  proxyStatus.textContent = `Loading ${target.href}`;
  proxyFrame.src = `/proxy?url=${encodeURIComponent(target.href)}`;
  return true;
}

if (proxyForm && proxyUrlInput && proxyStatus) {
  proxyForm.addEventListener('submit', (event) => {
    event.preventDefault();
    openProxyUrl(proxyUrlInput.value.trim());
  });

  fetch('/health')
    .then((response) => {
      if (!response.ok) throw new Error('Local server is unavailable.');
      return response.json();
    })
    .then(({ proxyPort }) => {
      proxyStatus.textContent = `Local proxy ready on port ${proxyPort}. Public HTTP and HTTPS sites only.`;
    })
    .catch(() => {
      proxyStatus.textContent = 'Start the local backend with: node server.js';
    });
}

if (proxyFrame && proxyStatus) {
  window.addEventListener('message', (event) => {
    if (event.source !== proxyFrame.contentWindow) return;
    if (!event.data || event.data.type !== 'system-core-navigate') return;
    if (typeof event.data.url !== 'string') return;
    if (!openProxyUrl(event.data.url)) return;
    if (terminalOutput) {
      const response = document.createElement('p');
      response.textContent = '> FOLLOWING LINK THROUGH THE LOCAL PROXY.';
      terminalOutput.appendChild(response);
    }
  });
}

if (terminalInput && terminalOutput) {
  terminalInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;

    const input = terminalInput.value.trim();
    const [command, ...args] = input.split(/\s+/);
    const response = document.createElement('p');
    const entry = document.createElement('p');
    entry.textContent = `guest@core:~$ ${input}`;
    terminalOutput.appendChild(entry);

    if (command === 'clear') {
      terminalOutput.replaceChildren();
    } else if (command === 'help') {
      response.textContent = '> COMMANDS: help, clear, open <https://url>, proxy <https://url>';
      terminalOutput.appendChild(response);
    } else if (command === 'proxy') {
      if (openProxyUrl(args.join(' '))) {
        response.textContent = '> OPENING SITE THROUGH THE LOCAL PROXY.';
        terminalOutput.appendChild(response);
      } else if (!proxyFrame) {
        response.textContent = '> PROXY BROWSING IS ONLY AVAILABLE ON THE WEB PROXY PAGE.';
        terminalOutput.appendChild(response);
      } else {
        response.textContent = `> ${proxyStatus.textContent}`;
        terminalOutput.appendChild(response);
      }
    } else if (command === 'open') {
      const address = args.join(' ');
      let url;
      try {
        url = new URL(address.includes('://') ? address : `https://${address}`);
      } catch {
        response.textContent = '> ERROR: ENTER A VALID HTTP OR HTTPS URL.';
        terminalOutput.appendChild(response);
      }

      if (url && (url.protocol === 'https:' || url.protocol === 'http:')) {
        window.open(url.href, '_blank', 'noopener,noreferrer');
        response.textContent = `> OPENING ${url.href}`;
        terminalOutput.appendChild(response);
      } else if (url) {
        response.textContent = '> ERROR: ONLY HTTP AND HTTPS LINKS CAN BE OPENED.';
        terminalOutput.appendChild(response);
      }
    } else if (input) {
      response.textContent = `> UNKNOWN COMMAND: ${input}. TYPE 'help' FOR COMMANDS.`;
      terminalOutput.appendChild(response);
    }

    terminalInput.value = '';
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
  });
}

// Matrix Rain Animation
function initMatrixRain() {
  const canvas = document.getElementById('matrix-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789$+-*/=%\"'#&_(),.;:?!\\|{}<>[]^~";
  const fontSize = 16;
  const columns = canvas.width / fontSize;
  const drops = Array(Math.floor(columns)).fill(1);

  function draw() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Determine color based on page
    const isVault = window.location.pathname.includes('vault');
    const themeAccent = getComputedStyle(document.documentElement)
      .getPropertyValue('--theme-accent')
      .trim() || '#33FF33';
    ctx.fillStyle = isVault ? '#FF3333' : themeAccent;
    ctx.font = fontSize + 'px monospace';

    for (let i = 0; i < drops.length; i++) {
      const text = characters.charAt(Math.floor(Math.random() * characters.length));
      ctx.fillText(text, i * fontSize, drops[i] * fontSize);

      if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
        drops[i] = 0;
      }
      drops[i]++;
    }
  }

  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });

  setInterval(draw, 33);
}

// Password Visibility Toggle
function initPasswordToggles() {
  const toggles = document.querySelectorAll('.toggle-password');
  toggles.forEach(button => {
    button.addEventListener('click', function() {
      const input = this.parentElement.querySelector('input');
      if (input.type === 'password') {
        input.type = 'text';
        this.textContent = 'HIDE';
      } else {
        input.type = 'password';
        this.textContent = 'SHOW';
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initMatrixRain();
  initPasswordToggles();
});

// Mobile Menu Toggle
const mobileMenu = document.getElementById('mobile-menu');
const navLinks = document.querySelector('.nav-links');

if (mobileMenu && navLinks) {
  mobileMenu.addEventListener('click', () => {
    const isExpanded = navLinks.classList.toggle('active');
    mobileMenu.classList.toggle('is-active');
    mobileMenu.setAttribute('aria-expanded', String(isExpanded));
  });
}

// Super-secret Vault access
const blinkingText = document.querySelector('.blink');
if (blinkingText) {
  let lastTap = 0;
  blinkingText.style.cursor = 'pointer';
  blinkingText.addEventListener('click', function() {
    const now = Date.now();
    if (now - lastTap < 300) {
      window.location.href = 'vault-login.html';
    }
    lastTap = now;
  });
}

// Vault Login logic
const vaultPassInput = document.getElementById('vault-pass');
const vaultAuthBtn = document.getElementById('vault-auth-btn');
const vaultFeedback = document.getElementById('vault-feedback');

if (vaultAuthBtn && vaultPassInput) {
  vaultAuthBtn.addEventListener('click', function() {
    if (vaultPassInput.value === 'S3CR3T_K3Y_99') {
      vaultFeedback.textContent = 'ACCESS GRANTED. DECRYPTING...';
      vaultFeedback.style.color = '#00ff00';
      setTimeout(() => {
        window.location.href = 'vault.html';
      }, 1000);
    } else {
      vaultFeedback.textContent = 'INVALID ENCRYPTION KEY';
      vaultPassInput.value = '';
    }
  });

  vaultPassInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      vaultAuthBtn.click();
    }
  });
}

const loginForm = document.getElementById('login-form');
if (loginForm) {
  const feedback = document.createElement('div');
  feedback.style.marginTop = '1rem';
  feedback.style.textAlign = 'center';
  feedback.style.fontSize = '0.9rem';
  loginForm.appendChild(feedback);

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    feedback.textContent = 'CHECKING CREDENTIALS...';
    feedback.style.color = '#00ff00';

    const submitButton = loginForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          username: loginForm.elements.username.value,
          password: loginForm.elements.password.value
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Sign-in failed.');

      feedback.textContent = 'ACCESS GRANTED';
      const requestedPath = new URLSearchParams(window.location.search).get('next');
      let destination = '/main.html';
      if (requestedPath && requestedPath.startsWith('/') && !requestedPath.startsWith('//')) {
        const candidate = new URL(requestedPath, window.location.origin);
        if (candidate.origin === window.location.origin) destination = candidate.href;
      }
      window.location.assign(destination);
    } catch (error) {
      feedback.textContent = error.message === 'Failed to fetch'
        ? 'LOGIN SERVER UNAVAILABLE. START THE LOCAL NODE SERVER.'
        : error.message;
      feedback.style.color = '#ff3333';
      submitButton.disabled = false;
    }
  });
}