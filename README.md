# SYSTEM_CORE

SYSTEM_CORE is a static website built with HTML, CSS, and vanilla JavaScript, with an optional local Node.js backend for proxy browsing.

## Run the site and local proxy

Install Node.js 18 or newer, open a terminal in the project folder, and run:

```sh
node server.js
```

Open `http://127.0.0.1:5000` and choose **Browser** for an address bar, back/forward, reload, and home controls. The Terminal page also has a basic proxy viewer. Both browse public HTTP/HTTPS sites through the local proxy. Set `PORT` to use a different port, for example `PORT=8080 node server.js` (PowerShell: `$env:PORT=8080; node server.js`).

The backend listens only on `127.0.0.1`; it is not exposed to the internet or your local network. For safety, the proxy allows only standard HTTP/HTTPS ports, blocks private or reserved IP addresses, follows and revalidates redirects, and limits upstream responses to 12 MB. It supports GET/HEAD browsing; sites that require logins, POST requests, scripts with cross-origin assumptions, or unrestricted cookies may not work. Proxied pages run in a sandboxed frame that prevents them from accessing this site's pages.

Opening the HTML files through a static server or GitHub Pages will not start the backend. The proxy page requires `node server.js` running on the same computer and is intended for local use only.

## Publish with GitHub Pages

1. Push the repository to GitHub.
2. In the repository, open **Settings → Pages**.
3. Choose **Deploy from a branch**, select the branch containing the site and the repository root (`/`), then save.
4. GitHub Pages publishes `index.html` as the site entry point.

The static pages continue to work on GitHub Pages, but the backend-powered Browser and proxy viewer require the local Node.js server and are not hosted by GitHub Pages.

## Static-site limitations

GitHub Pages only hosts static files. It cannot run the proxy backend or securely protect pages with client-side passwords. The portal login and vault are front-end demonstrations, not access controls. External services may block proxy browsing or require their own sign-in.
