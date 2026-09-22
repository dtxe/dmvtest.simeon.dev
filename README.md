# California DMV Practice

## Overview

We moved to California and could not find good online study resources that were recently updated and geared toward experienced drivers who needed to retest. This app provides focused California DMV practice questions, progress tracking, and review sets.

## Development

Requires Node.js 22 and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Run `npm test` for the test suite or `npm run build` to create a production build in `dist/`.

## GitHub Pages

The workflow in `.github/workflows/deploy-pages.yml` deploys the site whenever `main` is updated.

1. In the GitHub repository, open **Settings > Pages**.
2. Under **Build and deployment**, select **GitHub Actions** as the source.
3. Push to `main`, or run **Deploy to GitHub Pages** manually from the **Actions** tab.
4. Open the deployment URL shown in the completed workflow run.
