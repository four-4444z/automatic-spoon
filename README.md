# SYSTEM_CORE

SYSTEM_CORE is a static website built with HTML, CSS, and vanilla JavaScript, with an optional local Node.js backend for proxy browsing.

The dashboard is a search-first CORE_SEARCH home. Use **Settings** to choose DuckDuckGo, Google, or Bing; the selected engine is saved in the current browser.

The **Settings** page includes search-engine and theme preferences: select a preset accent, enter a custom hex color, and choose dark, light, or system appearance. Set an optional panic key and HTTP(S) destination there; pressing that unmodified key outside form controls opens the saved destination in a new tab. All preferences are saved in the current browser.

## Run the site and local proxy

Install Node.js 18 or newer, open a terminal in the project folder, and run:

```sh
node server.js
```

Open `http://127.0.0.1:5000`; the root and `index.html` redirect straight to the dashboard. Choose **Browser** for an address bar, back/forward, reload, and home controls. The Terminal page also has a basic proxy viewer. Both browse public HTTP/HTTPS sites through the local proxy. Set `PORT` to use a different port, for example `PORT=8080 node server.js` (PowerShell: `$env:PORT=8080; node server.js`).

The login flow and page/proxy access checks are currently disabled; the site opens directly without signing in. The previous sign-in API remains in the backend but is not used to protect pages or proxy requests. The backend still listens only on `127.0.0.1`, so it is not exposed to the internet or your local network.

The backend listens only on `127.0.0.1`; it is not exposed to the internet or your local network. For safety, the proxy allows only standard HTTP/HTTPS ports, blocks private or reserved IP addresses, follows and revalidates redirects, and limits upstream responses to 12 MB. It supports GET/HEAD browsing; sites that require logins, POST requests, scripts with cross-origin assumptions, or unrestricted cookies may not work. Proxied pages run in a sandboxed frame that prevents them from accessing this site's pages.

Opening the HTML files through a static server or GitHub Pages will not start the backend or provide proxy browsing. The proxy requires the local Node.js server.

## Publish with GitHub Pages

1. Push the repository to GitHub.
2. In the repository, open **Settings → Pages**.
3. Choose **Deploy from a branch**, select the branch containing the site and the repository root (`/`), then save.
4. GitHub Pages publishes `index.html` as the site entry point.

GitHub Pages only serves static files; it cannot run the backend or provide proxy browsing.

## Static-site limitations

The vault's separate client-side key prompt is a front-end demonstration, not an additional access-control boundary. External services may block proxy browsing or require their own sign-in.
