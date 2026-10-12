const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { createServer, isPublicAddress, normalizeTarget, proxyUrl, rewriteHtml } = require('./server');

let server;
let baseUrl;

before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
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
  assert.match(await (await fetch(`${baseUrl}/browser.html`)).text(), /id="browser-back"/);
  assert.match(await (await fetch(`${baseUrl}/browser.js`)).text(), /system-core-navigate/);
  assert.match(await (await fetch(`${baseUrl}/terminal.html`)).text(), /sandbox="allow-forms allow-scripts"/);
  assert.deepEqual(await health.json(), { status: 'ok', proxyPort: 5000 });
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

  const response = await fetch(`${baseUrl}/proxy?url=${encodeURIComponent('http://127.0.0.1/')}`);
  assert.equal(response.status, 400);
  assert.match(await response.text(), /public IP addresses/);
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
