# Docs maintenance checklist

Goal: keep docs up to date and reduce duplication by treating USER_GUIDE as the primary entry point.

- [ ] User Guide (USER_GUIDE.md): review end-to-end once per milestone; add/remove sections as features evolve.
- [ ] Visual Editor (visual-editor.md): ensure screenshots reflect current UI; re-run Playwright demo to refresh images/videos.
- [ ] README: link to USER_GUIDE, demo video block, and key quick starts; keep concise.
- [ ] Getting Started / CLI / Web UI: keep only value-add details not already in USER_GUIDE; trim overlap; add banner notes.
- [ ] Adapters / Reports / Hooks / Scripting / SQL hooks / OpenAPI: remain detailed topic pages; cross-link from USER_GUIDE where appropriate.
- [ ] Remove or archive deprecated docs (mark with deprecated: true in front-matter if used) once content is fully moved.
- [ ] CI: periodically run demo capture to regenerate screenshots; attach Playwright report artifacts for reference.