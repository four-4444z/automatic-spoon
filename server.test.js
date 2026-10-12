const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const {
  createServer,
  isDiscordWebhookUrl,
  isPublicAddress,
  normalizeDiscordWebhookUrl,
  normalizeTarget,
  proxyUrl,
  rewriteHtml
} = require('./server');

let server;
let baseUrl;
let sessionCookie;

before(async () => {
  server = createServer({
    username: 'test-user',
    password: 'test-password',
    secret: 'test-session-signing-secret'
  }, {
    scramjetPort: 8080,
    scramjetUrl: 'https://core-search-4444z-scramjet.onrender.com',
    publicSiteOrigin: 'https://four-4444z.github.io'
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const loginResponse = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'test-user', password: 'test-password' })
  });
  sessionCookie = loginResponse.headers.get('set-cookie').split(';')[0];
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('redirects the entry page to the dashboard and reports the active proxy port', async () => {
  const [home, health] = await Promise.all([
    fetch(baseUrl, { redirect: 'manual' }),
    fetch(`${baseUrl}/health`)
  ]);

  assert.equal(home.status, 302);
  assert.equal(home.headers.get('location'), '/main.html');
  const headers = { cookie: sessionCookie };
  const dashboard = await fetch(`${baseUrl}/main.html`, { headers });
  const dashboardHtml = await dashboard.text();
  assert.equal(dashboard.status, 200);
  assert.match(dashboardHtml, /CORE_SEARCH/);
  assert.doesNotMatch(dashboardHtml, /RAMMERHEAD/i);
  assert.match(dashboardHtml, /id="search-form"/);
  assert.match(dashboardHtml, /id="bookmark-list"/);
  assert.match(dashboardHtml, /id="bookmark-add"/);
  assert.match(dashboardHtml, /id="bookmark-form"/);
  assert.match(dashboardHtml, /runtime-config\.js\?v=20261012-3/);
  assert.match(dashboardHtml, /script\.js\?v=20261012-3/);
  assert.match(dashboardHtml, /style\.css\?v=20261012-3/);
  assert.match(dashboardHtml, /id="search-status"/);
  assert.match(dashboardHtml, /THROUGH SCRAMJET/);
  assert.match(dashboardHtml, /id="dashboard-browser-chrome"/);
  assert.match(dashboardHtml, /id="dashboard-browser-tabs"/);
  assert.match(dashboardHtml, /id="dashboard-browser-address-form"/);
  assert.match(dashboardHtml, /id="dashboard-browser-new-tab"/);
  assert.match(dashboardHtml, /id="dashboard-browser-clear-tabs"[^>]*aria-label="Clear all tabs"/);
  assert.match(dashboardHtml, /id="mobile-menu"[\s\S]*?<\/button>[\s\S]*?<\/div>\s*<form class="dashboard-browser-address"/);
  assert.match(dashboardHtml, /id="dashboard-browser-back"/);
  assert.match(dashboardHtml, /id="dashboard-browser-forward"/);
  assert.match(dashboardHtml, /id="dashboard-browser-refresh"/);
  assert.match(dashboardHtml, /LAST UPDATED:/);
  assert.match(dashboardHtml, /suggestions\.html/);
  const dashboardNav = dashboardHtml.match(/<nav\b[\s\S]*?<\/nav>/)[0];
  assert.doesNotMatch(dashboardHtml, /href="browser\.html"/);
  assert.doesNotMatch(dashboardNav, /id="mobile-menu"/);
  assert.match(dashboardHtml, /matrix-canvas/);
  assert.match(await (await fetch(`${baseUrl}/settings.html`, { headers })).text(), /id="search-engine"/);
  const suggestionsHtml = await (await fetch(`${baseUrl}/suggestions.html`, { headers })).text();
  assert.match(suggestionsHtml, /class="search-dashboard search-subpage"/);
  assert.match(suggestionsHtml, /id="suggestion-form"/);
  assert.match(suggestionsHtml, /runtime-config\.js\?v=20261012-3/);
  assert.match(suggestionsHtml, /script\.js\?v=20261012-3/);
  assert.match(suggestionsHtml, /suggestions\.js\?v=20261012-3/);
  assert.match(suggestionsHtml, /LAST UPDATED:/);
  const settingsHtml = await (await fetch(`${baseUrl}/settings.html`, { headers })).text();
  assert.match(settingsHtml, /class="search-dashboard search-subpage"/);
  assert.match(settingsHtml, /id="search-engine"/);
  assert.match(settingsHtml, /id="theme-hex"/);
  assert.match(settingsHtml, /id="panic-key"/);
  assert.match(settingsHtml, /id="panic-url"/);
  assert.match(settingsHtml, /value="system"/);
  assert.match(settingsHtml, /#ff5c67/);
  assert.match(settingsHtml, /#ff9c4a/);
  assert.match(settingsHtml, /#ffd45c/);
  assert.match(settingsHtml, /#64a8ff/);
  assert.match(settingsHtml, /#b18cff/);
  assert.match(settingsHtml, /#ff75be/);
  for (const page of ['/browser.html', '/browser.js', '/youtube.html', '/chat.html', '/strongdog.html', '/games.html', '/entertainment.html']) {
    assert.equal((await fetch(`${baseUrl}${page}`)).status, 404, `${page} should be removed`);
  }
  const terminalHtml = await (await fetch(`${baseUrl}/terminal.html`, { headers })).text();
  assert.match(terminalHtml, /url=main\.html/);
  assert.equal((await fetch(`${baseUrl}/main.html`, { headers })).status, 200);
  assert.equal((await fetch(`${baseUrl}/settings.html`)).status, 200);
  assert.equal((await fetch(`${baseUrl}/theme.html`, { headers })).status, 404);
  assert.equal((await fetch(`${baseUrl}/index.html`, { redirect: 'manual' })).headers.get('location'), '/main.html');
  assert.deepEqual(await health.json(), {
    status: 'ok',
    proxyPort: 5000,
    scramjetPort: 8080,
    scramjetUrl: 'https://core-search-4444z-scramjet.onrender.com'
  });
});

test('serves pages and allows proxy requests without a login cookie', async () => {
  assert.equal((await fetch(`${baseUrl}/main.html`)).status, 200);
  assert.equal((await fetch(`${baseUrl}/settings.html`)).status, 200);
  const proxyResponse = await fetch(
    `${baseUrl}/proxy?url=${encodeURIComponent('http://127.0.0.1/')}`,
    { redirect: 'manual' }
  );
  assert.equal(proxyResponse.status, 400);
  assert.match(await proxyResponse.text(), /public IP addresses/);
});

test('allows the public GitHub Pages origin to read health and preflight suggestions', async () => {
  const origin = 'https://four-4444z.github.io';
  const health = await fetch(`${baseUrl}/health`, { headers: { origin } });
  assert.equal(health.status, 200);
  assert.equal(health.headers.get('access-control-allow-origin'), origin);

  const deniedHealth = await fetch(`${baseUrl}/health`, {
    headers: { origin: 'https://attacker.example' }
  });
  assert.equal(deniedHealth.status, 403);
  assert.equal(deniedHealth.headers.get('access-control-allow-origin'), null);

  const suggestion = await fetch(`${baseUrl}/api/suggestions`, {
    method: 'POST',
    headers: { origin, 'content-type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ type: 'feature', title: 'Check cross-origin API access' })
  });
  assert.equal(suggestion.status, 503);
  assert.equal(suggestion.headers.get('access-control-allow-origin'), origin);

  const preflight = await fetch(`${baseUrl}/api/suggestions`, {
    method: 'OPTIONS',
    headers: {
      origin,
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type'
    }
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
  assert.match(preflight.headers.get('access-control-allow-methods'), /POST/);
});

test('accepts validated suggestions and sends them to the configured Discord webhook', async () => {
  const suppliedWebhookUrl = 'https://discord.com/api/webhooks/123456/secure-token/github';
  assert.equal(isDiscordWebhookUrl(suppliedWebhookUrl), true);
  assert.equal(
    normalizeDiscordWebhookUrl(suppliedWebhookUrl),
    'https://discord.com/api/webhooks/123456/secure-token'
  );

  let delivered;
  const suggestionServer = createServer({
    username: 'test-user',
    password: 'test-password',
    secret: 'test-session-signing-secret'
  }, {
    discordWebhookUrl: suppliedWebhookUrl,
    publicSiteOrigin: 'https://four-4444z.github.io',
    sendDiscordWebhook: async (_webhookUrl, suggestion) => { delivered = suggestion; }
  });
  await new Promise((resolve) => suggestionServer.listen(0, '127.0.0.1', resolve));
  const suggestionUrl = `http://127.0.0.1:${suggestionServer.address().port}/api/suggestions`;
  try {
    const response = await fetch(suggestionUrl, {
      method: 'POST',
      headers: {
        origin: 'https://four-4444z.github.io',
        'content-type': 'text/plain;charset=UTF-8'
      },
      body: JSON.stringify({
        type: 'feature',
        title: 'Add keyboard shortcuts',
        details: 'Let people open tabs with a shortcut.',
        name: 'Test User'
      })
    });
    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get('access-control-allow-origin'),
      'https://four-4444z.github.io'
    );
    assert.deepEqual(await response.json(), { ok: true });
    assert.deepEqual(delivered, {
      type: 'feature',
      title: 'Add keyboard shortcuts',
      details: 'Let people open tabs with a shortcut.',
      name: 'Test User'
    });

    const crossOrigin = await fetch(suggestionUrl, {
      method: 'POST',
      headers: {
        origin: 'https://attacker.example',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ type: 'feature', title: 'Cross-origin suggestion' })
    });
    assert.equal(crossOrigin.status, 403);

    const invalid = await fetch(suggestionUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'other', title: 'Bad type', details: '', name: '' })
    });
    assert.equal(invalid.status, 400);
  } finally {
    await new Promise((resolve, reject) => suggestionServer.close((error) => error ? reject(error) : resolve()));
  }
});

test('does not accept suggestions without a configured webhook', async () => {
  const response = await fetch(`${baseUrl}/api/suggestions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'feature', title: 'Useful improvement' })
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'Suggestions are not configured yet.' });
});

test('issues a signed HttpOnly 30-day cookie only for correct credentials', async () => {
  const crossOrigin = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: {
      origin: 'https://attacker.example',
      'content-type': 'application/json'
    },
    body: JSON.stringify({ username: 'test-user', password: 'test-password' })
  });
  assert.equal(crossOrigin.status, 403);

  const rejected = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'test-user', password: 'wrong' })
  });
  assert.equal(rejected.status, 401);

  const accepted = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'test-user', password: 'test-password' })
  });
  const cookie = accepted.headers.get('set-cookie');
  assert.equal(accepted.status, 200);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Max-Age=2592000/);
  assert.deepEqual(await (await fetch(`${baseUrl}/api/session`, {
    headers: { cookie: cookie.split(';')[0] }
  })).json(), { authenticated: true });
});

test('redirects browsers to the dashboard regardless of prior login state', async () => {
  const response = await fetch(`${baseUrl}/index.html`, {
    headers: { cookie: sessionCookie },
    redirect: 'manual'
  });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/main.html');
});

test('logout clears the session cookie', async () => {
  const response = await fetch(`${baseUrl}/logout`, {
    headers: { cookie: sessionCookie },
    redirect: 'manual'
  });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/main.html');
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
  assert.deepEqual(await (await fetch(`${baseUrl}/api/session`, {
    headers: { cookie: sessionCookie }
  })).json(), { authenticated: true });
  assert.deepEqual(await (await fetch(`${baseUrl}/api/session`, {
    headers: { cookie: response.headers.get('set-cookie').split(';')[0] }
  })).json(), { authenticated: false });
});

test('does not expose backend source or Git metadata as static files', async () => {
  for (const file of [
    '/server.js',
    '/server.test.js',
    '/start.js',
    '/scramjet-server.mjs',
    '/scramjet-embed.html',
    '/scramjet-sw.js',
    '/.git/config'
  ]) {
    assert.equal((await fetch(`${baseUrl}${file}`)).status, 404, `${file} must not be served`);
  }
});

test('serves the isolated Scramjet browser and runtime locally', async () => {
  const { startScramjetServer } = await import('./scramjet-server.mjs');
  const scramjet = await startScramjetServer(0);
  const base = `http://${scramjet.host}:${scramjet.port}`;
  try {
    const [health, embed, worker, runtime] = await Promise.all([
      fetch(`${base}/health`),
      fetch(`${base}/embed.html`),
      fetch(`${base}/scramjet-sw.js`),
      fetch(`${base}/scram/scramjet.all.js`)
    ]);
    assert.deepEqual(await health.json(), { status: 'ok' });
    assert.equal(embed.status, 200);
    assert.match(await embed.text(), /new ScramjetController/);
    assert.equal(worker.status, 200);
    assert.match(await worker.text(), /ScramjetServiceWorker/);
    assert.equal(runtime.status, 200);
    assert.match(runtime.headers.get('cross-origin-embedder-policy'), /require-corp/);
  } finally {
    await scramjet.close();
  }
});

test('rejects malformed URLs, non-web protocols, and nonstandard ports', () => {
  assert.throws(() => normalizeTarget('not a URL'), /valid HTTP or HTTPS/);
  assert.throws(() => normalizeTarget('file:///etc/passwd'), /Only public HTTP and HTTPS/);
  assert.throws(() => normalizeTarget('http://example.com:8080'), /standard HTTP and HTTPS ports/);
  assert.equal(normalizeTarget('https://example.com/path#section').href, 'https://example.com/path');
});

test('blocks private destinations and refuses proxy requests to loopback', async () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.1.1', '::1', 'fc00::1', '2001:db8::1']) {
    assert.equal(isPublicAddress(address), false, `${address} must not be public`);
  }
  assert.equal(isPublicAddress('8.8.8.8'), true);
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true);

  const response = await fetch(`${baseUrl}/proxy?url=${encodeURIComponent('http://127.0.0.1/')}`, {
    redirect: 'manual'
  });
  const authenticatedResponse = await fetch(
    `${baseUrl}/proxy?url=${encodeURIComponent('http://127.0.0.1/')}`,
    { headers: { cookie: sessionCookie } }
  );
  assert.equal(response.status, 400);
  assert.equal(authenticatedResponse.status, 400);
  assert.match(await response.text(), /public IP addresses/);
  assert.match(await authenticatedResponse.text(), /public IP addresses/);
});

test('temporarily rate-limits repeated failed logins', async () => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'test-user', password: 'wrong' })
    });
    assert.equal(response.status, 401);
  }

  const lockedOut = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'test-user', password: 'test-password' })
  });
  assert.equal(lockedOut.status, 429);
});

test('rewrites proxied links and preserves non-web URLs', () => {
  const html = rewriteHtml(
    '<a href="/next">Next</a><img src="https://cdn.example/image.png"><a href="mailto:hi@example.com">Email</a>',
    new URL('https://example.com/start')
  );

  assert.match(html, /\/proxy\?url=https%3A%2F%2Fexample\.com%2Fnext/);
  assert.match(html, /\/proxy\?url=https%3A%2F%2Fcdn\.example%2Fimage\.png/);
  assert.match(rewriteHtml('<a href=https://example.com/unquoted>Next</a>', new URL('https://example.com/')), /href="\/proxy\?url=https%3A%2F%2Fexample\.com%2Funquoted"/);
  assert.match(html, /href="mailto:hi@example.com"/);
  assert.match(html, /system-core-navigate/);
  assert.match(proxyUrl('#top', new URL('https://example.com')), /^#top$/);
});
