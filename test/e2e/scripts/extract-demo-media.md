# Extract demo media (optional)

After running `DEMO=1 npm run demo`, open `playwright-report/index.html` to pick a video.
The report stores videos in `test-results/**/video.webm`. You can copy one to docs:

```bash
# Example: copy the main demo video to docs/screenshots/demo.webm
cp -v test-results/*demo*/video.webm ../../docs/screenshots/demo.webm || true
```

When you prefer automation, set `CAPTURE_MEDIA=1` when running the docker helper. It can drive multiple demo projects (Chrome, Firefox, etc.), copy each project’s artifacts into `docs/screenshots/latest_demo/<project>/`, promote the preferred project’s `video.webm` to `docs/screenshots/demo.webm`, and (unless `EXPORT_GIF=0`) call the converter for you:

```bash
docker compose -f docker-compose.playwright.yml build playwright
UPDATE_SNAPSHOTS=1 CAPTURE_MEDIA=1 DEMO_PROJECTS=demo-chrome,demo-firefox scripts/run-playwright-docker.sh
```

Tweak behavior with:

- `PREFERRED_PROJECT=demo-firefox` to decide which project populates `docs/screenshots/demo.*`.
- `EXPORT_GIF=0` or `EXPORT_SCREENSHOT=0` to skip those promotions.
- `VERBOSE=1` for shell tracing inside and outside the container.
- `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0` to force a fresh browser fetch (skips by default because the Playwright image already has them).
- `PLAYWRIGHT_INSTALL_DEPS=1` to reinstall the system dependency bundle if you ever need to, otherwise it is skipped to avoid long apt runs.
- `PLAYWRIGHT_HEADLESS=0` to launch the browsers in headed mode (the helper auto-sets `PWDEBUG=console` unless you override it). Headed runs use the prebuilt Playwright image, so there is no long install pause anymore once the image is built.
- `PLAYWRIGHT_DISABLE_XVFB=1` to skip the virtual display wrapper (requires a DISPLAY to be forwarded into the container) and `PLAYWRIGHT_XVFB_SERVER_ARGS="-screen 0 1920x1080x24"` to tweak the virtual screen geometry.
- `PLAYWRIGHT_WORKERS=1` to force serial execution when debugging timing issues.

Optionally convert to GIF using the helper (skips the first ~2.4s of blank frames by default):

```bash
node webm-to-gif.js ../../docs/screenshots/demo.webm ../../docs/screenshots/demo.gif
```

Pass `--no-trim` to keep the full video, `--start 2.0` (or another value) to trim a different offset, or `--fps 12` / `--scale 1280:-1` to tweak density.
