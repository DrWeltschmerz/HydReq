package report

import (
	"encoding/json"
	"html/template"
	"io"
	"os"
	"time"
)

// Common template helpers reused by both HTML report generators.
var (
	tmplToJSON = func(v any) template.JS {
		b, err := json.Marshal(v)
		if err != nil {
			return template.JS("null")
		}
		return template.JS(string(b))
	}
	tmplDurationSeconds = func(ms int64) float64 { return float64(ms) / 1000.0 }
	tmplNowRFC3339      = func() string { return time.Now().Format(time.RFC3339) }
)

func funcMapCommon() template.FuncMap {
	return template.FuncMap{
		"durationSeconds": tmplDurationSeconds,
		"nowRFC3339":      tmplNowRFC3339,
		"toJSON":          tmplToJSON,
		"pct": func(part int, total int) float64 {
			if total <= 0 {
				return 0.0
			}
			return (float64(part) / float64(total)) * 100.0
		},
	}
}

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
    /* Theme tokens aligned with Web UI */
    :root {
      --hdr-bg:#0b1020; --hdr-fg:#c6e2ff; --bd:#e5e7eb; --li-hov:#f5f7fb; --li-sel:#e6f2ff; --pill:#eef2ff; --pg-bg:#eee; --txt:#111827; --bg:#ffffff;
      --btn-bg:#ffffff; --btn-bd:#d1d5db; --btn-hov:#f6f9ff; --link:#2563eb;
      --input-bg:#ffffff; --input-bd:#d1d5db; --input-fg:#111827; --input-focus:#7aa2ff;
      --success:#10b981; --error:#ef4444; --warning:#f59e0b; --info:#3b82f6;
      --grad1:#00d4ff; --grad2:#5bff5b;
    }
    body.dark {
      --hdr-bg:#0b0e17; --hdr-fg:#d6e0ff; --bd:#222; --li-hov:#1a2230; --li-sel:#10213a; --pill:#1f2937; --pg-bg:#1f2937; --txt:#e5e7eb; --bg:#0b0e17;
      --btn-bg:#111827; --btn-bd:#374151; --btn-hov:#1f2937; --link:#60a5fa;
      --input-bg:#0f172a; --input-bd:#374151; --input-fg:#e5e7eb; --input-focus:#7aa2ff;
      --success:#10b981; --error:#ef4444; --warning:#f59e0b; --info:#60a5fa;
      --grad1:#22d3ee; --grad2:#4ade80;
    }
    .mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
    .msgs{ white-space: pre-wrap; }
    .stats-grid{ display:grid; grid-template-columns: 1fr 320px; gap:12px; align-items:start; }
    .big-chart{ display:flex; align-items:center; justify-content:center; height:260px; }
    .big-chart canvas{ max-height:260px !important; max-width:260px !important; }
    .stats-bar{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    .stat{ padding:8px 10px; border:1px solid var(--bd); border-radius:8px; background: color-mix(in srgb, var(--bg) 92%, var(--txt) 8%); min-width:120px; }
    .stat .k{ font-size:11px; opacity:.7 }
    .stat .v{ font-size:18px; font-weight:600 }
    .page{ padding:12px 12px 24px; max-width:1200px; margin:0 auto; }
    thead.sticky th{ position: sticky; top: 56px; background: var(--bg); z-index: 1; }
    /* Custom themes for reports matching Web UI */
    body.hack {
      --hdr-bg:#061108; --hdr-fg:#a6ffb0; --bd:#15331b; --li-hov:#0b1f10; --li-sel:#0f2a16; --pill:#092010; --pg-bg:#0f2a16; --txt:#c8ffd2; --bg:#050d07;
      --btn-bg:#0a1a0f; --btn-bd:#1a3b24; --btn-hov:#0e2315; --link:#8affb5;
      --input-bg:#0b1f10; --input-bd:#1a3b24; --input-fg:#c8ffd2; --input-focus:#30ff7f;
      --success:#30ff7f; --error:#ff5f5f; --warning:#ffd166; --info:#7dd3fc;
      --grad1:#19ff93; --grad2:#5bff5b;
    }
    body.catppuccin-mocha {
      --hdr-bg:#11111b; --hdr-fg:#cdd6f4; --bd:#313244; --li-hov:#1e1e2e; --li-sel:#181825; --pill:#181825; --pg-bg:#181825; --txt:#cdd6f4; --bg:#0b0b13;
      --btn-bg:#11111b; --btn-bd:#313244; --btn-hov:#1e1e2e; --link:#89b4fa;
      --input-bg:#1e1e2e; --input-bd:#313244; --input-fg:#cdd6f4; --input-focus:#89b4fa;
      --success:#a6e3a1; --error:#f38ba8; --warning:#f9e2af; --info:#89b4fa;
      --grad1:#89b4fa; --grad2:#a6e3a1;
    }
    body.catppuccin-latte {
      --hdr-bg:#eff1f5; --hdr-fg:#4c4f69; --bd:#bcc0cc; --li-hov:#e6e9ef; --li-sel:#dce0e8; --pill:#e6e9ef; --pg-bg:#e6e9ef; --txt:#4c4f69; --bg:#fafafa;
      --btn-bg:#ffffff; --btn-bd:#ccd0da; --btn-hov:#e6e9ef; --link:#1e66f5;
      --input-bg:#ffffff; --input-bd:#ccd0da; --input-fg:#4c4f69; --input-focus:#1e66f5;
      --success:#40a02b; --error:#d20f39; --warning:#df8e1d; --info:#1e66f5;
      --grad1:#1e66f5; --grad2:#40a02b;
    }
    /* Synthwave (dark, DaisyUI-inspired) */
    body.synthwave {
      --hdr-bg:#2d1b69; --hdr-fg:#f5f1ff; --bd:#3d2a7a; --li-hov:#332366; --li-sel:#3c2b78; --pill:#2f205f; --pg-bg:#2f205f; --txt:#f8f8ff; --bg:#231638;
      --btn-bg:#2a1f57; --btn-bd:#4a3a8f; --btn-hov:#33276b; --link:#58c7f3;
      --input-bg:#1f163f; --input-bd:#4a3a8f; --input-fg:#f5f1ff; --input-focus:#58c7f3;
      --success:#36d399; --error:#f87272; --warning:#fbbd23; --info:#58c7f3;
      --grad1:#f472b6; --grad2:#60a5fa;
    }
    /* Synthwave (dark, DaisyUI-inspired) */
    body.synthwave {
      --hdr-bg:#2d1b69; --hdr-fg:#f5f1ff; --bd:#3d2a7a; --li-hov:#332366; --li-sel:#3c2b78; --pill:#2f205f; --pg-bg:#2f205f; --txt:#f8f8ff; --bg:#231638;
      --btn-bg:#2a1f57; --btn-bd:#4a3a8f; --btn-hov:#33276b; --link:#58c7f3;
      --input-bg:#1f163f; --input-bd:#4a3a8f; --input-fg:#f5f1ff; --input-focus:#58c7f3;
      --success:#36d399; --error:#f87272; --warning:#fbbd23; --info:#58c7f3;
      --grad1:#f472b6; --grad2:#60a5fa;
    }
    body { background: var(--bg); color: var(--txt); }
    .navbar { background: var(--hdr-bg) !important; color: var(--hdr-fg) !important; }
  /* Logo styling */
  .hydreq-logo { height: 32px; width: 32px; display:inline-block; vertical-align:middle; margin-right:8px; }
  .hydreq-logo img { height:100%; width:100%; display:block; filter: none; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <script>
    function getTheme(){ try{ return localStorage.getItem('hydreq.theme')||'dark'; }catch{return 'dark'} }
  function themeToDaisy(name){ switch(name){ case 'dark': return 'dark'; case 'synthwave': return 'synthwave'; case 'hack': return 'forest'; case 'catppuccin-mocha': return 'dracula'; case 'catppuccin-latte': return 'cupcake'; default: return 'light'; } }
  function applyTheme(name){ const root=document.documentElement; root.setAttribute('data-theme', themeToDaisy(name)); document.body.classList.toggle('dark', name==='dark'||name==='synthwave'); document.body.classList.toggle('synthwave', name==='synthwave'); document.body.classList.toggle('hack', name==='hack'); document.body.classList.toggle('catppuccin-mocha', name==='catppuccin-mocha'); document.body.classList.toggle('catppuccin-latte', name==='catppuccin-latte'); try{ localStorage.setItem('hydreq.theme', name);}catch{} }
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
    // Resolve a color from CSS custom property or DaisyUI HSL var
    function resolveColor(primaryVar, fallbackHex, daisyVar){
      try{
        const css = getComputedStyle(document.body);
        let v = css.getPropertyValue(primaryVar).trim();
        if (v) {
          if (v.startsWith('#') || v.startsWith('rgb') || v.startsWith('hsl')) return v;
          const tmp = document.createElement('span'); tmp.style.display='none'; tmp.style.color = 'hsl(' + v + ')'; document.body.appendChild(tmp);
          const col = getComputedStyle(tmp).color; tmp.remove(); if (col) return col;
        }
        if (daisyVar){
          const tmp = document.createElement('span'); tmp.style.display='none'; tmp.style.color = 'hsl(var(' + daisyVar + '))'; document.body.appendChild(tmp);
          const col = getComputedStyle(tmp).color; tmp.remove(); if (col) return col;
        }
      }catch{}
      return fallbackHex;
    }
  </script>
  </head>
<body class="min-h-screen">
  <div class="navbar bg-base-200 sticky top-0 z-10">
    <div class="flex-1 px-2 text-lg font-semibold">
      <span class="hydreq-logo" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 341.085" width="32" height="32" role="img" focusable="false">
          <defs>
            <linearGradient id="logoGradientRpt" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#CFB3ED"/>
              <stop offset="35%" stop-color="#B078EC"/>
              <stop offset="70%" stop-color="#8340D3"/>
              <stop offset="100%" stop-color="#4F366A"/>
            </linearGradient>
          </defs>
          <g>
            <path d="M166.065 20.225 C 58.540 36.951,4.232 159.890,64.202 250.816 C 129.267 349.466,276.469 339.030,325.502 232.291 C 375.344 123.791,283.720 1.923,166.065 20.225 M211.625 40.935 C 312.535 58.781,353.514 183.416,282.974 257.937 C 202.994 342.431,61.234 286.726,60.569 170.543 C 60.093 87.497,130.981 26.674,211.625 40.935 M162.274 56.274 C 125.732 63.912,96.614 92.099,85.235 130.852 C 54.702 234.838,207.529 318.722,282.252 238.992 C 317.605 201.270,316.986 138.952,281.120 125.120 C 266.514 119.488,259.934 118.281,254.393 120.220 C 251.764 121.140,241.473 124.264,231.525 127.161 C 210.946 133.155,210.455 133.463,210.455 140.393 C 210.455 149.272,213.485 155.331,217.420 154.322 C 225.611 152.222,235.816 153.352,242.817 157.135 C 254.880 163.653,254.204 165.655,239.742 166.236 C 228.040 166.706,227.854 166.912,233.850 172.769 C 241.203 179.952,247.645 182.304,261.240 182.770 L 272.868 183.169 272.868 188.577 C 272.868 249.844,176.894 269.657,150.424 213.854 C 140.503 192.939,143.895 187.640,166.974 187.995 C 183.011 188.242,184.301 187.940,189.922 182.619 C 195.473 177.365,194.154 176.050,180.518 173.243 C 167.230 170.508,169.662 167.759,188.456 164.274 C 202.373 161.694,202.817 161.285,199.335 154.265 C 196.564 148.677,194.301 147.316,184.247 145.185 C 151.262 138.196,124.693 153.995,118.402 184.341 C 116.215 194.888,115.797 194.889,112.136 184.343 C 103.049 158.176,109.502 130.251,129.180 110.579 C 141.353 98.410,159.173 89.712,159.173 95.938 C 159.173 106.853,164.417 114.771,173.495 117.562 C 183.806 120.732,226.410 119.430,226.343 115.947 C 226.336 115.561,222.724 113.731,218.317 111.880 C 192.037 100.841,190.805 96.422,213.953 96.233 C 229.199 96.108,232.516 97.048,237.258 102.835 C 242.921 109.745,248.788 103.957,249.877 90.387 C 250.604 81.331,248.165 78.916,233.821 74.489 C 224.944 71.750,222.290 70.386,216.329 65.496 C 203.514 54.985,184.206 51.691,162.274 56.274 M192.299 69.794 C 196.266 71.845,196.424 75.734,192.641 78.212 C 189.292 80.407,183.563 77.911,180.910 73.101 C 178.293 68.355,185.481 66.268,192.299 69.794 M270.847 138.760 C 275.585 141.465,275.893 142.356,272.394 143.234 C 270.996 143.585,269.311 144.524,268.650 145.321 C 264.948 149.781,254.825 142.412,257.875 137.477 C 259.036 135.600,266.628 136.351,270.847 138.760 M121.272 251.762 C 118.966 257.772,148.562 277.790,168.067 283.414 C 183.080 287.742,218.272 286.372,219.904 281.395 C 220.210 280.460,218.643 280.103,214.219 280.103 C 183.142 280.103,151.910 270.832,128.388 254.624 C 123.095 250.977,121.777 250.447,121.272 251.762" fill="url(#logoGradientRpt)" stroke="none" fill-rule="evenodd"></path>
          </g>
        </svg>
      </span>
      HydReq Report — <span class="opacity-70">{{.Suite}}</span>
    </div>
    <div class="flex-none gap-2 pr-2">
      <button class="btn btn-sm" onclick="toggleFailed(this)" data-on="0">Only failed</button>
      <select id="themeSel" class="select select-sm">
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="synthwave">Synthwave</option>
        <option value="hack">Hack</option>
        <option value="catppuccin-mocha">Catppuccin Mocha</option>
        <option value="catppuccin-latte">Catppuccin Latte</option>
      </select>
    </div>
  </div>
  <div class="page">
    <div class="stats-grid">
      <div>
        <div class="stats-bar">
          <div class="stat"><div class="k">Total</div><div class="v">{{.Summary.Total}}</div></div>
          <div class="stat"><div class="k">Passed</div><div class="v" style="color: var(--success)">{{.Summary.Passed}}</div></div>
          <div class="stat"><div class="k">Failed</div><div class="v" style="color: var(--error)">{{.Summary.Failed}}</div></div>
          <div class="stat"><div class="k">Skipped</div><div class="v" style="color: var(--warning)">{{.Summary.Skipped}}</div></div>
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
        <div class="big-chart">
          <canvas id="pfChart"></canvas>
          <!-- Fallback CSS donut shown when JS or Chart.js is unavailable -->
          <div id="pfFallback" style="position:absolute; width:200px; height:200px; display:flex; align-items:center; justify-content:center;">
            <svg viewBox="0 0 36 36" width="160" height="160" aria-hidden="true">
              <path d="M18 2a16 16 0 1 0 0 32 16 16 0 1 0 0-32Z" fill="#111" opacity="0.06"></path>
              <path d="M18 2a16 16 0 1 0 0 32 16 16 0 1 0 0-32Z" stroke="#ddd" stroke-width="2" fill="none"></path>
              <path id="pfArc" d="" fill="none" stroke="#16a34a" stroke-width="4" stroke-linecap="round"></path>
              <text x="18" y="20" text-anchor="middle" font-size="5" fill="currentColor">--</text>
            </svg>
          </div>
        </div>
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
      (function(){ const saved=getTheme(); const sel=document.getElementById('themeSel'); if(sel){ sel.value=saved; sel.addEventListener('change', ()=>applyTheme(sel.value)); } applyTheme(saved); })();
      const REP = {{ toJSON . }};
      const ctx = document.getElementById('pfChart');
      const pfFallback = document.getElementById('pfFallback');
      if (ctx && window.Chart){
        if (pfFallback) pfFallback.style.display='none';
        const pass = resolveColor('--success', '#16a34a', '--su');
        const fail = resolveColor('--error',   '#dc2626', '--er');
        const skip = resolveColor('--warning', '#ca8a04', '--wa');
        new Chart(ctx, { type:'doughnut', data:{ labels:['Passed','Failed','Skipped'], datasets:[{ data:[REP.summary.passed, REP.summary.failed, REP.summary.skipped], backgroundColor:[pass,fail,skip] }]}, options:{ responsive:true, maintainAspectRatio:false, cutout:'60%', plugins:{ legend:{ position:'bottom' }}}});
      } else {
        // draw a simple fallback arc based on percentages
        if (pfFallback && typeof REP !== 'undefined'){
          const total = REP.summary.passed + REP.summary.failed + REP.summary.skipped || 1;
          const pct = Math.round((REP.summary.passed/total)*100);
          const arc = document.getElementById('pfArc');
          if (arc){
            // simple circular arc path for percentage (approximation)
            const angle = (pct/100)*360;
            const large = angle > 180 ? 1 : 0;
            const r = 16; const cx = 18; const cy = 18;
            const startX = cx + r;
            const endX = cx + r * Math.cos((Math.PI/180)*angle);
            const endY = cy + r * Math.sin((Math.PI/180)*angle);
            arc.setAttribute('d', 'M ' + startX + ' ' + cy + ' A ' + r + ' ' + r + ' 0 ' + large + ' 0 ' + endX + ' ' + endY);
            arc.setAttribute('stroke', '#16a34a');
          }
          pfFallback.style.display='flex';
        }
      }
    </script>
  </div>
</body>
</html>`

	t := template.Must(template.New("report").Funcs(funcMapCommon()).Parse(tpl))

	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	return t.Execute(f, rep)
}

// WriteHTMLDetailedTo renders the detailed HTML report into the provided writer.
func WriteHTMLDetailedTo(w io.Writer, rep DetailedReport) error {
	const tpl = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{.Suite}} — HydReq Report</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/daisyui@4.12.10/dist/full.min.css">
  <style> /* inline CSS trimmed for brevity; reuse same styles as file writer */ </style>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  </head>
<body class="min-h-screen">
  <div class="navbar bg-base-200 sticky top-0 z-10">
    <div class="flex-1 px-2 text-lg font-semibold">HydReq Report — <span class="opacity-70">{{.Suite}}</span></div>
  </div>
  <div class="page">
    <div class="stats-grid">
      <div>
        <div class="stats-bar">
          <div class="stat"><div class="k">Total</div><div class="v">{{.Summary.Total}}</div></div>
          <div class="stat"><div class="k">Passed</div><div class="v" style="color: var(--success)">{{.Summary.Passed}}</div></div>
          <div class="stat"><div class="k">Failed</div><div class="v" style="color: var(--error)">{{.Summary.Failed}}</div></div>
          <div class="stat"><div class="k">Skipped</div><div class="v" style="color: var(--warning)">{{.Summary.Skipped}}</div></div>
          <div class="stat"><div class="k">Duration</div><div class="v">{{printf "%.3fs" .Summary.Duration.Seconds}}</div></div>
        </div>
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
                </details>
              {{end}}
            </td>
          </tr>
          {{end}}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`
	t := template.Must(template.New("report_inline").Funcs(funcMapCommon()).Parse(tpl))
	return t.Execute(w, rep)
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
    /* Theme tokens aligned with Web UI */
    :root {
      --hdr-bg:#0b1020; --hdr-fg:#c6e2ff; --bd:#e5e7eb; --li-hov:#f5f7fb; --li-sel:#e6f2ff; --pill:#eef2ff; --pg-bg:#eee; --txt:#111827; --bg:#ffffff;
      --btn-bg:#ffffff; --btn-bd:#d1d5db; --btn-hov:#f6f9ff; --link:#2563eb;
      --input-bg:#ffffff; --input-bd:#d1d5db; --input-fg:#111827; --input-focus:#7aa2ff;
      --success:#10b981; --error:#ef4444; --warning:#f59e0b; --info:#3b82f6;
      --grad1:#00d4ff; --grad2:#5bff5b;
    }
    body.dark {
      --hdr-bg:#0b0e17; --hdr-fg:#d6e0ff; --bd:#222; --li-hov:#1a2230; --li-sel:#10213a; --pill:#1f2937; --pg-bg:#1f2937; --txt:#e5e7eb; --bg:#0b0e17;
      --btn-bg:#111827; --btn-bd:#374151; --btn-hov:#1f2937; --link:#60a5fa;
      --input-bg:#0f172a; --input-bd:#374151; --input-fg:#e5e7eb; --input-focus:#7aa2ff;
      --success:#10b981; --error:#ef4444; --warning:#f59e0b; --info:#60a5fa;
      --grad1:#22d3ee; --grad2:#4ade80;
    }
    .mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
    .stats-grid{ display:grid; grid-template-columns: 1fr 320px; gap:12px; align-items:start; }
    .big-chart{ display:flex; align-items:center; justify-content:center; height:260px; }
    .big-chart canvas{ max-height:260px !important; max-width:260px !important; }
    .controls{ display:grid; grid-template-columns: 1fr auto auto; gap:8px; }
    .stats-bar{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    .stat{ padding:8px 10px; border:1px solid var(--bd); border-radius:8px; background: color-mix(in srgb, var(--bg) 92%, var(--txt) 8%); min-width:120px; }
    .stat .k{ font-size:11px; opacity:.7 }
    .stat .v{ font-size:18px; font-weight:600 }
    .page{ padding:12px 12px 24px; max-width:1200px; margin:0 auto; }
    thead.sticky th{ position: sticky; top: 56px; background: var(--bg); z-index: 1; }
    .section-title{ display:flex; align-items:center; justify-content:space-between; gap:8px; }
    /* Custom themes for reports matching Web UI */
    body.hack {
      --hdr-bg:#061108; --hdr-fg:#a6ffb0; --bd:#15331b; --li-hov:#0b1f10; --li-sel:#0f2a16; --pill:#092010; --pg-bg:#0f2a16; --txt:#c8ffd2; --bg:#050d07;
      --btn-bg:#0a1a0f; --btn-bd:#1a3b24; --btn-hov:#0e2315; --link:#8affb5;
      --input-bg:#0b1f10; --input-bd:#1a3b24; --input-fg:#c8ffd2; --input-focus:#30ff7f;
      --success:#30ff7f; --error:#ff5f5f; --warning:#ffd166; --info:#7dd3fc;
      --grad1:#19ff93; --grad2:#5bff5b;
    }
    body.catppuccin-mocha {
      --hdr-bg:#11111b; --hdr-fg:#cdd6f4; --bd:#313244; --li-hov:#1e1e2e; --li-sel:#181825; --pill:#181825; --pg-bg:#181825; --txt:#cdd6f4; --bg:#0b0b13;
      --btn-bg:#11111b; --btn-bd:#313244; --btn-hov:#1e1e2e; --link:#89b4fa;
      --input-bg:#1e1e2e; --input-bd:#313244; --input-fg:#cdd6f4; --input-focus:#89b4fa;
      --success:#a6e3a1; --error:#f38ba8; --warning:#f9e2af; --info:#89b4fa;
      --grad1:#89b4fa; --grad2:#a6e3a1;
    }
    body.catppuccin-latte {
      --hdr-bg:#eff1f5; --hdr-fg:#4c4f69; --bd:#bcc0cc; --li-hov:#e6e9ef; --li-sel:#dce0e8; --pill:#e6e9ef; --pg-bg:#e6e9ef; --txt:#4c4f69; --bg:#fafafa;
      --btn-bg:#ffffff; --btn-bd:#ccd0da; --btn-hov:#e6e9ef; --link:#1e66f5;
      --input-bg:#ffffff; --input-bd:#ccd0da; --input-fg:#4c4f69; --input-focus:#1e66f5;
      --success:#40a02b; --error:#d20f39; --warning:#df8e1d; --info:#1e66f5;
      --grad1:#1e66f5; --grad2:#40a02b;
    }
    body { background: var(--bg); color: var(--txt); }
    .navbar { background: var(--hdr-bg) !important; color: var(--hdr-fg) !important; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <script>
    function getTheme(){ try{ return localStorage.getItem('hydreq.theme')||'dark'; }catch{return 'dark'} }
    function themeToDaisy(name){ switch(name){ case 'dark': return 'dark'; case 'synthwave': return 'synthwave'; case 'hack': return 'forest'; case 'catppuccin-mocha': return 'dracula'; case 'catppuccin-latte': return 'cupcake'; default: return 'light'; } }
    function applyTheme(name){
      const root=document.documentElement;
      root.setAttribute('data-theme', themeToDaisy(name));
      document.body.classList.toggle('dark', name==='dark'||name==='synthwave');
      document.body.classList.toggle('synthwave', name==='synthwave');
      document.body.classList.toggle('hack', name==='hack');
      document.body.classList.toggle('catppuccin-mocha', name==='catppuccin-mocha');
      document.body.classList.toggle('catppuccin-latte', name==='catppuccin-latte');
      try{ localStorage.setItem('hydreq.theme', name);}catch{}
    }
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
    // Resolve a color from CSS custom property or DaisyUI HSL var
    function resolveColor(primaryVar, fallbackHex, daisyVar){
      try{
        const css = getComputedStyle(document.body);
        let v = css.getPropertyValue(primaryVar).trim();
        if (v) {
          if (v.startsWith('#') || v.startsWith('rgb') || v.startsWith('hsl')) return v;
          const tmp = document.createElement('span'); tmp.style.display='none'; tmp.style.color = 'hsl(' + v + ')'; document.body.appendChild(tmp);
          const col = getComputedStyle(tmp).color; tmp.remove(); if (col) return col;
        }
        if (daisyVar){
          const tmp = document.createElement('span'); tmp.style.display='none'; tmp.style.color = 'hsl(var(' + daisyVar + '))'; document.body.appendChild(tmp);
          const col = getComputedStyle(tmp).color; tmp.remove(); if (col) return col;
        }
      }catch{}
      return fallbackHex;
    }
  </script>
  </head>
<body class="min-h-screen">
  <div class="navbar bg-base-200 sticky top-0 z-10">
    <div class="flex-1 px-2 text-lg font-semibold">
      <span class="hydreq-logo" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 341.085" width="32" height="32" role="img" focusable="false">
          <defs>
            <linearGradient id="logoGradientRpt" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#CFB3ED"/>
              <stop offset="35%" stop-color="#B078EC"/>
              <stop offset="70%" stop-color="#8340D3"/>
              <stop offset="100%" stop-color="#4F366A"/>
            </linearGradient>
          </defs>
          <g>
            <path d="M166.065 20.225 C 58.540 36.951,4.232 159.890,64.202 250.816 C 129.267 349.466,276.469 339.030,325.502 232.291 C 375.344 123.791,283.720 1.923,166.065 20.225 M211.625 40.935 C 312.535 58.781,353.514 183.416,282.974 257.937 C 202.994 342.431,61.234 286.726,60.569 170.543 C 60.093 87.497,130.981 26.674,211.625 40.935 M162.274 56.274 C 125.732 63.912,96.614 92.099,85.235 130.852 C 54.702 234.838,207.529 318.722,282.252 238.992 C 317.605 201.270,316.986 138.952,281.120 125.120 C 266.514 119.488,259.934 118.281,254.393 120.220 C 251.764 121.140,241.473 124.264,231.525 127.161 C 210.946 133.155,210.455 133.463,210.455 140.393 C 210.455 149.272,213.485 155.331,217.420 154.322 C 225.611 152.222,235.816 153.352,242.817 157.135 C 254.880 163.653,254.204 165.655,239.742 166.236 C 228.040 166.706,227.854 166.912,233.850 172.769 C 241.203 179.952,247.645 182.304,261.240 182.770 L 272.868 183.169 272.868 188.577 C 272.868 249.844,176.894 269.657,150.424 213.854 C 140.503 192.939,143.895 187.640,166.974 187.995 C 183.011 188.242,184.301 187.940,189.922 182.619 C 195.473 177.365,194.154 176.050,180.518 173.243 C 167.230 170.508,169.662 167.759,188.456 164.274 C 202.373 161.694,202.817 161.285,199.335 154.265 C 196.564 148.677,194.301 147.316,184.247 145.185 C 151.262 138.196,124.693 153.995,118.402 184.341 C 116.215 194.888,115.797 194.889,112.136 184.343 C 103.049 158.176,109.502 130.251,129.180 110.579 C 141.353 98.410,159.173 89.712,159.173 95.938 C 159.173 106.853,164.417 114.771,173.495 117.562 C 183.806 120.732,226.410 119.430,226.343 115.947 C 226.336 115.561,222.724 113.731,218.317 111.880 C 192.037 100.841,190.805 96.422,213.953 96.233 C 229.199 96.108,232.516 97.048,237.258 102.835 C 242.921 109.745,248.788 103.957,249.877 90.387 C 250.604 81.331,248.165 78.916,233.821 74.489 C 224.944 71.750,222.290 70.386,216.329 65.496 C 203.514 54.985,184.206 51.691,162.274 56.274 M192.299 69.794 C 196.266 71.845,196.424 75.734,192.641 78.212 C 189.292 80.407,183.563 77.911,180.910 73.101 C 178.293 68.355,185.481 66.268,192.299 69.794 M270.847 138.760 C 275.585 141.465,275.893 142.356,272.394 143.234 C 270.996 143.585,269.311 144.524,268.650 145.321 C 264.948 149.781,254.825 142.412,257.875 137.477 C 259.036 135.600,266.628 136.351,270.847 138.760 M121.272 251.762 C 118.966 257.772,148.562 277.790,168.067 283.414 C 183.080 287.742,218.272 286.372,219.904 281.395 C 220.210 280.460,218.643 280.103,214.219 280.103 C 183.142 280.103,151.910 270.832,128.388 254.624 C 123.095 250.977,121.777 250.447,121.272 251.762" fill="url(#logoGradientRpt)" stroke="none" fill-rule="evenodd"></path>
          </g>
        </svg>
      </span>
      HydReq Batch Report — <span class="opacity-70">{{.RunAt}}</span>
    </div>
    <div class="flex-none gap-2 pr-2">
      <select id="themeSel" class="select select-sm">
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="synthwave">Synthwave</option>
        <option value="hack">Hack</option>
        <option value="catppuccin-mocha">Catppuccin Mocha</option>
        <option value="catppuccin-latte">Catppuccin Latte</option>
      </select>
    </div>
  </div>
  <div class="page">
    <div class="stats-grid">
      <div>
        <div class="stats-bar">
          <div class="stat"><div class="k">Total</div><div class="v">{{.Summary.Total}}</div></div>
          <div class="stat"><div class="k">Passed</div><div class="v" style="color: var(--success)">{{.Summary.Passed}}</div></div>
          <div class="stat"><div class="k">Failed</div><div class="v" style="color: var(--error)">{{.Summary.Failed}}</div></div>
          <div class="stat"><div class="k">Skipped</div><div class="v" style="color: var(--warning)">{{.Summary.Skipped}}</div></div>
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
    {{if .NotRun}}
    <div class="alert alert-warning my-2">
      <span class="font-semibold">Some suites were not run</span>
    </div>
    <div class="overflow-x-auto mb-4">
      <table class="table table-sm">
        <thead><tr><th>Path</th><th>Reason</th></tr></thead>
        <tbody>
          {{range .NotRun}}
            <tr>
              <td class="mono">{{.Path}}</td>
              <td class="text-xs opacity-80">{{if .ValidationError}}{{.ValidationError}}{{else}}{{.Error}}{{end}}</td>
            </tr>
          {{end}}
        </tbody>
      </table>
    </div>
    {{end}}
    <div class="mt-2 overflow-x-auto">
      <table class="table table-zebra">
  <thead class="sticky"><tr><th>Suite</th><th class="text-right">Total</th><th class="text-right" style="color: var(--success)">Passed</th><th class="text-right" style="color: var(--error)">Failed</th><th class="text-right" style="color: var(--warning)">Skipped</th><th class="text-right">Duration</th></tr></thead>
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
                              {{if eq .Status "passed"}}<span class="badge" style="background: color-mix(in srgb, var(--success) 15%, transparent); color: var(--success)">passed</span>{{end}}
                              {{if eq .Status "failed"}}<span class="badge" style="background: color-mix(in srgb, var(--error) 15%, transparent); color: var(--error)">failed</span>{{end}}
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
      (function(){ const saved=getTheme(); const sel=document.getElementById('themeSel'); if(sel){ sel.value=saved; sel.addEventListener('change', ()=>applyTheme(sel.value)); } applyTheme(saved); })();
      const BATCH = {{ toJSON . }};
      const ctx = document.getElementById('pfChart');
      if (ctx && window.Chart){
        const pass = resolveColor('--success', '#16a34a', '--su');
        const fail = resolveColor('--error',   '#dc2626', '--er');
        const skip = resolveColor('--warning', '#ca8a04', '--wa');
        new Chart(ctx, { type:'doughnut', data:{ labels:['Passed','Failed','Skipped'], datasets:[{ data:[BATCH.summary.passed, BATCH.summary.failed, BATCH.summary.skipped], backgroundColor:[pass,fail,skip] }]}, options:{ responsive:true, maintainAspectRatio:false, cutout:'60%', plugins:{ legend:{ position:'bottom' }}}});
      }
    </script>
  </div>
</body>
</html>`
	t := template.Must(template.New("batch").Funcs(funcMapCommon()).Parse(tpl))
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	return t.Execute(f, br)
}

// WriteHTMLBatchTo renders the batch/run-level HTML report into the provided writer.
func WriteHTMLBatchTo(w io.Writer, br BatchReport) error {
	// Use the canonical WriteHTMLBatch implementation (which writes to a file)
	// by writing to a temporary file and streaming it to the provided writer.
	tmp, err := os.CreateTemp("", "hydreq-batch-*.html")
	if err != nil {
		return err
	}
	tmpPath := tmp.Name()
	tmp.Close()
	defer os.Remove(tmpPath)

	if err := WriteHTMLBatch(tmpPath, br); err != nil {
		return err
	}
	f, err := os.Open(tmpPath)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = io.Copy(w, f)
	return err
}
