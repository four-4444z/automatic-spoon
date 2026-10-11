const AUTH_CONFIG = {
  username: 'admin',
  password: 'bypass77',
  maxFailedAttempts: 5,
  lockoutDuration: 60000, // 60 seconds
  blockThreshold: 25
};

let failedAttempts = parseInt(localStorage.getItem('failedAttempts') || '0');
let lockoutUntil = parseInt(localStorage.getItem('lockoutUntil') || '0');
let isPermanentlyBlocked = localStorage.getItem('isPermanentlyBlocked') === 'true';

const terminalInput = document.getElementById('terminal-input');
const terminalOutput = document.getElementById('terminal-output');

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
      response.textContent = '> COMMANDS: help, clear, open <https://url>';
      terminalOutput.appendChild(response);
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
    ctx.fillStyle = isVault ? '#FF3333' : '#33FF33';
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
    navLinks.classList.toggle('active');
    mobileMenu.classList.toggle('is-active');
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

  function updateFeedback(message, isError = true) {
    feedback.textContent = message;
    feedback.style.color = isError ? '#ff3333' : '#00ff00';
  }

  // Real-time lockout timer
  setInterval(() => {
    if (isPermanentlyBlocked) return;
    const now = Date.now();
    if (now < lockoutUntil) {
      const remaining = Math.ceil((lockoutUntil - now) / 1000);
      updateFeedback(`SYSTEM LOCKED: RETRY IN ${remaining}s`);
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
    } else {
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      if (submitBtn && submitBtn.disabled) {
        submitBtn.disabled = false;
        updateFeedback('');
      }
    }
  }, 1000);

  loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    if (isPermanentlyBlocked) {
      updateFeedback('ACCESS DENIED: SYSTEM PERMANENTLY BLOCKED');
      return;
    }

    const now = Date.now();
    if (now < lockoutUntil) {
      const remaining = Math.ceil((lockoutUntil - now) / 1000);
      updateFeedback(`SYSTEM LOCKED: RETRY IN ${remaining}s`);
      return;
    }

    const username = e.target.username.value;
    const password = e.target.password.value;

    if (username === 'master' && password === 'ghost_protocol_7') {
      updateFeedback('SHADOW ACCESS GRANTED', false);
      setTimeout(() => {
        window.location.href = 'shadow-core.html';
      }, 1000);
      return;
    }

    if (username === AUTH_CONFIG.username && password === AUTH_CONFIG.password) {
      failedAttempts = 0;
      localStorage.setItem('failedAttempts', '0');
      updateFeedback('ACCESS GRANTED', false);
      setTimeout(() => {
        window.location.href = 'main.html';
      }, 1000);
    } else {
      failedAttempts++;
      localStorage.setItem('failedAttempts', failedAttempts.toString());

      if (failedAttempts >= AUTH_CONFIG.blockThreshold) {
        isPermanentlyBlocked = true;
        localStorage.setItem('isPermanentlyBlocked', 'true');
        updateFeedback('ACCESS DENIED: SYSTEM PERMANENTLY BLOCKED');
      } else if (failedAttempts % AUTH_CONFIG.maxFailedAttempts === 0) {
        lockoutUntil = Date.now() + AUTH_CONFIG.lockoutDuration;
        localStorage.setItem('lockoutUntil', lockoutUntil.toString());
        updateFeedback('TOO MANY ATTEMPTS: SYSTEM LOCKED FOR 60s');
      } else {
        updateFeedback(`INVALID CREDENTIALS (${failedAttempts}/${AUTH_CONFIG.blockThreshold})`);
      }
    }
  });
} 