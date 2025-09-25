Summary of findings
- The web UI currently lists suites (internal/webui/webui.go -> findSuites + /api/editor/suites) and opens an editor for an existing file when the user clicks Edit (internal/webui/static/index.html -> edit button calling /api/editor/suite?path=... and openEditor()).
- The server already supports saving arbitrary files under testdata via /api/editor/save (handleEditorSave). That handler will create new files (it does not require the path to already exist) and enforces isEditablePath(path) which restricts writes to testdata/*.yml|.yaml and rejects directories.
- Thus most of the work is on the UI: there is no “New suite” control or client-side workflow to pick a path/name, open an empty editor, run validation, and call /api/editor/save. No server changes are strictly required to make creating new suites work, but a small server-side helper endpoint and/or extra server-side safeguards are recommended.

Concrete plan (what needs to be done)
1. UI: add a “New suite” button and workflow
   - Add a “New” button in the sidebar near Import / Run.
   - When clicked:
     - Prompt the user for a filename (e.g., testdata/<name>.yaml) or ask for a suite name and auto-suggest a safe filename (e.g., testdata/<slug>.yaml).
     - Validate client-side that filename starts with testdata/ and ends with .yml/.yaml (to give immediate feedback).
     - Open the existing editor modal (reuse openEditor) with:
       - path set to the chosen path
       - data set to an empty/default models.Suite object (parsed) and an empty raw editor
       - mark in the UI that this is a “new” file (so Save button text can be “Create” and warn about overwrite)
   - On Save:
     - Run the same validate flow that the editor uses (/api/editor/validate). If validation passes (or user accepts warnings), POST to /api/editor/save with Parsed or Raw and Path.
     - Refresh suites list (call refresh()) so the new file appears in the list.

2. Front-end behavior/UX details
   - When the user supplies a suite name (not a filename), derive a safe filename:
     - Lowercase, replace spaces with '-', remove unsafe chars; then prefix with "testdata/" and append ".yaml".
     - If the generated file already exists, prompt to overwrite or ask for a different name.
   - Provide optional client-side auto-fill of suite.name in the editor from the entered filename.
   - After successful save, show confirmation and call refresh(); optionally open the saved file in editor or close the modal.

3. Minimal server-side improvements (recommended, not strictly required)
   - Add an API endpoint POST /api/editor/checkpath or /api/editor/new to:
     - Validate the path more strictly server-side (already mostly handled by isEditablePath, but returning a JSON response is nicer for UI).
     - Check whether a file already exists and return created/existing flag to avoid race/overwrite confusion.
   - Optionally add a server-side filename-suggestion endpoint that maps suite name -> safe path (helps keep client logic simple).
   - Ensure handleEditorSave behavior for new files is acceptable (atomicWriteWithBackup will create the file; backups are only created if file existed).

4. Tests
   - Unit tests:
     - Test isEditablePath for valid and malicious inputs (e.g., with .., absolute paths, directories).
     - Test handleEditorSave: saving a new file (path not present) results in created file and correct content; saving an existing file creates a .bak timestamped backup.
   - Integration test:
     - Headless UI test (or a small integration harness) that simulates new suite creation flow: request suggested path, open editor, validate, save, and confirm findSuites returns it.

5. Security & safety
   - Keep isEditablePath checks in place. Don't accept arbitrary paths from the client without server-side validation.
   - Sanitize client-proposed filenames; present clear UX when user attempts to overwrite.
   - Consider adding an allowlist or configuration option to restrict UI editing to development only.

Suggested minimal front-end patch
- Add a “New suite” button and client logic that prompts for a name, creates a safe path, then opens the editor with a minimal suite object. This is a minimal, safe UI-only change that leverages the existing /api/editor/save endpoint.

Proposed snippet to add to internal/webui/static/index.html (place near Import/Run buttons in the sidebar). This is a patch example you can drop into the file (client-side JS):

```html name=internal/webui/static/index.html
<!-- Add a New Suite button near Import / Run in the sidebar -->
<div class="row">
  <button id="newSuiteBtn" class="btn btn-sm">New Suite</button>
</div>

<script>
  // utility: make a safe filename from a given suite name
  function slugify(name) {
    return name.toLowerCase()
               .replace(/[^\w\s-]/g, '')
               .trim()
               .replace(/\s+/g, '-')
               .replace(/-+/g, '-');
  }

  async function promptNewSuite() {
    const name = prompt('Enter suite name (e.g. My API tests):');
    if (!name) return;
    const slug = slugify(name);
    const path = 'testdata/' + slug + '.yaml';
    // quick client-side validation: ensure path under testdata and extension ok
    if (!path.startsWith('testdata/') || (!path.endsWith('.yaml') && !path.endsWith('.yml'))) {
      alert('Invalid path generated. Please choose a different name.');
      return;
    }
    // If file exists, ask to confirm overwrite
    try {
      const resp = await fetch('/api/editor/suite?path=' + encodeURIComponent(path));
      if (resp.ok) {
        // file exists: confirm overwrite
        if (!confirm('A suite already exists at ' + path + '. Overwrite?')) return;
      }
      // If not ok (404), proceed to open editor for a new suite
    } catch (e) {
      // non-blocking; proceed
    }

    // Prepare minimal parsed object to prefill the editor
    const parsed = {
      name: name,
      baseUrl: "",
      vars: {},
      tests: [
        { name: "example test", request: { method: "GET", url: "/" }, assert: { status: 200 } }
      ]
    };

    // Reuse existing openEditor(path, data) function used by Edit.
    // Make sure openEditor uses ed_path element and populates editor fields from data.
    try {
      openEditor(path, parsed);
    } catch (e) {
      console.error('openEditor failed', e);
      alert('Failed to open editor: ' + (e && e.message ? e.message : e));
    }
  }

  document.getElementById('newSuiteBtn').addEventListener('click', promptNewSuite);
</script>
```

Notes about the snippet
- It reuses the existing openEditor(path, data) code path in the page so the editor modal does the heavy lifting of rendering the suite form + YAML editor.
- It checks for an existing file by trying GET /api/editor/suite?path=...; when the server returns 200 it indicates file exists and we prompt to confirm overwrite. (This mirrors current server semantics.)
- It uses /api/editor/save when the user clicks Save in the editor (no change required in server code); the editor already sends Parsed or Raw to /api/editor/save, so saving a new file will create it.

Backend helper (optional)
- Add a small endpoint to explicitly check path existence /api/editor/checkpath which returns {exists: true|false, safe: true|false}. This makes client logic simpler and avoids relying on the GET /api/editor/suite to test existence.

Example of a tiny server helper (optional) you can add to internal/webui/webui.go:

```go name=internal/webui/webui.go
// Add to routes(): s.mux.HandleFunc("/api/editor/checkpath", s.handleEditorCheckPath)

type checkPathReq struct {
  Path string `json:"path"`
}
type checkPathResp struct {
  Safe   bool `json:"safe"`
  Exists bool `json:"exists"`
}

func (s *server) handleEditorCheckPath(w http.ResponseWriter, r *http.Request) {
  if r.Method != http.MethodPost {
    w.WriteHeader(405); return
  }
  var req checkPathReq
  if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
    w.WriteHeader(400); return
  }
  safe := isEditablePath(req.Path)
  exists := false
  if safe {
    if _, err := os.Stat(req.Path); err == nil {
      exists = true
    }
  }
  w.Header().Set("Content-Type", "application/json")
  _ = json.NewEncoder(w).Encode(checkPathResp{Safe: safe, Exists: exists})
}
```

Tests to add
- internal/webui/webui_test.go: tests for isEditablePath valid/malicious inputs and for handleEditorSave creating a new file and backing up an existing file.
- An integration test (optional) that simulates the UI flow (headless browser or direct HTTP calls) to create a new suite and verify it appears in findSuites().

Edge cases & considerations
- Filename collisions: clearly prompt user before overwriting.
- Path traversal: isEditablePath is already restrictive; keep it.
- Error handling: surface YAML validation errors (the editor already shows validation messages).
- Concurrency/permission: ensure the server process has write permissions to testdata; atomicWriteWithBackup handles atomic replacement.
- In production, consider disabling write-from-UI or requiring a dev mode switch.

Wrap-up
- Minimal change set: add UI button + small JS flow to prompt for a name, compute a safe path, open the editor with a default suite, validate, and call /api/editor/save. This leverages the existing server save endpoint and requires no immediate server code changes.
- Recommended improvement: add a small server API to check path safety/existence and unit tests around the new behavior.

If you want, I can:
- Produce the concrete patch for the HTML/JS (full modified internal/webui/static/index.html) and a small Go handler for /api/editor/checkpath and a unit test skeleton for isEditablePath and handleEditorSave.