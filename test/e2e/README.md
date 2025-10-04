# HydReq E2E (Playwright)

## Run tests locally

```
cd test/e2e
npm ci
HYDREQ_E2E_URL=http://localhost:8787/ npm test
```

Make sure the GUI is running (hydreq gui). By default it listens on localhost:8787.

## Update visual regression baselines

Playwright will compare snapshots in `tests/*-snapshots`. After intentional UI changes:

```
cd test/e2e
HYDREQ_E2E_URL=http://localhost:8787/ npx playwright test --update-snapshots
```

This will write new `*-linux.png` baselines for the configured viewport.

## Record a demo video (shows live suite streaming)

Use the demo profile to enable video, screenshots, trace and slowMo for clarity:

```
cd test/e2e
npm run demo
```

Artifacts are saved under `playwright-report/` and `test-results/`. A helper script exists to convert `.webm` to `.gif` for docs: `scripts/webm-to-gif.js`.
