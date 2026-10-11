# SYSTEM_CORE

SYSTEM_CORE is a static website built with HTML, CSS, and vanilla JavaScript. It has no server-side runtime, backend API, build step, or package dependencies.

## Run locally

Open this folder in VS Code and use a static web server extension such as Live Server, or start any local HTTP server from the project folder. Then open `index.html` through that server.

Some browser features, including storage and embedded media, may behave differently when opening HTML files directly with a `file://` URL.

## Publish with GitHub Pages

1. Push the repository to GitHub.
2. In the repository, open **Settings → Pages**.
3. Choose **Deploy from a branch**, select the branch containing the site and the repository root (`/`), then save.
4. GitHub Pages publishes `index.html` as the site entry point.

All internal page links use relative paths so they work both at the repository root and under a GitHub Pages project-site path.

## Static-site limitations

GitHub Pages only hosts static files. It cannot run private server logic, proxy external websites, or securely protect pages with client-side passwords. The portal login and vault are front-end demonstrations, not access controls. External services may block embedding or require their own sign-in; links to those services open outside this site.
