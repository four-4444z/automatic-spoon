const dns = require('node:dns').promises;
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const path = require('node:path');

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 5000);
const ROOT = __dirname;
const MAX_RESPONSE_BYTES = 12 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const SESSION_COOKIE = 'system_core_session';
const SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60;
const AUTH_FILE = path.join(ROOT, '.env');

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp'
};

function isPublicAddress(address) {
  const normalizedAddress = address.toLowerCase().split('%')[0];
  const mappedAddress = normalizedAddress.match(/^(?:::ffff:)(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedAddress) return isPublicAddress(mappedAddress[1]);

  if (net.isIPv4(normalizedAddress)) {
    const octets = normalizedAddress.split('.').map(Number);
    const [first, second, third, fourth] = octets;
    if (octets.some((octet) => octet < 0 || octet > 255)) return false;
    if (first === 0 || first === 10 || first === 127 || first >= 224) return false;
    if (first === 100 && second >= 64 && second <= 127) return false;
    if (first === 169 && second === 254) return false;
    if (first === 172 && second >= 16 && second <= 31) return false;
    if (first === 192 && second === 168) return false;
    if (first === 192 && second === 0 && (third === 0 || third === 2)) return false;
    if (first === 192 && second === 88 && third === 99) return false;
    if (first === 198 && (second === 18 || second === 19)) return false;
    if (first === 198 && second === 51 && third === 100) return false;
    if (first === 203 && second === 0 && third === 113) return false;
    if (first === 255 && second === 255 && third === 255 && fourth === 255) return false;
    return true;
  }

  if (!net.isIPv6(normalizedAddress)) return false;
  const firstSegment = parseInt(normalizedAddress.split(':')[0], 16);
  if (!Number.isInteger(firstSegment) || firstSegment < 0x2000 || firstSegment > 0x3fff) {
    return false;
  }
  return !(
    normalizedAddress.startsWith('2001:db8:') ||
    normalizedAddress.startsWith('2001:10:') ||
    normalizedAddress.startsWith('2001:2:')
  );
}

async function resolvePublicAddress(hostname) {
  const literalVersion = net.isIP(hostname);
  const addresses = literalVersion
    ? [{ address: hostname }]
    : await dns.lookup(hostname, { all: true, verbatim: true });

  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error('The destination must resolve only to public IP addresses.');
  }

  return addresses[0].address;
}

function normalizeTarget(rawUrl) {
  let target;
  try {
    target = new URL(rawUrl);
  } catch {
    throw new Error('Enter a valid HTTP or HTTPS URL.');
  }

  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) {
    throw new Error('Only public HTTP and HTTPS URLs are supported.');
  }

  const allowedPort = target.protocol === 'https:' ? '443' : '80';
  if (target.port && target.port !== allowedPort) {
    throw new Error('Only the standard HTTP and HTTPS ports are supported.');
  }

  target.hash = '';
  return target;
}

