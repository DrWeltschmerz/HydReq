# Extract demo media (optional)

After running `DEMO=1 npm run demo`, open `playwright-report/index.html` to pick a video.
The report stores videos in `test-results/**/video.webm`. You can copy one to docs:

```bash
# Example: copy the main demo video to docs/screenshots/demo.webm
cp -v test-results/*demo*/video.webm ../../docs/screenshots/demo.webm || true
```

Optionally convert to GIF (requires ffmpeg; size may be large):

```bash
ffmpeg -y -i ../../docs/screenshots/demo.webm \
  -vf "fps=15,scale=960:-1:flags=lanczos" \
  ../../docs/screenshots/demo.gif
```
