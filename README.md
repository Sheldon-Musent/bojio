# BOJIO

> didn't invite you? find it yourself.

## Project Structure

```
bojio/
├── .github/
│   └── workflows/
│       └── deploy.yml   # CI/CD — builds and deploys to GitHub Pages
├── index.html           # Main user-facing page
├── admin.html           # Admin dashboard
├── css/
│   └── style.css        # Global styles
├── js/
│   ├── config.js        # Local secrets — gitignored, never committed
│   ├── config.example.js# Template — copy to config.js and fill in tokens
│   ├── map.js           # Map initialisation and controls
│   ├── pins.js          # Pin/marker management
│   ├── tracking.js      # Real-time location tracking
│   └── layers.js        # Map overlay layers
├── data/                # Static data assets (GeoJSON, config, etc.)
└── README.md
```

---

## Running locally

1. Copy `js/config.example.js` to `js/config.js`
2. Replace `YOUR_MAPBOX_TOKEN_HERE` with your Mapbox public token
3. Open `index.html` in a browser (a local server is recommended for geolocation)

`js/config.js` is gitignored — your token stays off the repo.

---

## Deployment (GitHub Pages)

The site deploys automatically on every push to `main` via GitHub Actions.

The workflow generates `js/config.js` at deploy time using a repository secret,
so the Mapbox token never touches the git history.

### First-time setup

**1. Add the secret**

Go to your repository on GitHub:
`Settings → Secrets and variables → Actions → New repository secret`

| Name | Value |
|------|-------|
| `MAPBOX_TOKEN` | your Mapbox public access token |

**2. Enable GitHub Pages via Actions**

Go to: `Settings → Pages → Source → GitHub Actions`

**3. Push to `main`**

The workflow triggers automatically. The live URL appears in the Actions run
summary once the deploy step completes.

> If the secret is missing or empty, the map will load but tiles will fail
> silently — Mapbox returns a 401 for an invalid token.
