package report

import (
	"encoding/json"
	"html/template"
	"os"
	"time"
)

// WriteHTMLDetailed renders a standalone HTML report with inline CSS
// showing the suite summary and per-test results.
func WriteHTMLDetailed(path string, rep DetailedReport) error {
	const tpl = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{.Suite}} — HydReq Report</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/daisyui@4.12.10/dist/full.min.css">
  <style>
    .mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
    .msgs{ white-space: pre-wrap; }
    .stats-grid{ display:grid; grid-template-columns: 1fr 320px; gap:12px; align-items:start; }
    .big-chart{ display:flex; align-items:center; justify-content:center; height:260px; }
    .big-chart canvas{ max-height:260px !important; max-width:260px !important; }
    .stats-bar{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    .stat{ padding:8px 10px; border:1px solid var(--fallback-bc, #2a2a2a); border-radius:8px; background: var(--fallback-b1, #1a1a1a); min-width:120px; }
    .stat .k{ font-size:11px; opacity:.7 }
    .stat .v{ font-size:18px; font-weight:600 }
    .page{ padding:12px 12px 24px; max-width:1200px; margin:0 auto; }
    thead.sticky th{ position: sticky; top: 56px; background: var(--fallback-b1, #111); z-index: 1; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <script>
    function toggleFailed(el){
      const on = el.dataset.on === '1';
      el.dataset.on = on ? '0' : '1';
      document.querySelectorAll('tbody tr').forEach(tr => {
        const st = tr.getAttribute('data-status');
        tr.style.display = (!on && st !== 'failed') ? 'none' : '';
      });
      el.textContent = el.dataset.on==='1' ? 'Show all' : 'Only failed';
    }
    function toggleTheme(btn){
      const r = document.documentElement;
      const dark = r.getAttribute('data-theme') !== 'dark' ? false : true;
      r.setAttribute('data-theme', dark ? 'light' : 'dark');
      btn.textContent = dark ? 'Dark' : 'Light';
    }
    function applyFilters(){
      const q = (document.getElementById('searchInput').value||'').toLowerCase();
      const st = document.getElementById('statusSel').value;
      document.querySelectorAll('tbody tr').forEach(tr => {
        const name = (tr.querySelector('td')?.textContent||'').toLowerCase();
        const status = tr.getAttribute('data-status');
        const okSt = (st==='all' || st===status);
        const okQ = (!q || name.includes(q));
        tr.style.display = (okSt && okQ) ? '' : 'none';
      });
    }
  </script>
  </head>
<body class="min-h-screen">
  <div class="navbar bg-base-200 sticky top-0 z-10">
    <div class="flex-1 px-2 text-lg font-semibold">HydReq Report — <span class="opacity-70">{{.Suite}}</span></div>
    <div class="flex-none gap-2 pr-2">
      <button class="btn btn-sm" onclick="toggleFailed(this)" data-on="0">Only failed</button>
      <button class="btn btn-sm" onclick="toggleTheme(this)">Light</button>
    </div>
  </div>
  <div class="page">
    <div class="stats-grid">
      <div>
        <div class="stats-bar">
          <div class="stat"><div class="k">Total</div><div class="v">{{.Summary.Total}}</div></div>
          <div class="stat"><div class="k">Passed</div><div class="v text-success">{{.Summary.Passed}}</div></div>
          <div class="stat"><div class="k">Failed</div><div class="v text-error">{{.Summary.Failed}}</div></div>
          <div class="stat"><div class="k">Skipped</div><div class="v text-warning">{{.Summary.Skipped}}</div></div>
          <div class="stat"><div class="k">Duration</div><div class="v">{{printf "%.3fs" .Summary.Duration.Seconds}}</div></div>
        </div>
        <div class="mt-2">
          <div class="grid grid-cols-3 gap-2 items-center">
            <input id="searchInput" class="input input-bordered input-sm col-span-2" placeholder="Search test name" oninput="applyFilters()"/>
            <select id="statusSel" class="select select-bordered select-sm" onchange="applyFilters()">
              <option value="all">All</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
              <option value="skipped">Skipped</option>
            </select>
          </div>
        </div>
      </div>
      <div class="stat" style="padding:6px 8px;">
        <div class="k">Pass/Fail</div>
        <div class="big-chart"><canvas id="pfChart"></canvas></div>
      </div>
    </div>

    <div class="mt-4 overflow-x-auto">
      <table class="table table-zebra">
        <thead class="sticky">
          <tr>
            <th class="w-1/2">Test</th>
            <th>Stage</th>
            <th>Tags</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Messages</th>
          </tr>
        </thead>
        <tbody>
          {{range .TestCases}}
          <tr data-status="{{.Status}}">
            <td class="mono">{{.Name}}</td>
            <td>{{.Stage}}</td>
            <td>{{range .Tags}}<span class="badge badge-ghost mr-1">{{.}}</span>{{end}}</td>
            <td>
              {{if eq .Status "passed"}}<span class="badge badge-success">passed</span>{{end}}
              {{if eq .Status "failed"}}<span class="badge badge-error">failed</span>{{end}}
              {{if eq .Status "skipped"}}<span class="badge">skipped</span>{{end}}
            </td>
            <td>{{printf "%.3fs" (durationSeconds .DurationMs)}}</td>
            <td class="msgs opacity-80">
              {{if .Messages}}
                <details>
                  <summary class="text-xs">messages ({{len .Messages}})</summary>
                  <pre class="mono" style="white-space:pre-wrap">{{range .Messages}}• {{.}}&#10;{{end}}</pre>
                  <button class="btn btn-xs" onclick="navigator.clipboard.writeText(this.previousElementSibling.innerText);return false">Copy</button>
                </details>
              {{end}}
            </td>
          </tr>
          {{end}}
        </tbody>
      </table>
    </div>
    <script>
      const REP = {{ toJSON . }};
      const ctx = document.getElementById('pfChart');
      if (ctx && window.Chart){
        new Chart(ctx, { type:'doughnut', data:{ labels:['Passed','Failed','Skipped'], datasets:[{ data:[REP.summary.passed, REP.summary.failed, REP.summary.skipped], backgroundColor:['#16a34a','#dc2626','#ca8a04'] }]}, options:{ responsive:true, maintainAspectRatio:false, cutout:'60%', plugins:{ legend:{ position:'bottom' }}}});
      }
    </script>
  </div>
</body>
</html>`

	funcMap := template.FuncMap{
		"durationSeconds": func(ms int64) float64 { return float64(ms) / 1000.0 },
		"nowRFC3339":      func() string { return time.Now().Format(time.RFC3339) },
		"toJSON": func(v any) template.JS {
			b, _ := json.Marshal(v)
			return template.JS(string(b))
		},
	}
	t := template.Must(template.New("report").Funcs(funcMap).Parse(tpl))
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	return t.Execute(f, rep)
}

// WriteHTMLBatch renders a batch/run-level HTML report with per-suite rows.
func WriteHTMLBatch(path string, br BatchReport) error {
	const tpl = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>HydReq Batch Report</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/daisyui@4.12.10/dist/full.min.css">
  <style>
    .mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
    .stats-grid{ display:grid; grid-template-columns: 1fr 320px; gap:12px; align-items:start; }
    .big-chart{ display:flex; align-items:center; justify-content:center; height:260px; }
    .big-chart canvas{ max-height:260px !important; max-width:260px !important; }
    .controls{ display:grid; grid-template-columns: 1fr auto auto; gap:8px; }
    .stats-bar{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    .stat{ padding:8px 10px; border:1px solid var(--fallback-bc, #2a2a2a); border-radius:8px; background: var(--fallback-b1, #1a1a1a); min-width:120px; }
    .stat .k{ font-size:11px; opacity:.7 }
    .stat .v{ font-size:18px; font-weight:600 }
    .page{ padding:12px 12px 24px; max-width:1200px; margin:0 auto; }
    thead.sticky th{ position: sticky; top: 56px; background: var(--fallback-b1, #111); z-index: 1; }
    .section-title{ display:flex; align-items:center; justify-content:space-between; gap:8px; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <script>
    function toggleTheme(btn){ const r=document.documentElement; const dark=r.getAttribute('data-theme')==='dark'; r.setAttribute('data-theme', dark?'light':'dark'); btn.textContent=dark?'Dark':'Light'; }
    function suiteFilter(containerId){
      const root = document.getElementById(containerId);
      const q = (root.querySelector('.q')?.value||'').toLowerCase();
      const st = root.querySelector('.st')?.value||'all';
      const failedOnly = root.querySelector('.fo')?.dataset.on==='1';
      root.querySelectorAll('tbody tr').forEach(tr => {
        const name = (tr.querySelector('td')?.textContent||'').toLowerCase();
        const status = tr.getAttribute('data-status');
        const okSt = (st==='all' || st===status);
        const okQ = (!q || name.includes(q));
        const okFo = (!failedOnly || status==='failed');
        tr.style.display = (okSt && okQ && okFo) ? '' : 'none';
      });
    }
    function toggleFailedBtn(btn, containerId){
      const on = btn.dataset.on==='1'; btn.dataset.on = on?'0':'1'; btn.textContent = on?'Only failed':'Show all';
      suiteFilter(containerId);
    }
  </script>
  </head>
<body class="min-h-screen">
  <div class="navbar bg-base-200 sticky top-0 z-10">
    <div class="flex-1 px-2 text-lg font-semibold">HydReq Batch Report</div>
    <div class="flex-none gap-2 pr-2">
      <button class="btn btn-sm" onclick="toggleTheme(this)">Light</button>
    </div>
  </div>
  <div class="page">
    <div class="stats-grid">
      <div>
        <div class="stats-bar">
          <div class="stat"><div class="k">Total</div><div class="v">{{.Summary.Total}}</div></div>
          <div class="stat"><div class="k">Passed</div><div class="v text-success">{{.Summary.Passed}}</div></div>
          <div class="stat"><div class="k">Failed</div><div class="v text-error">{{.Summary.Failed}}</div></div>
          <div class="stat"><div class="k">Skipped</div><div class="v text-warning">{{.Summary.Skipped}}</div></div>
          <div class="stat"><div class="k">Duration</div><div class="v">{{printf "%.3fs" .Summary.Duration.Seconds}}</div></div>
        </div>
      </div>
      <div class="stat" style="padding:6px 8px;">
        <div class="k">Pass/Fail</div>
        <div class="big-chart"><canvas id="pfChart"></canvas></div>
      </div>
    </div>
    <div class="mt-4 section-title">
      <div class="text-sm opacity-70">Suites: {{len .Suites}}</div>
      <div class="flex gap-2">
        <button class="btn btn-xs" onclick="document.querySelectorAll('details').forEach(d=>d.open=true)">Expand all</button>
        <button class="btn btn-xs" onclick="document.querySelectorAll('details').forEach(d=>d.open=false)">Collapse all</button>
      </div>
    </div>
    <div class="mt-2 overflow-x-auto">
      <table class="table table-zebra">
        <thead class="sticky"><tr><th>Suite</th><th class="text-right">Total</th><th class="text-success text-right">Passed</th><th class="text-error text-right">Failed</th><th class="text-right">Skipped</th><th class="text-right">Duration</th></tr></thead>
        <tbody>
          {{range $idx, $s := .Suites}}
            <tr>
              <td class="mono"><a id="suite-{{$idx}}"></a>{{$s.Suite}}</td>
              <td class="text-right">{{$s.Summary.Total}}</td>
              <td class="text-right">{{$s.Summary.Passed}}</td>
              <td class="text-right">{{$s.Summary.Failed}}</td>
              <td class="text-right">{{$s.Summary.Skipped}}</td>
              <td class="text-right">{{printf "%.3fs" $s.Summary.Duration.Seconds}}</td>
            </tr>
            <tr>
              <td colspan="6">
                <details class="collapse collapse-arrow">
                  <summary class="collapse-title text-sm">Details: tests in suite "{{$s.Suite}}"</summary>
                  <div class="collapse-content" id="suite{{$idx}}">
                    <div class="controls mb-2">
                      <input class="input input-bordered input-sm q" placeholder="Search test name" oninput="suiteFilter('suite{{$idx}}')"/>
                      <select class="select select-bordered select-sm st" onchange="suiteFilter('suite{{$idx}}')"><option value="all">All</option><option value="passed">Passed</option><option value="failed">Failed</option><option value="skipped">Skipped</option></select>
                      <button class="btn btn-sm fo" data-on="0" onclick="toggleFailedBtn(this,'suite{{$idx}}')">Only failed</button>
                    </div>
                    <div class="overflow-x-auto">
                      <table class="table table-sm">
                        <thead class="sticky">
                          <tr><th class="w-1/2">Test</th><th>Stage</th><th>Tags</th><th>Status</th><th>Duration</th><th>Messages</th></tr>
                        </thead>
                        <tbody>
                          {{range $s.TestCases}}
                          <tr data-status="{{.Status}}">
                            <td class="mono">{{.Name}}</td>
                            <td>{{.Stage}}</td>
                            <td>{{range .Tags}}<span class="badge badge-ghost mr-1">{{.}}</span>{{end}}</td>
                            <td>
                              {{if eq .Status "passed"}}<span class="badge badge-success">passed</span>{{end}}
                              {{if eq .Status "failed"}}<span class="badge badge-error">failed</span>{{end}}
                              {{if eq .Status "skipped"}}<span class="badge">skipped</span>{{end}}
                            </td>
                            <td>{{printf "%.3fs" (durationSeconds .DurationMs)}}</td>
                            <td class="opacity-80">
                              {{if .Messages}}
                                <details>
                                  <summary class="text-xs">messages ({{len .Messages}})</summary>
                                  <pre class="mono" style="white-space:pre-wrap">{{range .Messages}}• {{.}}&#10;{{end}}</pre>
                                  <button class="btn btn-xs" onclick="navigator.clipboard.writeText(this.previousElementSibling.innerText);return false">Copy</button>
                                </details>
                              {{end}}
                            </td>
                          </tr>
                          {{end}}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </details>
              </td>
            </tr>
          {{end}}
        </tbody>
      </table>
    </div>
    <div class="text-xs opacity-70 mt-4">Generated {{ nowRFC3339 }}</div>
    <script>
      const BATCH = {{ toJSON . }};
      const ctx = document.getElementById('pfChart');
      if (ctx && window.Chart){
        new Chart(ctx, { type:'doughnut', data:{ labels:['Passed','Failed','Skipped'], datasets:[{ data:[BATCH.summary.passed, BATCH.summary.failed, BATCH.summary.skipped], backgroundColor:['#16a34a','#dc2626','#ca8a04'] }]}, options:{ responsive:true, maintainAspectRatio:false, cutout:'60%', plugins:{ legend:{ position:'bottom' }}}});
      }
    </script>
  </div>
</body>
</html>`
	t := template.Must(template.New("batch").Funcs(template.FuncMap{
		"nowRFC3339":      func() string { return time.Now().Format(time.RFC3339) },
		"toJSON":          func(v any) template.JS { b, _ := json.Marshal(v); return template.JS(string(b)) },
		"durationSeconds": func(ms int64) float64 { return float64(ms) / 1000.0 },
	}).Parse(tpl))
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	return t.Execute(f, br)
}