function requestTarget(target, address) {
  const transport = target.protocol === 'https:' ? https : http;
  const agent = new transport.Agent({
    lookup: (_hostname, options, callback) => {
      const family = net.isIP(address);
      if (options.all) {
        callback(null, [{ address, family }]);
      } else {
        callback(null, address, family);
      }
    }
  });

  return new Promise((resolve, reject) => {
    const request = transport.request(target, {
      agent,
      headers: {
        'accept-encoding': 'identity',
        'user-agent': 'SYSTEM_CORE local proxy'
      },
      method: 'GET',
      timeout: 15000
    }, (response) => {
      const chunks = [];
      let size = 0;

      response.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_RESPONSE_BYTES) {
          request.destroy(new Error('The upstream response exceeds the 12 MB limit.'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => resolve({
        body: Buffer.concat(chunks),
        headers: response.headers,
        statusCode: response.statusCode || 502
      }));
      response.on('error', reject);
    });

    request.on('timeout', () => request.destroy(new Error('The upstream request timed out.')));
    request.on('error', reject);
    request.end();
  });
}

function proxyUrl(targetUrl, baseUrl) {
  if (/^(?:#|data:|javascript:|mailto:|tel:|blob:|about:)/i.test(targetUrl)) {
    return targetUrl;
  }

  let resolved;
  try {
    resolved = new URL(targetUrl, baseUrl);
  } catch {
    return targetUrl;
  }

  if (!['http:', 'https:'].includes(resolved.protocol)) return targetUrl;
  return `/proxy?url=${encodeURIComponent(resolved.href)}`;
}

function rewriteCss(css, baseUrl) {
  return css.replace(
    /(url\(\s*)(['"]?)([^)'"]+)\2(\s*\))/gi,
    (_match, before, quote, url, after) =>
      `${before}${quote}${proxyUrl(url.trim(), baseUrl)}${quote}${after}`
  );
}

function rewriteHtml(html, baseUrl) {
  const rewritten = html.replace(
    /\b(href|src|action|poster|data|xlink:href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi,
    (_match, attribute, doubleQuoted, singleQuoted, unquoted) => {
      const url = doubleQuoted ?? singleQuoted ?? unquoted;
      return `${attribute}="${proxyUrl(url, baseUrl)}"`;
    }
  );

  const styled = rewritten.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi,
    (_match, opening, css, closing) =>
      `${opening}${rewriteCss(css, baseUrl)}${closing}`);
  const navigationBridge = `<script>(()=>{document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(!link)return;const target=new URL(link.href);if(target.origin!==new URL(location.href).origin||target.pathname!=='/proxy')return;const url=target.searchParams.get('url');if(!url)return;event.preventDefault();parent.postMessage({type:'system-core-navigate',url},'*')},true)})();</script>`;
  const closingBody = /<\/body\s*>/i;

  return closingBody.test(styled)
    ? styled.replace(closingBody, `${navigationBridge}</body>`)
    : `${styled}${navigationBridge}`;
}

async function fetchPublicTarget(rawUrl, redirects = 0) {
  const target = normalizeTarget(rawUrl);
  const address = await resolvePublicAddress(target.hostname);
  const response = await requestTarget(target, address);
  const location = response.headers.location;

  if (
    response.statusCode >= 300 &&
    response.statusCode < 400 &&
    location
  ) {
    if (redirects >= MAX_REDIRECTS) throw new Error('The destination redirected too many times.');
    return fetchPublicTarget(new URL(location, target).href, redirects + 1);
  }

  return { ...response, target };
}

function sendError(response, statusCode, message) {
  response.writeHead(statusCode, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  response.end(message);
}

function loadAuthConfig() {
  let fileValues = {};
  try {
    fileValues = Object.fromEntries(
      fs.readFileSync(AUTH_FILE, 'utf8')
        .split(/\r?\n/)
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => {
          const separator = line.indexOf('=');
          return separator === -1
            ? ['', '']
            : [line.slice(0, separator), line.slice(separator + 1)];
        })
        .filter(([key]) => key)
    );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const config = {
    username: process.env.AUTH_USERNAME || fileValues.AUTH_USERNAME,
    password: process.env.AUTH_PASSWORD || fileValues.AUTH_PASSWORD,
    secret: process.env.SESSION_SECRET || fileValues.SESSION_SECRET
  };

  if (!config.username || !config.password || !config.secret) {
    config.username = config.username || 'admin';
    config.password = config.password || crypto.randomBytes(24).toString('base64url');
    config.secret = config.secret || crypto.randomBytes(48).toString('base64url');
    fs.writeFileSync(AUTH_FILE, [
      `AUTH_USERNAME=${config.username}`,
      `AUTH_PASSWORD=${config.password}`,
      `SESSION_SECRET=${config.secret}`,
      ''
    ].join('\n'), { flag: 'w', mode: 0o600 });
    console.log(`Created local login credentials in ${AUTH_FILE}; keep this file private.`);
    if (process.env.NODE_ENV !== 'test') {
      console.log(`Login username: ${config.username}`);
      console.log(`Open ${AUTH_FILE} to retrieve your generated login password.`);
    }
  }

  return config;
}

function createSessionToken(config, now = Date.now()) {
  const expiresAt = Math.floor(now / 1000) + SESSION_DURATION_SECONDS;
  const payload = Buffer.from(String(expiresAt)).toString('base64url');
  const signature = crypto.createHmac('sha256', config.secret).update(payload).digest('base64url');
  return { expiresAt, token: `${payload}.${signature}` };
}

function verifySessionToken(token, config, now = Date.now()) {
  if (!token) return false;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return false;

  const expected = crypto.createHmac('sha256', config.secret).update(payload).digest();
  let actual;
  try {
    actual = Buffer.from(signature, 'base64url');
  } catch {
    return false;
  }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return false;

  const expiresAt = Number(Buffer.from(payload, 'base64url').toString('utf8'));
  return Number.isSafeInteger(expiresAt) && expiresAt > Math.floor(now / 1000);
}

function hasValidSession(request, config) {
  const cookieHeader = request.headers.cookie || '';
  const cookie = cookieHeader.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return verifySessionToken(cookie && cookie.slice(SESSION_COOKIE.length + 1), config);
}

function sendJson(response, statusCode, value, headers = {}) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...headers
  });
  response.end(JSON.stringify(value));
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 4096) throw new Error('Login request is too large.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function credentialsMatch(username, password, config) {
  const matches = (actual, expected) => {
    const actualHash = crypto.createHash('sha256').update(String(actual)).digest();
    const expectedHash = crypto.createHash('sha256').update(expected).digest();
    return crypto.timingSafeEqual(actualHash, expectedHash);
  };
  return matches(username, config.username) && matches(password, config.password);
}

function createServer(authConfig = loadAuthConfig()) {
  const failedLogins = new Map();
  return http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url, `http://${HOST}:${PORT}`);

    if (request.method === 'POST' && requestUrl.pathname === '/api/login') {
      const origin = request.headers.origin;
      if (origin && origin !== `http://${request.headers.host}`) {
        sendJson(response, 403, { error: 'Sign-in request origin is not allowed.' });
        return;
      }

      const address = 'local';
      const attempt = failedLogins.get(address);
      if (attempt && attempt.lockedUntil > Date.now()) {
        sendJson(response, 429, { error: 'Too many failed attempts. Try again in 60 seconds.' });
        return;
      }
      if (attempt && attempt.lockedUntil > 0 && attempt.lockedUntil <= Date.now()) {
        failedLogins.delete(address);
      }

      let credentials;
      try {
        credentials = await readJsonBody(request);
      } catch {
        sendJson(response, 400, { error: 'Invalid login request.' });
        return;
      }

      if (
        !credentials ||
        typeof credentials.username !== 'string' ||
        typeof credentials.password !== 'string'
      ) {
        sendJson(response, 400, { error: 'Username and password are required.' });
        return;
      }

      if (!credentialsMatch(credentials.username, credentials.password, authConfig)) {
        const failures = (failedLogins.get(address)?.failures || 0) + 1;
        failedLogins.set(address, {
          failures: failures >= 5 ? 0 : failures,
          lockedUntil: failures >= 5 ? Date.now() + 60_000 : 0
        });
        sendJson(response, 401, { error: 'Invalid username or password.' });
        return;
      }

      failedLogins.delete(address);
      const session = createSessionToken(authConfig);
      const expires = new Date(session.expiresAt * 1000).toUTCString();
      sendJson(response, 200, { ok: true }, {
        'set-cookie': `${SESSION_COOKIE}=${session.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DURATION_SECONDS}; Expires=${expires}`
      });
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/api/session') {
      sendJson(response, 200, { authenticated: hasValidSession(request, authConfig) });
      return;
    }

    if (requestUrl.pathname === '/logout') {
      if (request.method !== 'GET' && request.method !== 'POST') {
        sendError(response, 405, 'Method not allowed.');
        return;
      }
      response.writeHead(303, {
        'location': '/main.html',
        'cache-control': 'no-store',
        'set-cookie': `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
      });
      response.end();
      return;
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendError(response, 405, 'Only GET and HEAD requests are supported.');
      return;
    }

    if (requestUrl.pathname === '/health') {
      response.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store'
      });
      response.end(JSON.stringify({ status: 'ok', proxyPort: PORT }));
      return;
    }

    let requestedPath;
    try {
      requestedPath = decodeURIComponent(requestUrl.pathname);
    } catch {
      sendError(response, 400, 'Invalid file path.');
      return;
    }
    const routePath = requestedPath || '/';
    const normalizedRoutePath = routePath.toLowerCase();
    if (normalizedRoutePath === '/' || normalizedRoutePath === '/index.html') {
      response.writeHead(302, { location: '/main.html', 'cache-control': 'no-store' });
      response.end();
      return;
    }

    if (normalizedRoutePath === '/proxy') {
      if (!requestUrl.searchParams.has('url')) {
        sendError(response, 400, 'Add a destination URL with ?url=https://example.com');
        return;
      }

      try {
        const upstream = await fetchPublicTarget(requestUrl.searchParams.get('url'));
        const contentType = upstream.headers['content-type'] || 'application/octet-stream';
        const isHtml = contentType.toLowerCase().includes('text/html');
        const isCss = contentType.toLowerCase().includes('text/css');
        let body = upstream.body;
        const headers = {
          'cache-control': 'no-store',
          'content-type': contentType,
          'referrer-policy': 'no-referrer',
          'x-content-type-options': 'nosniff'
        };

        if (isHtml || isCss) {
          const text = body.toString('utf8');
          body = Buffer.from(isHtml
            ? rewriteHtml(text, upstream.target)
            : rewriteCss(text, upstream.target));
        }

        response.writeHead(upstream.statusCode, headers);
        response.end(request.method === 'HEAD' ? undefined : body);
      } catch (error) {
        const isInputError = /valid HTTP|Only public|standard HTTP|resolve only to public/.test(error.message);
        sendError(response, isInputError ? 400 : 502, error.message);
      }
      return;
    }

    const filePath = path.resolve(ROOT, routePath === '/' ? './index.html' : `.${routePath}`);
    const relativePath = path.relative(ROOT, filePath);
    if (
      filePath === ROOT ||
      relativePath.startsWith('..') ||
      path.isAbsolute(relativePath) ||
      relativePath.split(path.sep).some((part) => part.startsWith('.')) ||
      ['server.js', 'server.test.js'].includes(relativePath.toLowerCase())
    ) {
      sendError(response, 404, 'Not found.');
      return;
    }

    fs.readFile(filePath, (error, body) => {
      if (error) {
        sendError(response, error.code === 'ENOENT' ? 404 : 500, 'File not found.');
        return;
      }

      const headers = {
        'content-type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'x-content-type-options': 'nosniff'
      };
      if (path.extname(filePath).toLowerCase() === '.html') {
        headers['cache-control'] = 'no-store';
      }
      response.writeHead(200, headers);
      response.end(request.method === 'HEAD' ? undefined : body);
    });
  });
}

if (require.main === module) {
  try {
    createServer().listen(PORT, HOST, () => {
      console.log(`SYSTEM_CORE is running at http://${HOST}:${PORT}`);
      console.log(`Local proxy is available at http://${HOST}:${PORT}/proxy?url=https://example.com`);
    });
  } catch (error) {
    console.error(`Unable to start SYSTEM_CORE: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  createServer,
  isPublicAddress,
  normalizeTarget,
  proxyUrl,
  rewriteCss,
  rewriteHtml
};
