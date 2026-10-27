// Teacher-only incident view. Render student-supplied log text with textContent.
(function (w) {
    'use strict';
    var sequence = 0;
    var labels = { boot: 'Page opened', activity: 'Exercise step', heartbeat: 'Page running', error: 'JavaScript error',
        promise_error: 'Unhandled promise', console_error: 'Console error', console_warn: 'Console warning', console_log: 'Console message',
        resource_error: 'Resource failed', network: 'Request', visibility: 'Visibility changed', pagehide: 'Page left', pageshow: 'Page shown',
        freeze: 'Page frozen', resume: 'Page resumed', context_lost: 'Graphics context lost', speech: 'Speech engine',
        app_navigation: 'App requested navigation', long_task: 'Long main-thread task', logout: 'Logged out' };
    function el(tag, text) { var e = document.createElement(tag); if (text != null) e.textContent = text; return e; }
    function time(s) { return s ? new Date(s).toLocaleString('en-GB', { timeZone: 'Asia/Shanghai', hour12: false }) : '—'; }
    function device(d, id) {
        var ua = d && d.ua || '';
        var name = /iPad/.test(ua) || (d && d.platform === 'MacIntel' && d.touch > 1) ? 'iPad' : /iPhone/.test(ua) ? 'iPhone' : /HUAWEI|HarmonyOS/.test(ua) ? 'Huawei tablet' : /Android/.test(ua) ? 'Android' : 'Browser';
        return name + (/baiduboxapp/i.test(ua) ? ' · Baidu' : /MicroMessenger/i.test(ua) ? ' · WeChat' : '') + ' · ' + (d && d.screen || '') + ' · ' + id.slice(-5);
    }
    async function load() {
        if (typeof currentStudent === 'undefined' || !currentStudent) return;
        var student = currentStudent, ticket = ++sequence, host = document.getElementById('diagnosticsLog'), status = document.getElementById('diagnosticsStatus');
        status.textContent = 'Loading diagnostics…'; host.replaceChildren();
        try {
            var response = await apiFetch(API_BASE + '/clientDiagnostics?view=events&studentId=' + encodeURIComponent(student.id), { cache: 'no-store' });
            if (!response.ok) throw new Error(response.status === 401 ? 'Please sign in again to view diagnostics.' : 'Diagnostics unavailable (' + response.status + '). Use Refresh to retry.');
            var data = await response.json();
            if (ticket !== sequence || currentStudent !== student) return;
            var days = data.days || [], config = data.config || {}, events = [], seen = new Set();
            days.forEach(function (day) { (day.events || []).forEach(function (e) {
                if (!seen.has(e.eventId)) { seen.add(e.eventId); events.push(Object.assign({ device: device(day.device, day.browserId), browserId: day.browserId }, e)); }
            }); });
            events.sort(function (a, b) { return b.ts.localeCompare(a.ts) || b.seq - a.seq; });
            var latest = days.reduce(function (a, d) { return !a || d.updatedAt > a ? d.updatedAt : a; }, '');
            status.textContent = (config.enabled ? 'Recording enabled until ' + time(config.endsAt) : 'Recording is off')
                + '. Last upload: ' + time(latest) + ' (China time).';
            document.getElementById('diagnosticsStop').disabled = !config.enabled;
            var profiles = new Map(); days.forEach(function (d) { profiles.set(d.browserId, device(d.device, d.browserId)); });
            var info = el('p', profiles.size ? 'Seen profiles: ' + Array.from(profiles.values()).join(' / ') : 'Waiting for this student to open the updated game and sign in.');
            info.style.color = '#94a3b8'; host.appendChild(info);
            if (!events.length) return;
            var restarts = events.filter(function (e) {
                if (e.type !== 'boot') return false;
                try { var p = JSON.parse(e.detail).previous; return p && !p.clean && p.visible === 'visible'; } catch (_) { return false; }
            });
            var errors = events.filter(function (e) { return ['error', 'promise_error', 'console_error', 'context_lost', 'resource_error'].indexOf(e.type) >= 0; });
            var summary = el('p', errors.length + ' error/resource indicators · ' + restarts.length + ' page openings following an unexplained visible exit. These are clues, not confirmed crashes.');
            summary.style.margin = '12px 0'; host.appendChild(summary);
            var table = el('table'); table.style.cssText = 'width:100%;border-collapse:collapse;font-size:13px;';
            var head = el('tr'); ['China time / profile', 'Activity', 'Evidence'].forEach(function (s) { head.appendChild(el('th', s)); }); table.appendChild(head);
            events.slice(0, 400).forEach(function (e) {
                var row = el('tr'); row.style.cssText = 'border-top:1px solid #334155;vertical-align:top;';
                var when = el('td', time(e.ts)); when.appendChild(el('div', e.device));
                var activity = el('td', labels[e.type] || e.type);
                var c = e.context || {};
                if (c.word || c.letter || c.round) activity.appendChild(el('div', [c.round === 'D' ? 'Handwriting' : c.round, c.word, c.letter ? 'letter ' + c.letter : ''].filter(Boolean).join(' · ')));
                var evidence = el('td');
                if (e.type === 'activity') evidence.appendChild(el('span', c.checkpoint || e.detail));
                else if (e.type === 'boot') {
                    var detail = null; try { detail = JSON.parse(e.detail); } catch (_) {}
                    var prev = detail && detail.previous;
                    evidence.appendChild(el('span', prev ? (prev.clean ? 'Previous page reported an exit.' : 'Previous page had no exit signal. Last seen: ' + time(prev.ts) + ' · ' + (prev.context && (prev.context.word || prev.context.checkpoint) || 'unknown activity')) : 'No previous-page breadcrumb.'));
                } else if (['error', 'promise_error', 'console_error', 'console_warn', 'speech', 'resource_error'].indexOf(e.type) >= 0) evidence.appendChild(el('span', (e.detail || '').slice(0, 350)));
                else evidence.appendChild(el('span', (e.detail || '').slice(0, 180)));
                var more = el('details'), title = el('summary', 'Details'); more.appendChild(title);
                var text = el('pre', 'Page: ' + e.boot + '\n' + (e.detail || '')); text.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;max-width:650px;'; more.appendChild(text); evidence.appendChild(more);
                [when, activity, evidence].forEach(function (cell) { cell.style.padding = '10px 8px'; row.appendChild(cell); }); table.appendChild(row);
            });
            var wrap = el('div'); wrap.style.overflowX = 'auto'; wrap.appendChild(table); host.appendChild(wrap);
        } catch (error) { if (ticket === sequence) status.textContent = error.message; }
    }
    async function configure(enabled) {
        if (!currentStudent) return;
        var status = document.getElementById('diagnosticsStatus');
        try {
            var response = await apiFetch(API_BASE + '/clientDiagnostics?studentId=' + encodeURIComponent(currentStudent.id), {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'configure', enabled: enabled, days: 7 })
            });
            if (!response.ok) throw new Error('Could not update diagnostics (' + response.status + ').');
            await load();
        } catch (error) { status.textContent = error.message; }
    }
    w.renderDiagnosticsTab = load;
    w.configureStudentDiagnostics = configure;
})(window);
