# Virtual Diesel Trainer

Interactive 3D trainer for a four-cylinder marine diesel (D2-60 class) with saildrive:
parts explorer, service schedule, fault finder, hidden-fault practice and guided service jobs.

It is a static web app with no build step. It uses plain ES modules, and three.js r128 loads from jsDelivr through an import map.
It installs as an app (PWA) and works offline after the first visit.

## Run locally

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173. Any static server works. Opening `index.html` directly from disk does not work, because ES modules need http.

## Deploy

Upload the folder as-is to any static host: GitHub Pages, Netlify (drag and drop), Cloudflare Pages, S3 and so on.
Serve it over HTTPS so the service worker and the "Install app" button work.

When you release changes, bump `VERSION` in `sw.js` so installed copies drop the old cache.

## What it adds over the original artifact

- **Installable and offline.** It has a manifest, icons and a service worker (`sw.js`). App files are fetched network-first; three.js and the fonts are cached after the first load.
- **Remembers on this device** (localStorage, keys prefixed `vdt:`): engine hours and months on the Service tab, sound on or off, theme, practice record and best score per guided job.
- **Deep links.** `#part/rawpump`, `#service`, `#faults`, `#practice`, `#jobs/impeller` (also `oilchange`, `fuelfilter`, `beltchange`).
- **Theme switch** (Auto, Light, Dark) and safe-area padding for notched phones.

## Layout

```
index.html              page markup, import map
sw.js                   offline cache
manifest.webmanifest    install metadata
icons/                  app icons
src/styles.css          all styles (theme tokens at the top)
src/main.js             panels, practice simulator, guided jobs, 3D model, render loop
src/audio.js            synthesised engine sound
src/shell.js            theme, install button, service worker registration
src/store.js            localStorage wrapper
src/data/engine.js      systems, parts, service schedule, fault table
src/data/faults.js      cause details, alarm lamps, emergency start, reference values
src/data/scenarios.js   practice-mode hidden faults
src/data/jobs.js        guided job steps, questions and model poses
```

Most content changes, such as wording, intervals, new faults or new job steps, only need edits in `src/data/`.

Training concept only. Always work from the manufacturer's manual for your exact engine.
