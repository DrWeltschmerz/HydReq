// editor/modal.js — modal shell: open/close, title, density, create banner
(function(){
  function ensureModal(){
    let modal = document.getElementById('editorModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'editorModal';
    modal.innerHTML = '';
    document.body.appendChild(modal);
    return modal;
  }

  function open(opts){
    const modal = ensureModal();
    const title = (opts && opts.title) || 'Editor';
    const createMode = !!(opts && opts.create);
    const path = (opts && opts.path) || '';

    // Render full editor shell expected by editor.js, plus a title and optional create badge
    modal.innerHTML = `
      <div class="editor-root">
        <div class="ed-header">
          <div class="ed-header-left ed-row-8 ed-ai-center">
            ${createMode ? '<span class="badge badge-info">New suite</span>' : ''}
            <h3 class="m-0" id="ed_title">${title || path}</h3>
            <div class="fw-600" style="margin-left:12px;">Edit: <span id="ed_path"></span></div>
          </div>
          <div class="ed-actions">
            <label class="label cursor-pointer ed-row-6 ed-ai-center">
              <span class="label-text">Comfortable</span>
              <input id="ed_density" type="checkbox" class="toggle toggle-sm" title="Toggle comfortable density">
            </label>
            <label class="label cursor-pointer ed-row-6 ed-ai-center" title="Include dependsOn when running the selected test">
              <span class="label-text">with deps</span>
              <input id="ed_run_with_deps" type="checkbox" class="toggle toggle-sm">
            </label>
            <label class="label cursor-pointer ed-row-6 ed-ai-center" title="Include all tests from previous stages before the selected one">
              <span class="label-text">with previous stages</span>
              <input id="ed_run_with_prevstages" type="checkbox" class="toggle toggle-sm">
            </label>
            <button id="ed_run_test" class="btn btn-sm" title="Validate and run the selected test without saving">Run test</button>
            <button id="ed_run_suite" class="btn btn-sm" title="Validate and run the whole suite without saving">Run suite</button>
            <button id="ed_validate" class="btn btn-sm">Validate</button>
            <button id="ed_save" class="btn btn-sm">Save</button>
            <button id="ed_save_close" class="btn btn-sm">Save & Close</button>
            <button id="ed_close" type="button" class="btn btn-sm" title="Close">Close</button>
            <span id="ed_dirty_indicator" class="pill" title="You have unsaved changes" style="margin-left:8px; display:none; background:#fde2e1; color:#b91c1c">Unsaved</span>
          </div>
        </div>
        <div class="ed-main">
          <!-- Column 1: Tests List -->
          <div id="col-tests" class="ed-col">
            <div class="ed-col-header">
              <span class="fw-600">Tests</span>
              <div class="ed-row-6">
                <button id="ed_collapse_tests" class="btn btn-xs ed-collapse-btn" title="Collapse/Expand tests">◀</button>
                <button id="ed_add_test" class="btn btn-xs" title="Add test">+</button>
                <button id="ed_del_test" class="btn btn-xs" title="Delete selected">−</button>
              </div>
            </div>
            <div class="ed-col-content ed-tests-panel">
              <div id="ed_tests" class="ed-tests-list"></div>
            </div>
          </div>

          <!-- Column 2: Visual Editor -->
          <div id="col-visual" class="ed-col">
            <div class="ed-col-header">
              <span class="fw-600">Visual Editor</span>
              <div class="ed-row-6">
                <button id="ed_collapse_visual" class="btn btn-xs ed-collapse-btn" title="Collapse/Expand visual editor">◀</button>
              </div>
            </div>
            <div class="ed-col-content" id="pane_visual">
            <div class="ed-center">
              <details open class="ed-panel">
                <summary class="ed-summary">🏠 Suite Configuration</summary>
                <div class="ed-body ed-grid-2-140" id="ed_suite_form">
                  <label>Name *</label>
                  <input id="ed_suite_name" type="text" required/>
                  <label>Base URL *</label>
                  <input id="ed_suite_baseurl" type="text" placeholder="https://api.example.com" required/>
                  <label class="ed-col-span-full ed-mt-6 fw-600">Variables</label>
                  <div class="ed-col-span-full" id="ed_suite_vars"></div>
                  <label class="ed-col-span-full ed-mt-6 fw-600">Auth</label>
                  <div class="ed-col-span-full ed-grid-2-160">
                    <label>Bearer env</label>
                    <div class="ed-row-8 ed-ai-center">
                      <input id="ed_auth_bearer" type="text" placeholder="DEMO_BEARER"/>
                      <span id="ed_auth_bearer_status" class="pill" title="env presence">?</span>
                    </div>
                    <label>Basic env</label>
                    <div class="ed-row-8 ed-ai-center">
                      <input id="ed_auth_basic" type="text" placeholder="BASIC_B64"/>
                      <span id="ed_auth_basic_status" class="pill" title="env presence">?</span>
                    </div>
                  </div>
                  <div class="ed-col-span-full ed-grid-2-160 ed-ai-center">
                    <label>Auth header (preview)</label>
                    <div id="ed_auth_preview" class="ed-mono-dim">(none)</div>
                  </div>
                </div>
              </details>
              <details open class="ed-panel">
                <summary class="ed-summary">🧪 Test</summary>
                <div class="ed-body ed-grid-2-140" id="ed_test_form">
                  <label>Name *</label>
                  <input id="ed_test_name" type="text" required/>
                  <label>Stage</label>
                  <input id="ed_test_stage" type="number" min="0" max="999" step="1"/>
                  <label>Depends on</label>
                  <input id="ed_test_depends" type="text" placeholder="comma-separated test names"/>
                </div>
                <div class="ed-body ed-grid-2-140" id="ed_flow_form">
                  <label>Skip</label>
                  <input id="ed_skip" type="checkbox"/>
                  <label>Only</label>
                  <input id="ed_only" type="checkbox"/>
                  <label>Stage</label>
                  <input id="ed_stage" type="number" min="0" max="999" step="1"/>
                </div>
              </details>
              <details open class="ed-panel">
                <summary class="ed-summary">🌐 Request</summary>
                <div class="ed-body" id="ed_request">
                  <div id="ed_req_form" class="ed-grid-2-140">
                    <label>Method</label>
                    <select id="ed_method">
                      <option>GET</option>
                      <option>POST</option>
                      <option>PUT</option>
                      <option>PATCH</option>
                      <option>DELETE</option>
                      <option>HEAD</option>
                      <option>OPTIONS</option>
                    </select>
                    <label>URL</label>
                    <input id="ed_url" type="text" placeholder="/path"/>
                    <label>Timeout (ms)</label>
                    <input id="ed_timeout" type="number" min="0" step="1"/>
                    <label>Headers</label>
                    <div id="ed_headers"></div>
                    <label>Query</label>
                    <div id="ed_query"></div>
                    <label>Body</label>
                    <textarea id="ed_body" style="min-height: 90px"></textarea>
                  </div>
                </div>
              </details>
              <details open class="ed-panel">
                <summary class="ed-summary">✅ Assert</summary>
                <div class="ed-body" id="ed_assert">
                  <div id="ed_assert_form" class="ed-grid-2-140">
                    <label>Status</label>
                    <input id="ed_assert_status" type="number" min="100" max="599" step="1"/>
                    <label>Max duration (ms)</label>
                    <input id="ed_assert_maxDuration" type="number" min="0" step="1"/>
                  </div>
                </div>
              </details>
              <details class="ed-panel">
                <summary class="ed-summary">📦 Extract</summary>
                <div class="ed-body" id="ed_extract"></div>
              </details>
              <details class="ed-panel tight">
                <summary class="ed-summary">🏷️ Tags & Matrix</summary>
                <div class="ed-body ed-grid-2-140" id="ed_tags_matrix">
                  <label>Tags</label>
                  <input id="ed_tags" type="text" placeholder="comma-separated tags"/>
                  <label>Matrix</label>
                  <div class="ed-col-span-full" id="ed_matrix"></div>
                </div>
              </details>

              <details open class="ed-panel tight">
                <summary class="ed-summary">OpenAPI</summary>
                <div class="ed-body ed-grid-2-160" id="ed_oapi_form">
                  <label>Per-test override</label>
                  <select id="ed_oapi_enabled">
                    <option value="inherit">Inherit (suite default)</option>
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>
              </details>
            </div>
            </div>
          </div>
          
          <!-- Column 3: YAML Editor -->
          <div id="col-yaml" class="ed-col">
            <div class="ed-col-header">
              <span class="fw-600">YAML Source</span>
              <div class="ed-row-6">
                <button id="ed_collapse_yaml" class="btn btn-xs ed-collapse-btn" title="Collapse/Expand YAML editor">◀</button>
              </div>
            </div>
            <div class="ed-col-content" id="pane_yaml">
              <textarea id="ed_raw" class="hidden"></textarea>
              <div id="ed_yaml_editor" style="flex: 1;"></div>
            </div>
          </div>
          
          <!-- Column 4: Results -->
          <div id="col-results" class="ed-col">
            <div class="ed-col-header">
              <span class="fw-600">Results</span>
              <div class="ed-row-6">
                <button id="ed_collapse_results" class="btn btn-xs ed-collapse-btn" title="Collapse/Expand results">◀</button>
              </div>
            </div>
            <div class="ed-col-content">
              <div id="ed_preview" class="ed-preview">
                <details id="ed_quickrun_box" class="ed-section" open>
                  <summary>Quick run</summary>
                  <div id="ed_quickrun" class="log ed-scroll"></div>
                </details>
                <details id="ed_validation_box" class="ed-section" open>
                  <summary class="ed-row-8 ed-ai-center ed-justify-between">
                    <span>Validation</span>
                    <button id="ed_copy_issues" class="btn btn-xs" title="Copy issues">Copy</button>
                  </summary>
                  <div id="ed_issues" class="ed-scroll"></div>
                </details>
              </div>
            </div>
          </div>
        </div>
        </div>
      `;

    const closeBtn = modal.querySelector('#ed_close');
    if (closeBtn) closeBtn.onclick = () => close();
    return modal;
  }

  function setTitle(text){
    const el = document.querySelector('#editorModal #ed_title');
    if (el) el.textContent = text || '';
  }

  function close(){
    const modal = document.getElementById('editorModal');
    if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
  }

  window.hydreqEditorModal = window.hydreqEditorModal || { open, setTitle, close };
})();
