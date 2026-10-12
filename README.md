# SYSTEM_CORE

SYSTEM_CORE is a static website built with HTML, CSS, and vanilla JavaScript, with a local Node.js backend and Scramjet for embedded proxy browsing.

The dashboard is a search-first CORE_SEARCH home. Use **Settings** to choose DuckDuckGo, Google, or Bing; the selected engine is saved in the current browser.

The **Settings** page includes search-engine and theme preferences: select a preset accent, enter a custom hex color, and choose dark, light, or system appearance. Set an optional panic key and HTTP(S) destination there; pressing that unmodified key outside form controls opens the saved destination in a new tab. All preferences are saved in the current browser.

## Run the site and embedded browser

Install Node.js 20 or newer, then install the dependencies:

```sh
npm install
```

Start SYSTEM_CORE and Scramjet with:

```sh
npm start
```

Open `http://127.0.0.1:5000`; the root and `index.html` redirect straight to the dashboard. Enter a URL or search term in the address bar at the top of `main.html` or in CORE_SEARCH: URLs open directly, while search terms use the selected search engine. Destinations load inside the selected dashboard tab using Scramjet, with back, forward, refresh, new-tab, and clear-all controls. SYSTEM_CORE listens on port 5000 and Scramjet on port 8080; both bind to `127.0.0.1`. Set `PORT` or `SCRAMJET_PORT` to change these ports.

Add and remove up to 16 personal bookmarks below the CORE_SEARCH input. Bookmark names and URLs are stored in that browser's local storage and open inside the active dashboard tab.

The former Terminal URL redirects to the dashboard. The removed standalone browser, YouTube, Chat, Strongdog, Freezenova, and Entertainment pages are no longer included.

Scramjet is an AGPL-3.0-licensed upstream project. Its controller and Wisp transport are used by the local embedded browser.

The **Suggest a Change** page sends feature ideas, bug reports, and content suggestions to a Discord webhook. Configure `DISCORD_WEBHOOK_URL` in the private `.env` file for local use or as a Render secret for the public site (use a Discord webhook URL; never add it to client-side code or commit it). The `/github` URL suffix is for GitHub event integrations; suggestions are sent to the same webhook's standard message endpoint. The endpoint is rate-limited and accepts suggestions only when a webhook is configured.

The site footer shows the date of the latest site update. Update its `<time>` value and displayed date when publishing a new site revision.

The login flow and page/proxy access checks are currently disabled; the site opens directly without signing in. The previous sign-in API remains in the backend but is not used to protect pages or proxy requests. For local development, both services bind only to `127.0.0.1`; the Render deployment binds publicly so the GitHub Pages site can reach it.

Both local services listen only on `127.0.0.1`; they are not exposed to the internet or your local network. Scramjet runs the proxied site in its own embedded browsing context, separate from the SYSTEM_CORE origin. Its Wisp transport blocks private and loopback IP destinations. Browsing compatibility varies by site; external services may block proxy traffic or require their own sign-in.

Opening the HTML files through an arbitrary static server will not start the backend or provide proxy browsing. Use the Render services for the public site or the local Node.js services for development.

## Publish with GitHub Pages

1. Push the repository to GitHub.
2. In the repository, open **Settings → Pages**.
3. Choose **Deploy from a branch**, select the branch containing the site and the repository root (`/`), then save.
4. GitHub Pages publishes `index.html` as the site entry point.

GitHub Pages serves the static pages and the Scramjet client runtime. The address bar, search, and suggestions form also need the Render services described below; GitHub Pages cannot run the Node backend or Wisp proxy transport. Scramjet client assets in `scram`, `baremux`, and `libcurl` are copied from the installed packages with `npm run copy:scramjet-client`. The app embeds that client on its own origin, while the Wisp WebSocket transport runs on Render.

## Deploy the browser backend with Render

The root `render.yaml` Blueprint defines separate free web services for the API and Scramjet. In Render, create a new Blueprint from this repository and deploy both services. The public pages use the API URL configured in `runtime-config.js`; if Render assigns the API a different hostname, update that file to match and push the change.

During Blueprint setup, provide `DISCORD_WEBHOOK_URL` as a Render secret environment variable if suggestions should be delivered. Do not put the webhook URL in `runtime-config.js` or commit it to the repository. Free Render services may sleep when idle, so the first request after inactivity can take a little while to respond.

Both services run in Render, so the online site does not depend on your laptop being on. `npm start` continues to run the API and Scramjet locally on ports 5000 and 8080 for development.

## Static-site limitations

The vault's separate client-side key prompt is a front-end demonstration, not an additional access-control boundary. External services may block proxy browsing or require their own sign-in.
