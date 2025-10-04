// editor/modal.js — modal shell: open/close, title, density, create banner
(function(){
  function el(tag, attrs, children){
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === 'class' || k === 'className') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k]; // only for static, but avoid using elsewhere
        else if (k === 'open') node.open = !!attrs[k];
        else if (k === 'for') node.htmlFor = attrs[k];
        else node.setAttribute(k, attrs[k]);
      }
    }
    if (children && children.length){
      for (const c of children){
        if (c == null) continue;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      }
    }
    return node;
  }

  function clearChildren(node){
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function ensureModal(){
    let modal = document.getElementById('editorModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'editorModal';
      document.body.appendChild(modal);
    }
    return modal;
  }

  function buildHeader(opts){
    const titleText = (opts && (opts.title || opts.path)) || 'Editor';
    const createMode = !!(opts && opts.create);

    const left = el('div', { class: 'ed-header-left ed-row-8 ed-ai-center' }, [
      createMode ? el('span', { class: 'badge badge-info', text: 'New suite' }) : null,
      el('h3', { class: 'm-0', id: 'ed_title', text: titleText }),
      (function(){
        const wrap = el('div', { class: 'fw-600 ed-ml-6' });
        wrap.appendChild(document.createTextNode('Edit: '));
        wrap.appendChild(el('span', { id: 'ed_path' }));
        return wrap;
      })()
    ]);

    const actions = el('div', { class: 'ed-actions' }, [
      (function(){
        const label = el('label', { class: 'label cursor-pointer ed-row-6 ed-ai-center', for: 'ed_density' });
        label.appendChild(el('span', { class: 'label-text', text: 'Comfortable' }));
        label.appendChild(el('input', { id: 'ed_density', type: 'checkbox', class: 'toggle toggle-sm', title: 'Toggle comfortable density', 'aria-label': 'Toggle comfortable density' }));
        return label;
      })(),
      (function(){
        const label = el('label', { class: 'label cursor-pointer ed-row-6 ed-ai-center', title: 'Include dependsOn when running the selected test', for: 'ed_run_with_deps' });
        label.appendChild(el('span', { class: 'label-text', text: 'with deps' }));
        label.appendChild(el('input', { id: 'ed_run_with_deps', type: 'checkbox', class: 'toggle toggle-sm', 'aria-label': 'Include dependsOn when running the selected test' }));
        return label;
      })(),
      (function(){
        const label = el('label', { class: 'label cursor-pointer ed-row-6 ed-ai-center', title: 'Include all tests from previous stages before the selected one', for: 'ed_run_with_prevstages' });
        label.appendChild(el('span', { class: 'label-text', text: 'with previous stages' }));
        label.appendChild(el('input', { id: 'ed_run_with_prevstages', type: 'checkbox', class: 'toggle toggle-sm', 'aria-label': 'Include all tests from previous stages' }));
        return label;
      })(),
      el('button', { id: 'ed_run_test', class: 'btn btn-sm', title: 'Validate and run the selected test without saving', text: 'Run test' }),
      el('button', { id: 'ed_run_suite', class: 'btn btn-sm', title: 'Validate and run the whole suite without saving', text: 'Run suite' }),
      el('button', { id: 'ed_validate', class: 'btn btn-sm', text: 'Validate' }),
      el('button', { id: 'ed_save', class: 'btn btn-sm', text: 'Save' }),
      el('button', { id: 'ed_save_close', class: 'btn btn-sm', text: 'Save & Close' }),
      el('button', { id: 'ed_close', type: 'button', class: 'btn btn-sm', title: 'Close', text: 'Close' }),
      el('span', { id: 'ed_dirty_indicator', class: 'pill hidden', title: 'You have unsaved changes' }, [ 'Unsaved' ])
    ]);

    return el('div', { class: 'ed-header' }, [ left, actions ]);
  }

  function detailsPanel(summaryText, bodyChildren, opts){
    const d = el('details', Object.assign({ class: 'ed-panel', open: true }, opts || {}));
    d.appendChild(el('summary', { class: 'ed-summary', text: summaryText }));
    const body = el('div', { class: 'ed-body' });
    if (Array.isArray(bodyChildren)) {
      for (const c of bodyChildren) body.appendChild(c);
    } else if (bodyChildren) {
      body.appendChild(bodyChildren);
    }
    d.appendChild(body);
    return d;
  }

  function buildColumnTests(){
    const headerRight = el('div', { class: 'ed-row-6' }, [
      el('button', { id: 'ed_collapse_tests', class: 'btn btn-xs ed-collapse-btn', title: 'Collapse/Expand tests', 'aria-label': 'Collapse or expand tests column' }, ['◀']),
      el('button', { id: 'ed_add_test', class: 'btn btn-xs', title: 'Add test' }, ['+']),
      el('button', { id: 'ed_del_test', class: 'btn btn-xs', title: 'Delete selected' }, ['−'])
    ]);
    const header = el('div', { class: 'ed-col-header' }, [
      el('span', { class: 'fw-600', text: 'Tests' }),
      headerRight
    ]);
    const content = el('div', { class: 'ed-col-content ed-tests-panel' }, [
      el('div', { id: 'ed_tests', class: 'ed-tests-list' })
    ]);
    return el('div', { id: 'col-tests', class: 'ed-col' }, [ header, content ]);
  }

  function buildSuiteConfig(){
    const form = el('div', { class: 'ed-body ed-grid-2-140', id: 'ed_suite_form' });
  form.appendChild(el('label', { text: 'Name *', for: 'ed_suite_name' }));
    form.appendChild(el('input', { id: 'ed_suite_name', type: 'text', required: '' }));
  form.appendChild(el('label', { text: 'Base URL *', for: 'ed_suite_baseurl' }));
    form.appendChild(el('input', { id: 'ed_suite_baseurl', type: 'text', placeholder: 'https://api.example.com', required: '' }));
    form.appendChild(el('label', { class: 'ed-col-span-full ed-mt-6 fw-600', text: 'Variables' }));
    form.appendChild(el('div', { class: 'ed-col-span-full', id: 'ed_suite_vars' }));
    form.appendChild(el('label', { class: 'ed-col-span-full ed-mt-6 fw-600', text: 'Auth' }));
    const authGrid = el('div', { class: 'ed-col-span-full ed-grid-2-130' });
    authGrid.appendChild(el('label', { text: 'Bearer env', for: 'ed_auth_bearer' }));
    const bearerRow = el('div', { class: 'ed-row-8 ed-ai-center' }, [
      el('input', { id: 'ed_auth_bearer', type: 'text', placeholder: 'DEMO_BEARER' }),
      el('span', { id: 'ed_auth_bearer_status', class: 'pill', title: 'env presence' }, ['?'])
    ]);
    authGrid.appendChild(bearerRow);
    authGrid.appendChild(el('label', { text: 'Basic env', for: 'ed_auth_basic' }));
    const basicRow = el('div', { class: 'ed-row-8 ed-ai-center' }, [
      el('input', { id: 'ed_auth_basic', type: 'text', placeholder: 'BASIC_B64' }),
      el('span', { id: 'ed_auth_basic_status', class: 'pill', title: 'env presence' }, ['?'])
    ]);
    authGrid.appendChild(basicRow);
    form.appendChild(authGrid);
    const previewRow = el('div', { class: 'ed-col-span-full ed-grid-2-160 ed-ai-center' }, [
      el('label', { text: 'Auth header (preview)' }),
      el('div', { id: 'ed_auth_preview', class: 'ed-mono-dim', text: '(none)' })
    ]);
    form.appendChild(previewRow);

    // Suite-level OpenAPI configuration
    form.appendChild(el('div', { class: 'ed-col-span-full ed-mt-6 fw-600', text: 'OpenAPI' }));
  form.appendChild(el('label', { text: 'Spec file', for: 'ed_suite_openapi_file' }));
    form.appendChild(el('input', { id: 'ed_suite_openapi_file', type: 'text', placeholder: 'path/to/spec.yaml' }));
  form.appendChild(el('label', { text: 'Enabled', for: 'ed_suite_openapi_enabled' }));
  form.appendChild(el('input', { id: 'ed_suite_openapi_enabled', type: 'checkbox', 'aria-label': 'Enable OpenAPI validation for suite' }));

    const hooksBlock = el('div', { class: 'ed-col-span-full ed-grid-2-160 ed-ai-start', id: 'ed_suite_hooks_block' });
    hooksBlock.appendChild(el('label', { text: 'Suite hooks' }));
    const hooksWrap = el('div');
    hooksWrap.appendChild(el('div', { class: 'ed-subhead', text: 'preSuite' }));
    hooksWrap.appendChild(el('div', { id: 'ed_suite_presuite' }));
    hooksWrap.appendChild(el('div', { class: 'ed-spacer-8' }));
    hooksWrap.appendChild(el('div', { class: 'ed-subhead', text: 'postSuite' }));
    hooksWrap.appendChild(el('div', { id: 'ed_suite_postsuite' }));
    hooksBlock.appendChild(hooksWrap);
    return detailsPanel('🏠 Suite Configuration', form);
  }

  function buildTestConfig(){
    const form = el('div', { class: 'ed-body ed-grid-2-130', id: 'ed_test_form' });
    form.appendChild(el('label', { text: 'Test name *' }));
    form.appendChild(el('input', { id: 'ed_test_name', type: 'text', placeholder: 'My test name', required: '' }));
    form.appendChild(el('label', { text: 'Stage' }));
    form.appendChild(el('input', { id: 'ed_stage', type: 'number', min: '0' }));
    form.appendChild(el('label', { text: 'Skip' }));
    form.appendChild(el('input', { id: 'ed_skip', type: 'checkbox' }));
    form.appendChild(el('label', { text: 'Only' }));
    form.appendChild(el('input', { id: 'ed_only', type: 'checkbox' }));
    form.appendChild(el('label', { text: 'Depends on' }));
    form.appendChild(el('input', { id: 'ed_test_depends', type: 'text', placeholder: 'comma-separated' }));
    form.appendChild(el('label', { text: 'Tags' }));
    form.appendChild(el('input', { id: 'ed_tags', type: 'text', placeholder: 'comma-separated' }));
    const d = el('details', { class: 'ed-panel', open: true });
    d.appendChild(el('summary', { class: 'ed-summary', text: '🧪 Test Configuration' }));
    d.appendChild(form);
    return d;
  }

  function buildHttpRequest(){
    const form = el('div', { id: 'ed_req_form', class: 'ed-grid-2-130' });
    form.appendChild(el('label', { text: 'Method *' }));
    const sel = el('select', { id: 'ed_method', required: '' });
    ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].forEach(m => {
      sel.appendChild(el('option', { text: m }));
    });
    form.appendChild(sel);
    form.appendChild(el('label', { text: 'URL path *' }));
    form.appendChild(el('input', { id: 'ed_url', type: 'text', required: '' }));
    form.appendChild(el('label', { text: 'Timeout (ms)' }));
    form.appendChild(el('input', { id: 'ed_timeout', type: 'number', min: '0', step: '1' }));
    form.appendChild(el('label', { class: 'ed-col-span-full ed-mt-6 fw-600', text: 'Headers' }));
    form.appendChild(el('div', { class: 'ed-col-span-full', id: 'ed_headers' }));
    form.appendChild(el('label', { class: 'ed-col-span-full ed-mt-6 fw-600', text: 'Query' }));
    form.appendChild(el('div', { class: 'ed-col-span-full', id: 'ed_query' }));
    form.appendChild(el('label', { class: 'ed-col-span-full ed-mt-6 fw-600', text: 'Body (JSON/YAML)' }));
    form.appendChild(el('textarea', { id: 'ed_body', class: 'ed-col-span-full ed-textarea-md' }));
    const d = el('details', { class: 'ed-panel', open: true });
    d.appendChild(el('summary', { class: 'ed-summary', text: '🌐 HTTP Request' }));
    const body = el('div', { class: 'ed-body', id: 'ed_request' }, [ form ]);
    d.appendChild(body);
    return d;
  }

  function buildAssertions(){
    const form = el('div', { id: 'ed_assert_form', class: 'ed-grid-2-160' });
    form.appendChild(el('label', { text: 'Status *' }));
    form.appendChild(el('input', { id: 'ed_assert_status', type: 'number', min: '0', required: '' }));
    form.appendChild(el('label', { text: 'Header equals' }));
    form.appendChild(el('div', { id: 'ed_assert_headerEquals', class: 'ed-grid-col-2' }));
    form.appendChild(el('label', { text: 'JSON equals (path → value)' }));
    form.appendChild(el('div', { id: 'ed_assert_jsonEquals', class: 'ed-grid-col-2' }));
    form.appendChild(el('label', { text: 'JSON contains (path → value)' }));
    form.appendChild(el('div', { id: 'ed_assert_jsonContains', class: 'ed-grid-col-2' }));
    form.appendChild(el('label', { text: 'Body contains' }));
    form.appendChild(el('div', { id: 'ed_assert_bodyContains', class: 'ed-grid-col-2' }));
    form.appendChild(el('label', { text: 'Max duration (ms)' }));
    form.appendChild(el('input', { id: 'ed_assert_maxDuration', type: 'number', min: '0' }));
    const d = el('details', { class: 'ed-panel', open: true });
    d.appendChild(el('summary', { class: 'ed-summary', text: '✅ Response Assertions' }));
    d.appendChild(el('div', { class: 'ed-body', id: 'ed_assert' }, [ form ]));
    return d;
  }

  function buildExtract(){
    const d = el('details', { class: 'ed-panel', open: true });
    d.appendChild(el('summary', { class: 'ed-summary', text: '📦 Extract' }));
    d.appendChild(el('div', { class: 'ed-body', id: 'ed_extract' }));
    return d;
  }

  function buildHooks(){
    const d = el('details', { class: 'ed-panel', open: true });
    d.appendChild(el('summary', { class: 'ed-summary', text: '🔗 Test Hooks' }));
    const body = el('div', { class: 'ed-body' });
    body.appendChild(el('div', { class: 'ed-subhead', text: 'pre' }));
    body.appendChild(el('div', { id: 'ed_test_prehooks' }));
    body.appendChild(el('div', { class: 'ed-spacer-8' }));
    body.appendChild(el('div', { class: 'ed-subhead', text: 'post' }));
    body.appendChild(el('div', { id: 'ed_test_posthooks' }));
    d.appendChild(body);
    return d;
  }

  function buildRetry(){
    const form = el('div', { class: 'ed-body ed-grid-2-160', id: 'ed_retry_form' });
    form.appendChild(el('label', { text: 'Enable retry' }));
    form.appendChild(el('input', { id: 'ed_retry_enable', type: 'checkbox' }));
    form.appendChild(el('label', { text: 'Max attempts' }));
    form.appendChild(el('input', { id: 'ed_retry_max', type: 'number', min: '0' }));
    form.appendChild(el('label', { text: 'Backoff (ms)' }));
    form.appendChild(el('input', { id: 'ed_retry_backoff', type: 'number', min: '0' }));
    form.appendChild(el('label', { text: 'Jitter (%)' }));
    form.appendChild(el('input', { id: 'ed_retry_jitter', type: 'number', min: '0', max: '100' }));
    const d = el('details', { class: 'ed-panel', open: true });
    d.appendChild(el('summary', { class: 'ed-summary', text: '🔄 Retry Policy' }));
    d.appendChild(form);
    return d;
  }

  function buildMatrix(){
    const d = el('details', { class: 'ed-panel', open: true });
    d.appendChild(el('summary', { class: 'ed-summary', text: '🔢 Data Matrix' }));
    d.appendChild(el('div', { class: 'ed-body', id: 'ed_matrix' }));
    return d;
  }

  function buildOpenAPI(){
    const d = el('details', { class: 'ed-panel', open: true });
    d.appendChild(el('summary', { class: 'ed-summary', text: 'OpenAPI' }));
    const body = el('div', { class: 'ed-body ed-grid-2-160', id: 'ed_oapi_form' });
    body.appendChild(el('label', { text: 'Per-test override' }));
    const sel = el('select', { id: 'ed_oapi_enabled' });
    sel.appendChild(el('option', { value: 'inherit', text: 'Inherit (suite default)' }));
    sel.appendChild(el('option', { value: 'true', text: 'Enabled' }));
    sel.appendChild(el('option', { value: 'false', text: 'Disabled' }));
    body.appendChild(sel);
    d.appendChild(body);
    return d;
  }

  function buildColumnVisual(){
    const headerRight = el('div', { class: 'ed-row-6' }, [
      el('button', { id: 'ed_collapse_visual', class: 'btn btn-xs ed-collapse-btn', title: 'Collapse/Expand visual editor', 'aria-label': 'Collapse or expand visual editor column' }, ['◀'])
    ]);
    const header = el('div', { class: 'ed-col-header' }, [
      el('span', { class: 'fw-600', text: 'Visual Editor' }),
      headerRight
    ]);
    const center = el('div', { class: 'ed-center' }, [
      buildSuiteConfig(),
      buildTestConfig(),
      buildHttpRequest(),
      buildAssertions(),
      buildExtract(),
      buildHooks(),
      buildRetry(),
      buildMatrix(),
      buildOpenAPI()
    ]);
    const content = el('div', { class: 'ed-col-content', id: 'pane_visual' }, [ center ]);
    return el('div', { id: 'col-visual', class: 'ed-col' }, [ header, content ]);
  }

  function buildColumnYaml(){
    const headerRight = el('div', { class: 'ed-row-6' }, [
      el('button', { id: 'ed_collapse_yaml', class: 'btn btn-xs ed-collapse-btn', title: 'Collapse/Expand YAML editor', 'aria-label': 'Collapse or expand YAML editor column' }, ['◀'])
    ]);
    const header = el('div', { class: 'ed-col-header' }, [
      el('span', { class: 'fw-600', text: 'YAML Source' }),
      headerRight
    ]);
    const content = el('div', { class: 'ed-col-content', id: 'pane_yaml' }, [
      el('textarea', { id: 'ed_raw', class: 'hidden' }),
      el('div', { id: 'ed_yaml_editor' })
    ]);
    return el('div', { id: 'col-yaml', class: 'ed-col' }, [ header, content ]);
  }

  function buildColumnResults(){
    const headerRight = el('div', { class: 'ed-row-6' }, [
      el('button', { id: 'ed_collapse_results', class: 'btn btn-xs ed-collapse-btn', title: 'Collapse/Expand results', 'aria-label': 'Collapse or expand results column' }, ['◀'])
    ]);
    const header = el('div', { class: 'ed-col-header' }, [
      el('span', { class: 'fw-600', text: 'Results' }),
      headerRight
    ]);
    const quickRun = (function(){
      const details = el('details', { id: 'ed_quickrun_box', class: 'ed-section', open: true });
      details.appendChild(el('summary', { text: 'Quick run' }));
      details.appendChild(el('div', { id: 'ed_quickrun', class: 'log ed-scroll' }));
      return details;
    })();
    const suiteResults = (function(){
      const details = el('details', { id: 'ed_suiteresults_box', class: 'ed-section', open: true });
      details.appendChild(el('summary', { text: 'Suite results' }));
      details.appendChild(el('div', { id: 'ed_suiteresults', class: 'ed-scroll' }));
      return details;
    })();
    const validation = (function(){
      const details = el('details', { id: 'ed_validation_box', class: 'ed-section', open: true });
      const sum = el('summary', { class: 'ed-row-8 ed-ai-center ed-justify-between' });
      sum.appendChild(el('span', { text: 'Validation' }));
      sum.appendChild(el('button', { id: 'ed_copy_issues', class: 'btn btn-xs', title: 'Copy issues', text: 'Copy' }));
      details.appendChild(sum);
      details.appendChild(el('div', { id: 'ed_issues', class: 'ed-scroll' }));
      return details;
    })();
    const preview = el('div', { id: 'ed_preview', class: 'ed-preview' }, [ quickRun, suiteResults, validation ]);
    const content = el('div', { class: 'ed-col-content' }, [ preview ]);
    return el('div', { id: 'col-results', class: 'ed-col' }, [ header, content ]);
  }

  function open(opts){
    const modal = ensureModal();
    clearChildren(modal);

    const root = el('div', { class: 'editor-root' });
    root.appendChild(buildHeader(opts));
    const main = el('div', { class: 'ed-main' }, [
      buildColumnTests(),
      buildColumnVisual(),
      buildColumnYaml(),
      buildColumnResults()
    ]);
    root.appendChild(main);
    modal.appendChild(root);

    const closeBtn = modal.querySelector('#ed_close');
    if (closeBtn) closeBtn.onclick = () => close();
    return modal;
  }

  function setTitle(text){
    const elTitle = document.querySelector('#editorModal #ed_title');
    if (elTitle) elTitle.textContent = text || '';
  }

  function close(){
    const modal = document.getElementById('editorModal');
    if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
  }

  window.hydreqEditorModal = window.hydreqEditorModal || { open, setTitle, close };
})();
