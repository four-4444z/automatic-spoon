# SYSTEM_CORE

SYSTEM_CORE is a static website built with HTML, CSS, and vanilla JavaScript, with an optional local Node.js backend for proxy browsing.

## Run the site and local proxy

Install Node.js 18 or newer, open a terminal in the project folder, and run:

```sh
node server.js
```

Open `http://127.0.0.1:5000` and choose **Browser** for an address bar, back/forward, reload, and home controls. The Terminal page also has a basic proxy viewer. Both browse public HTTP/HTTPS sites through the local proxy. Set `PORT` to use a different port, for example `PORT=8080 node server.js` (PowerShell: `$env:PORT=8080; node server.js`).

On first start, the backend creates a private `.env` file with a random login password and signing key. Sign in as `admin`; get the generated password from `.env`. Keep that file private—it is excluded from Git. Successful logins set a signed, HttpOnly cookie valid for 30 days; choose **LOGOUT** to clear it. The backend checks the cookie before serving pages or proxy requests. Do not use this as a public production login without adding a dedicated identity provider and HTTPS.

The backend listens only on `127.0.0.1`; it is not exposed to the internet or your local network. For safety, the proxy allows only standard HTTP/HTTPS ports, blocks private or reserved IP addresses, follows and revalidates redirects, and limits upstream responses to 12 MB. It supports GET/HEAD browsing; sites that require logins, POST requests, scripts with cross-origin assumptions, or unrestricted cookies may not work. Proxied pages run in a sandboxed frame that prevents them from accessing this site's pages.

Opening the HTML files through a static server or GitHub Pages will not start the backend or enforce login. The authentication cookie and proxy require the local Node.js server.

## Publish with GitHub Pages

1. Push the repository to GitHub.
2. In the repository, open **Settings → Pages**.
3. Choose **Deploy from a branch**, select the branch containing the site and the repository root (`/`), then save.
4. GitHub Pages publishes `index.html` as the site entry point.

GitHub Pages only serves static files; it cannot run the backend, enforce login, or issue the authentication cookie. The login and protected pages require the local Node.js server.

## Static-site limitations

The vault's separate client-side key prompt is a front-end demonstration, not an additional access-control boundary. External services may block proxy browsing or require their own sign-in.
