const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { createServer, isPublicAddress, normalizeTarget, proxyUrl, rewriteHtml } = require('./server');

let server;
let baseUrl;
let sessionCookie;

before(async () => {
  server = createServer({
    username: 'test-user',
    password: 'test-password',
    secret: 'test-session-signing-secret'
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

test('serves the site and reports the active proxy port', async () => {
  const [home, health] = await Promise.all([
    fetch(baseUrl),
    fetch(`${baseUrl}/health`)
  ]);

  assert.equal(home.status, 200);
  assert.match(await home.text(), /SYSTEM_CORE/);
  const headers = { cookie: sessionCookie };
  assert.match(await (await fetch(`${baseUrl}/browser.html`, { headers })).text(), /id="browser-back"/);
  assert.match(await (await fetch(`${baseUrl}/browser.js`, { headers })).text(), /system-core-navigate/);
  assert.match(await (await fetch(`${baseUrl}/terminal.html`, { headers })).text(), /sandbox="allow-forms allow-scripts"/);
  assert.equal((await fetch(`${baseUrl}/main.html`, { headers })).status, 200);
  assert.deepEqual(await health.json(), { status: 'ok', proxyPort: 5000 });
});

test('requires a valid login cookie for site pages and proxy requests', async () => {
  const protectedPage = await fetch(`${baseUrl}/main.html`, { redirect: 'manual' });
  assert.equal(protectedPage.status, 302);
  assert.match(protectedPage.headers.get('location'), /^\/index\.html\?next=/);

  const protectedProxy = await fetch(
    `${baseUrl}/proxy?url=${encodeURIComponent('https://example.com')}`,
    { redirect: 'manual' }
  );
  assert.equal(protectedProxy.status, 302);
  assert.match(protectedProxy.headers.get('location'), /^\/index\.html\?next=/);

  for (const alias of ['/%6dain.html', '/MAIN.HTML']) {
    const response = await fetch(`${baseUrl}${alias}`, { redirect: 'manual' });
    assert.equal(response.status, 302, `${alias} must not bypass the login gate`);
  }

  const loginPage = await fetch(`${baseUrl}/index.html`, { redirect: 'manual' });
  assert.equal(loginPage.status, 200);
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

test('redirects already-authenticated browsers away from the login page', async () => {
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
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
  assert.deepEqual(await (await fetch(`${baseUrl}/api/session`, {
    headers: { cookie: sessionCookie }
  })).json(), { authenticated: true });
  assert.deepEqual(await (await fetch(`${baseUrl}/api/session`, {
    headers: { cookie: response.headers.get('set-cookie').split(';')[0] }
  })).json(), { authenticated: false });
});

test('does not expose backend source or Git metadata as static files', async () => {
  for (const file of ['/server.js', '/server.test.js', '/.git/config']) {
    assert.equal((await fetch(`${baseUrl}${file}`)).status, 404, `${file} must not be served`);
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
  assert.equal(response.status, 302);
  assert.equal(authenticatedResponse.status, 400);
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
