Playwright E2E tests for HydReq

Quickstart

1. Ensure the hydreq server GUI is reachable at http://localhost:8080/ or set HYDREQ_E2E_URL.
2. From the repo root, install deps and run tests:

```bash
cd test/e2e
npm ci
npx playwright install --with-deps
HYDREQ_E2E_URL=http://localhost:8080/ npx playwright test
```

Local CI helper

You can also run the Playwright tests via the repo helper which will start docker services and the GUI:

```bash
# Start services, run go tests, then Playwright
RUN_PLAYWRIGHT=1 ./scripts/local-ci.sh
```

Notes

- The Playwright tests expect the GUI markup to include selectors used in test/e2e/editor.spec.js. If the test fails due to selector mismatch, update the spec to match the DOM.
- CI workflow will run Playwright on ubuntu-latest and install browsers automatically.
