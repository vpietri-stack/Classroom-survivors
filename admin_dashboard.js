// ============================================================
// ADMIN DASHBOARD - Additional functionality for admin role
// Loaded AFTER teacher_dashboard.js
// ============================================================

let isAdmin = false;

function initAdminUI() {
    const savedUsers = JSON.parse(localStorage.getItem('savedUsers') || '[]');
    const activeUserId = localStorage.getItem('activeUserId') || (savedUsers[0] && savedUsers[0].id);
    const user = savedUsers.find(u => u.id === activeUserId && (u.role === 'admin' || u.role === 'BM')) || savedUsers.find(u => u.role === 'admin' || u.role === 'BM');
    isAdmin = user && user.role === 'admin';
    const isBM = user && user.role === 'BM';

    if (isAdmin) {
        document.getElementById('dashboardTitle').textContent = 'Admin Dashboard';
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
        document.querySelectorAll('.admin-col').forEach(el => el.style.display = '');
        document.querySelectorAll('.bm-or-admin-col').forEach(el => el.classList.remove('hidden'));
    } else if (isBM) {
        document.getElementById('dashboardTitle').textContent = 'BM Dashboard';
        document.querySelectorAll('.admin-col').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.bm-or-admin-col').forEach(el => el.classList.remove('hidden'));
    } else {
        document.querySelectorAll('.admin-col').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.bm-or-admin-col').forEach(el => el.classList.add('hidden'));
    }

    // Both admin and BM can add students and modify student detail settings/targets
    if (isAdmin || isBM) {
        document.querySelectorAll('.bm-or-admin-only').forEach(el => el.classList.remove('hidden'));
    }
}

// --- Password toggle ---
function togglePwVis(inputId, iconId) {
    const inp = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (inp.type === 'password') { inp.type = 'text'; icon.className = 'fas fa-eye-slash'; }
    else { inp.type = 'password'; icon.className = 'fas fa-eye'; }
}

function toggleRowPw(btn, pw) {
    const span = btn.previousElementSibling;
    if (span.dataset.visible === 'true') {
        span.textContent = '••••••';
        span.dataset.visible = 'false';
        btn.innerHTML = '<i class="fas fa-eye"></i>';
    } else {
        span.textContent = pw;
        span.dataset.visible = 'true';
        btn.innerHTML = '<i class="fas fa-eye-slash"></i>';
    }
}

// --- Book/Unit/Page cascade helpers ---
function populateBookSelect(selId, currentVal) {
    const sel = document.getElementById(selId);
    sel.innerHTML = '<option value="">—</option>';
    Object.keys(AVAILABLE_CONTENT).sort().forEach(b => {
        sel.innerHTML += `<option value="${b}" ${b===currentVal?'selected':''}>${b}</option>`;
    });
}

function populateUnitSelect(selId, book, currentVal) {
    const sel = document.getElementById(selId);
    sel.innerHTML = '<option value="">—</option>';
    if (!book || !AVAILABLE_CONTENT[book]) return;
    Object.keys(AVAILABLE_CONTENT[book]).sort((a,b)=>a-b).forEach(u => {
        sel.innerHTML += `<option value="${u}" ${u===currentVal?'selected':''}>${u}</option>`;
    });
}

function populatePageSelect(selId, book, unit, currentVal) {
    const sel = document.getElementById(selId);
    sel.innerHTML = '<option value="">—</option>';
    if (!book || !unit || !AVAILABLE_CONTENT[book] || !AVAILABLE_CONTENT[book][unit]) return;
    AVAILABLE_CONTENT[book][unit].forEach(p => {
        const ps = String(p);
        sel.innerHTML += `<option value="${ps}" ${ps===currentVal?'selected':''}>${ps}</option>`;
    });
}

function populateClassTimeSelect(selId, currentVal, includeCustom) {
    const sel = document.getElementById(selId);
    sel.innerHTML = '<option value="">— None —</option>';
    const times = [...new Set(allStudents.map(s => s.classTime).filter(Boolean))].sort();
    times.forEach(t => {
        sel.innerHTML += `<option value="${t}" ${t===currentVal?'selected':''}>${t}</option>`;
    });
    if (includeCustom) sel.innerHTML += '<option value="__custom__">+ New class time...</option>';
}

// --- Cascade handlers for Settings tab ---
function onSettingsBookChange() {
    const book = document.getElementById('settingsBook').value;
    populateUnitSelect('settingsUnit', book, '');
    populatePageSelect('settingsPage', book, '', '');
}
function onSettingsUnitChange() {
    const book = document.getElementById('settingsBook').value;
    const unit = document.getElementById('settingsUnit').value;
    populatePageSelect('settingsPage', book, unit, '');
}

// --- Cascade for Add Student modal ---
function onAddBookChange() {
    const book = document.getElementById('addBook').value;
    populateUnitSelect('addUnit', book, '');
    populatePageSelect('addPage', book, '', '');
}
function onAddUnitChange() {
    const book = document.getElementById('addBook').value;
    const unit = document.getElementById('addUnit').value;
    populatePageSelect('addPage', book, unit, '');
}

// --- Cascade for Bulk Content modal ---
function onBulkBookChange() {
    const book = document.getElementById('bulkBook').value;
    populateUnitSelect('bulkUnit', book, '');
    populatePageSelect('bulkPage', book, '', '');
}
function onBulkUnitChange() {
    const book = document.getElementById('bulkBook').value;
    const unit = document.getElementById('bulkUnit').value;
    populatePageSelect('bulkPage', book, unit, '');
}

// --- Modal helpers ---
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function showStatus(elId, msg, isError) {
    const el = document.getElementById(elId);
    el.textContent = msg;
    el.className = 'save-status ' + (isError ? 'error' : 'success');
    setTimeout(() => { el.textContent = ''; }, 3000);
}

// --- Settings Tab ---
function populateSettingsTab() {
    if (!currentStudent) return;
    document.getElementById('settingsFullName').value = currentStudent.fullName || '';
    populateTeacherSelect('settingsTeacher', currentStudent.teacher || '');
    document.getElementById('settingsTeacherCustom').classList.add('hidden');
    document.getElementById('settingsTeacherCustom').value = '';
    populateClassTimeSelect('settingsClassTime', currentStudent.classTime || '', false);
    populateBookSelect('settingsBook', currentStudent.book || '');
    populateUnitSelect('settingsUnit', currentStudent.book || '', currentStudent.unit || '');
    populatePageSelect('settingsPage', currentStudent.book || '', currentStudent.unit || '', currentStudent.page || '');
    document.getElementById('settingsPassword').value = currentStudent.password || '';
    document.getElementById('settingsPassword').type = 'password';
    document.getElementById('settingsPwIcon').className = 'fas fa-eye';
    document.getElementById('settingsNeedsPwChange').checked = !!currentStudent.needsPasswordChange;
}

function onSettingsTeacherChange() {
    const val = document.getElementById('settingsTeacher').value;
    if (val === '__custom__') {
        document.getElementById('settingsTeacherCustom').classList.remove('hidden');
    } else {
        document.getElementById('settingsTeacherCustom').classList.add('hidden');
    }
}

async function saveStudentSettings() {
    if (!currentStudent) return;
    let teacher = document.getElementById('settingsTeacher').value;
    if (teacher === '__custom__') teacher = document.getElementById('settingsTeacherCustom').value.trim();
    const fields = {
        fullName: document.getElementById('settingsFullName').value.trim(),
        teacher: teacher,
        classTime: document.getElementById('settingsClassTime').value,
        book: document.getElementById('settingsBook').value,
        unit: document.getElementById('settingsUnit').value,
        page: document.getElementById('settingsPage').value,
        password: document.getElementById('settingsPassword').value.trim(),
        needsPasswordChange: document.getElementById('settingsNeedsPwChange').checked
    };
    try {
        const res = await apiFetch(`${API_BASE}/updateStudent`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ studentId: currentStudent.id, fields })
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        // Update local data
        Object.assign(currentStudent, fields);
        document.getElementById('detailStudentName').textContent = fields.fullName;
        document.getElementById('detailStudentClass').textContent = fields.classTime || 'No class';
        document.getElementById('detailStudentBook').textContent = fields.book ? `${fields.book} U${fields.unit} P${fields.page}` : 'No content';
        showStatus('settingsSaveStatus', '✓ Saved!', false);
    } catch(e) {
        showStatus('settingsSaveStatus', 'Error: ' + e.message, true);
    }
}

// --- Targets Tab ---
function renderTargetsTab() {
    if (!currentStudent) return;
    const targets = currentStudent.targets || [];
    const tbody = document.getElementById('targetsTableBody');
    const noMsg = document.getElementById('noTargetsMsg');
    if (targets.length === 0) { tbody.innerHTML = ''; noMsg.classList.remove('hidden'); return; }
    noMsg.classList.add('hidden');

    tbody.innerHTML = targets.map((t, i) => {
        const start = new Date(t.startTime);
        const end = new Date(t.endTime);
        const now = new Date();
        const completed = countSessionsInRange(currentStudent, start, end);
        const pct = Math.min(100, Math.round(completed / t.targetSessions * 100));
        let status, statusClass;
        if (now < start) { status = 'Upcoming'; statusClass = 'badge-upcoming'; }
        else if (now > end) { status = completed >= t.targetSessions ? 'Completed ✓' : 'Missed'; statusClass = completed >= t.targetSessions ? 'badge-complete' : 'badge-missed'; }
        else { status = 'Active'; statusClass = 'badge-active'; }

        const startStr = formatBeijingDT(start);
        const endStr = formatBeijingDT(end);
        return `<tr>
            <td style="font-size:0.8rem">${startStr}<br>→ ${endStr}</td>
            <td>${t.targetSessions}</td>
            <td><strong>${completed}</strong> / ${t.targetSessions} (${pct}%)</td>
            <td><span class="badge ${statusClass}">${status}</span></td>
            <td><button onclick="deleteTarget(${i})" class="row-action-btn" title="Delete"><i class="fas fa-trash"></i></button></td>
        </tr>`;
    }).join('');
}

function countSessionsInRange(student, start, end) {
    if (!student.analytics || !Array.isArray(student.analytics)) return 0;
    return student.analytics.filter(e => {
        if (e.type !== 'session') return false;
        const ts = new Date(e.timestamp);
        return ts >= start && ts <= end;
    }).length;
}

function formatBeijingDT(d) {
    return d.toLocaleString('en-GB', { timeZone: 'Asia/Shanghai', day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

async function addTargetForStudent() {
    if (!currentStudent) return;
    const startVal = document.getElementById('targetStart').value;
    const endVal = document.getElementById('targetEnd').value;
    const count = parseInt(document.getElementById('targetCount').value);
    if (!startVal || !endVal || !count) { showStatus('targetSaveStatus', 'Fill all fields', true); return; }

    // datetime-local gives local time; append Beijing offset
    const startTime = startVal + ':00+08:00';
    const endTime = endVal + ':00+08:00';

    try {
        const res = await apiFetch(`${API_BASE}/setTargets`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ studentIds: [currentStudent.id], target: { startTime, endTime, targetSessions: count } })
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        // Update local
        if (!currentStudent.targets) currentStudent.targets = [];
        currentStudent.targets.push({ id: data.results[0].targetId, startTime, endTime, targetSessions: count });
        renderTargetsTab();
        showStatus('targetSaveStatus', '✓ Target added!', false);
    } catch(e) {
        showStatus('targetSaveStatus', 'Error: ' + e.message, true);
    }
}

async function deleteTarget(idx) {
    if (!currentStudent || !confirm('Delete this target?')) return;
    currentStudent.targets.splice(idx, 1);
    try {
        await apiFetch(`${API_BASE}/updateStudent`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ studentId: currentStudent.id, fields: { targets: currentStudent.targets } })
        });
    } catch(e) { console.warn('Failed to delete target', e); }
    renderTargetsTab();
}

// --- Add Student Modal ---
function openAddStudentModal() {
    document.getElementById('addStudentModal').classList.remove('hidden');
    document.getElementById('addStudentError').classList.add('hidden');
    ['addId','addLogin','addPassword','addFullName'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('addNeedsPwChange').checked = true;
    populateTeacherSelect('addTeacher', '');
    document.getElementById('addTeacherCustom').classList.add('hidden');
    document.getElementById('addTeacherCustom').value = '';
    populateClassTimeSelect('addClassTime', '', true);
    document.getElementById('addClassTimeCustom').classList.add('hidden');
    document.getElementById('addClassTimeCustom').value = '';
    populateBookSelect('addBook', '');
    populateUnitSelect('addUnit', '', '');
    populatePageSelect('addPage', '', '', '');
}

function populateTeacherSelect(selId, currentVal) {
    const sel = document.getElementById(selId);
    const teachers = [...new Set(allStudents.map(s => s.teacher).filter(Boolean))].sort();
    // Ensure 'Val' is always present
    if (!teachers.includes('Val')) teachers.unshift('Val');
    sel.innerHTML = '<option value="">— Select Teacher —</option>';
    teachers.forEach(t => {
        sel.innerHTML += `<option value="${t}" ${t===currentVal?'selected':''}>${t}</option>`;
    });
    sel.innerHTML += '<option value="__custom__">+ New teacher...</option>';
}

function onAddTeacherChange() {
    const val = document.getElementById('addTeacher').value;
    if (val === '__custom__') {
        document.getElementById('addTeacherCustom').classList.remove('hidden');
    } else {
        document.getElementById('addTeacherCustom').classList.add('hidden');
    }
}

async function submitAddStudent() {
    const errEl = document.getElementById('addStudentError');
    errEl.classList.add('hidden');
    const id = document.getElementById('addId').value.trim();
    const login = document.getElementById('addLogin').value.trim();
    const password = document.getElementById('addPassword').value.trim();
    const fullName = document.getElementById('addFullName').value.trim();

    let teacher = document.getElementById('addTeacher').value;
    if (teacher === '__custom__') teacher = document.getElementById('addTeacherCustom').value.trim();
    if (!id || !login || !password || !fullName || !teacher) { errEl.textContent = 'Fill required fields (*)'; errEl.classList.remove('hidden'); return; }

    let classTime = document.getElementById('addClassTime').value;
    if (classTime === '__custom__') classTime = document.getElementById('addClassTimeCustom').value.trim();

    const body = {
        id, login, password, fullName, classTime, teacher,
        book: document.getElementById('addBook').value,
        unit: document.getElementById('addUnit').value,
        page: document.getElementById('addPage').value,
        needsPasswordChange: document.getElementById('addNeedsPwChange').checked
    };
    try {
        const res = await apiFetch(`${API_BASE}/addStudent`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify(body)
        });
        if (!res.ok) { errEl.textContent = await res.text(); errEl.classList.remove('hidden'); return; }
        closeModal('addStudentModal');
        loadAllStudents(); // Refresh
    } catch(e) {
        errEl.textContent = 'Network error'; errEl.classList.remove('hidden');
    }
}

// --- Bulk operations ---
function previewBulkStudents(classSelId, previewId) {
    const classTime = document.getElementById(classSelId).value;
    const preview = document.getElementById(previewId);
    if (!classTime) { preview.innerHTML = ''; return; }
    const currentTeacher = document.getElementById('filterTeacher') ? document.getElementById('filterTeacher').value : '';
    const students = allStudents.filter(s => s.classTime === classTime && s.role !== 'BM' && s.role !== 'admin' && (!currentTeacher || s.teacher === currentTeacher));
    preview.innerHTML = `<div class="bulk-preview-label">Will apply to ${students.length} student(s):</div>` +
        students.map(s => `<span class="bulk-chip">${s.avatar||'👤'} ${s.fullName||s.login}</span>`).join('');
}

function openBulkTargetsModal() {
    document.getElementById('bulkTargetsModal').classList.remove('hidden');
    document.getElementById('bulkTargetError').classList.add('hidden');
    populateClassTimeSelect('bulkTargetClass', document.getElementById('filterClassTime').value, false);
    document.getElementById('bulkTargetStart').value = '';
    document.getElementById('bulkTargetEnd').value = '';
    document.getElementById('bulkTargetCount').value = '10';
    previewBulkStudents('bulkTargetClass', 'bulkTargetPreview');
}

async function submitBulkTargets() {
    const errEl = document.getElementById('bulkTargetError');
    errEl.classList.add('hidden');
    const classTime = document.getElementById('bulkTargetClass').value;
    const startVal = document.getElementById('bulkTargetStart').value;
    const endVal = document.getElementById('bulkTargetEnd').value;
    const count = parseInt(document.getElementById('bulkTargetCount').value);
    if (!classTime || !startVal || !endVal || !count) { errEl.textContent = 'Fill all fields'; errEl.classList.remove('hidden'); return; }

    const currentTeacher = document.getElementById('filterTeacher') ? document.getElementById('filterTeacher').value : '';
    const ids = allStudents.filter(s => s.classTime === classTime && s.role !== 'BM' && s.role !== 'admin' && (!currentTeacher || s.teacher === currentTeacher)).map(s => s.id);
    if (ids.length === 0) { errEl.textContent = 'No students in this class'; errEl.classList.remove('hidden'); return; }

    try {
        const res = await apiFetch(`${API_BASE}/setTargets`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ studentIds: ids, target: { startTime: startVal+':00+08:00', endTime: endVal+':00+08:00', targetSessions: count } })
        });
        if (!res.ok) throw new Error(await res.text());
        closeModal('bulkTargetsModal');
        loadAllStudents();
    } catch(e) {
        errEl.textContent = 'Error: ' + e.message; errEl.classList.remove('hidden');
    }
}

function openBulkContentModal() {
    document.getElementById('bulkContentModal').classList.remove('hidden');
    document.getElementById('bulkContentError').classList.add('hidden');
    populateClassTimeSelect('bulkContentClass', document.getElementById('filterClassTime').value, false);
    populateBookSelect('bulkBook', '');
    populateUnitSelect('bulkUnit', '', '');
    populatePageSelect('bulkPage', '', '', '');
    previewBulkStudents('bulkContentClass', 'bulkContentPreview');
}

async function submitBulkContent() {
    const errEl = document.getElementById('bulkContentError');
    errEl.classList.add('hidden');
    const classTime = document.getElementById('bulkContentClass').value;
    const book = document.getElementById('bulkBook').value;
    const unit = document.getElementById('bulkUnit').value;
    const page = document.getElementById('bulkPage').value;
    if (!classTime || !book || !unit || !page) { errEl.textContent = 'Fill all fields'; errEl.classList.remove('hidden'); return; }

    const currentTeacher = document.getElementById('filterTeacher') ? document.getElementById('filterTeacher').value : '';
    const students = allStudents.filter(s => s.classTime === classTime && s.role !== 'BM' && s.role !== 'admin' && (!currentTeacher || s.teacher === currentTeacher));
    if (students.length === 0) { errEl.textContent = 'No students in this class'; errEl.classList.remove('hidden'); return; }

    try {
        for (const s of students) {
            await apiFetch(`${API_BASE}/updateStudent`, {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ studentId: s.id, fields: { book, unit, page } })
            });
        }
        closeModal('bulkContentModal');
        loadAllStudents();
    } catch(e) {
        errEl.textContent = 'Error: ' + e.message; errEl.classList.remove('hidden');
    }
}

// ============================================================
// SR STATE TAB
// ============================================================

/**
 * Renders the SR State tab for the current student.
 */
function renderSRTab() {
    if (!currentStudent) return;
    const srState = currentStudent.srState || {};
    const tbody = document.getElementById('srTableBody');
    const noMsg = document.getElementById('noSRMsg');

    const categoryFilter = document.getElementById('srCategoryFilter').value;
    const searchTerm = (document.getElementById('srItemSearch').value || '').toLowerCase();
    const sortBy = document.getElementById('srSortBy').value;

    // Flatten all SR entries into a single list
    let rows = [];
    const categoryLabels = { vocab: 'Vocabulary', sentences: 'Sentences', sentencePairs: 'Sentence Pairs' };

    for (const cat of ['vocab', 'sentences', 'sentencePairs']) {
        if (categoryFilter && cat !== categoryFilter) continue;
        if (!srState[cat]) continue;
        for (const [key, data] of Object.entries(srState[cat])) {
            if (searchTerm && !key.toLowerCase().includes(searchTerm)) continue;
            rows.push({ cat, catLabel: categoryLabels[cat], key, ...data });
        }
    }

    if (rows.length === 0) {
        tbody.innerHTML = '';
        noMsg.classList.remove('hidden');
        return;
    }
    noMsg.classList.add('hidden');

    // Sort
    rows.sort((a, b) => {
        switch (sortBy) {
            case 'dueAsc':  return (a.dueAfterSession || 0) - (b.dueAfterSession || 0);
            case 'dueDesc': return (b.dueAfterSession || 0) - (a.dueAfterSession || 0);
            case 'intervalAsc': return (a.interval || 0) - (b.interval || 0);
            case 'intervalDesc': return (b.interval || 0) - (a.interval || 0);
            case 'key': return a.key.localeCompare(b.key);
            default: return 0;
        }
    });

    const currentSession = currentStudent.sessionCount || 0;

    tbody.innerHTML = rows.map(r => {
        const isDue = (r.dueAfterSession || 0) <= currentSession;
        const resultClass = r.lastResult === 'success' ? 'sr-result-success' : r.lastResult === 'fail' ? 'sr-result-fail' : '';
        const dueStr = isDue
            ? `<span class="sr-due-now">Due now (sess ${r.dueAfterSession})</span>`
            : `Session ${r.dueAfterSession}`;
        return `<tr>
            <td><span class="badge badge-type" style="font-size:0.7rem">${r.catLabel}</span></td>
            <td class="sr-key-cell" title="${r.key.replace(/"/g,'&quot;')}">${r.key}</td>
            <td><strong>${r.interval || 1}</strong></td>
            <td>${dueStr}</td>
            <td>${r.lastSession ?? '—'}</td>
            <td><span class="${resultClass}">${r.lastResult || '—'}</span></td>
        </tr>`;
    }).join('');
}

// ============================================================
// SR POPUP (from Exercises tab click)
// ============================================================

/**
 * Given an exercise event, return the SR key string (or null if not applicable).
 */
function getSRKeyForExercise(ex) {
    if (!ex || !ex.exerciseType || !ex.itemDetails) return null;
    // These types map to SR keys
    const srTypes = ['spelling', 'wordScramble', 'sentenceScramble', 'sentenceMatch'];
    if (!srTypes.includes(ex.exerciseType)) return null;
    return ex.itemDetails;
}

/**
 * Shows an inline SR state popup for a given key.
 * @param {string} keyJson - JSON-encoded key string (double-stringified for html attr safety)
 */
function showSRPopup(keyJson) {
    const key = JSON.parse(keyJson);
    if (!currentStudent || !currentStudent.srState) return;

    const srState = currentStudent.srState;
    let found = null;
    let foundCat = null;

    for (const cat of ['vocab', 'sentences', 'sentencePairs']) {
        if (srState[cat] && srState[cat][key]) {
            found = srState[cat][key];
            foundCat = cat;
            break;
        }
    }

    // Remove any existing popup
    document.querySelectorAll('.sr-inline-popup').forEach(el => el.remove());

    const popup = document.createElement('div');
    popup.className = 'sr-inline-popup modal-overlay';
    popup.onclick = (e) => { if (e.target === popup) popup.remove(); };

    const catLabels = { vocab: 'Vocabulary', sentences: 'Sentences', sentencePairs: 'Sentence Pairs' };
    const currentSession = currentStudent.sessionCount || 0;

    if (!found) {
        popup.innerHTML = `<div class="modal-box" style="max-width:440px">
            <div class="modal-header"><h2><i class="fas fa-brain"></i> SR State</h2><button onclick="this.closest('.sr-inline-popup').remove()" class="modal-close">&times;</button></div>
            <div class="modal-body">
                <p style="color:var(--dash-text-dim);font-style:italic">No SR data found for this item.</p>
                <p style="color:var(--dash-text-dim);font-size:0.82rem;margin-top:8px">Key: <code>${key}</code></p>
            </div>
        </div>`;
    } else {
        const isDue = (found.dueAfterSession || 0) <= currentSession;
        const resultColor = found.lastResult === 'success' ? 'var(--dash-accent)' : 'var(--dash-danger)';
        popup.innerHTML = `<div class="modal-box" style="max-width:480px">
            <div class="modal-header"><h2><i class="fas fa-brain"></i> SR State</h2><button onclick="this.closest('.sr-inline-popup').remove()" class="modal-close">&times;</button></div>
            <div class="modal-body">
                <div class="sr-popup-item">${key}</div>
                <div class="sr-popup-category"><span class="badge badge-type">${catLabels[foundCat]}</span></div>
                <div class="sr-popup-grid">
                    <div class="sr-popup-stat"><span class="sr-popup-label">Interval</span><span class="sr-popup-val">${found.interval ?? 1} session(s)</span></div>
                    <div class="sr-popup-stat"><span class="sr-popup-label">Due After Session</span><span class="sr-popup-val ${isDue ? 'sr-due-now' : ''}">${found.dueAfterSession ?? '—'}${isDue ? ' ✓ Due now' : ''}</span></div>
                    <div class="sr-popup-stat"><span class="sr-popup-label">Last Seen Session</span><span class="sr-popup-val">${found.lastSession ?? '—'}</span></div>
                    <div class="sr-popup-stat"><span class="sr-popup-label">Last Result</span><span class="sr-popup-val" style="color:${resultColor};font-weight:700">${found.lastResult ?? '—'}</span></div>
                </div>
                <p style="color:var(--dash-text-dim);font-size:0.75rem;margin-top:16px">Student is currently at session <strong>${currentSession}</strong>.</p>
            </div>
        </div>`;
    }

    document.body.appendChild(popup);
}

// ============================================================
// ADMIN - MANAGE BMs PANEL
// ============================================================

function openManageBmsModal() {
    document.getElementById('manageBmsModal').classList.remove('hidden');
    switchBmModalTab('bms');
}

function switchBmModalTab(tab) {
    // Switch active tab buttons
    ['bmTabBms', 'bmTabAdd', 'bmTabLogs'].forEach(id => {
        document.getElementById(id).classList.remove('active');
    });
    document.getElementById(`bmTab${tab.charAt(0).toUpperCase() + tab.slice(1)}`).classList.add('active');

    // Switch tab contents
    ['bmContentBms', 'bmContentAdd', 'bmContentLogs'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    document.getElementById(`bmContent${tab.charAt(0).toUpperCase() + tab.slice(1)}`).classList.remove('hidden');

    if (tab === 'bms') {
        loadBmsList();
    } else if (tab === 'logs') {
        loadBmActivityLogs();
    }
}

async function loadBmsList() {
    const tbody = document.getElementById('bmsTableBody');
    tbody.innerHTML = `<tr><td colspan="4"><div class="loading-spinner"></div></td></tr>`;

    try {
        const res = await apiFetch(`${API_BASE}/manageBms?action=list`);
        if (!res.ok) throw new Error(await res.text());
        const bms = await res.json();
        renderBmsList(bms);
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4" class="no-results"><p>Error: ${e.message}</p></td></tr>`;
    }
}

function renderBmsList(bms) {
    const tbody = document.getElementById('bmsTableBody');
    if (bms.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="no-results"><p>No BM accounts found.</p></td></tr>`;
        return;
    }

    tbody.innerHTML = bms.map(bm => {
        return `<tr>
            <td><strong>${bm.fullName || '—'}</strong></td>
            <td><code>${bm.login}</code></td>
            <td>
                <div class="pw-field-row" style="max-width: 250px;">
                    <input type="password" value="${bm.password}" id="bmPw_${bm.id}" class="form-input" style="height: 32px; font-size: 0.85rem;" readonly>
                    <button type="button" onclick="togglePwVis('bmPw_${bm.id}', 'bmPwIcon_${bm.id}')" class="pw-toggle-btn" style="height: 32px; width: 32px;"><i id="bmPwIcon_${bm.id}" class="fas fa-eye"></i></button>
                </div>
            </td>
            <td>
                <div style="display: flex; gap: 8px;">
                    <button onclick="changeBmPasswordPrompt('${bm.id}')" class="dash-action-btn" style="padding: 4px 8px; font-size: 0.8rem;" title="Change Password"><i class="fas fa-key"></i> Pass</button>
                    <button onclick="submitDeleteBm('${bm.id}')" class="dash-action-btn" style="padding: 4px 8px; font-size: 0.8rem; background-color: var(--dash-danger);" title="Delete BM"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

async function submitAddBm() {
    const id = document.getElementById('addBmId').value.trim();
    const login = document.getElementById('addBmLogin').value.trim();
    const fullName = document.getElementById('addBmFullName').value.trim();
    const password = document.getElementById('addBmPassword').value.trim();
    const errEl = document.getElementById('addBmError');

    errEl.classList.add('hidden');
    errEl.textContent = '';

    if (!id || !login || !fullName || !password) {
        errEl.textContent = 'All fields are required.';
        errEl.classList.remove('hidden');
        return;
    }

    try {
        const res = await apiFetch(`${API_BASE}/manageBms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'add', id, login, fullName, password })
        });
        if (!res.ok) throw new Error(await res.text());

        // Reset fields
        ['addBmId', 'addBmLogin', 'addBmFullName', 'addBmPassword'].forEach(fId => {
            document.getElementById(fId).value = '';
        });
        
        switchBmModalTab('bms');
    } catch (e) {
        errEl.textContent = 'Error: ' + e.message;
        errEl.classList.remove('hidden');
    }
}

async function changeBmPasswordPrompt(bmId) {
    const newPw = prompt("Enter new password for this BM:");
    if (newPw === null) return; // user cancelled
    const password = newPw.trim();
    if (!password) {
        alert("Password cannot be empty.");
        return;
    }

    try {
        const res = await apiFetch(`${API_BASE}/manageBms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'changePassword', bmId, password })
        });
        if (!res.ok) throw new Error(await res.text());
        alert("Password updated successfully!");
        loadBmsList();
    } catch (e) {
        alert("Error changing password: " + e.message);
    }
}

async function submitDeleteBm(bmId) {
    if (!confirm(`Are you sure you want to delete BM with ID: ${bmId}? This cannot be undone.`)) return;

    try {
        const res = await apiFetch(`${API_BASE}/manageBms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', bmId })
        });
        if (!res.ok) throw new Error(await res.text());
        loadBmsList();
    } catch (e) {
        alert("Error deleting BM: " + e.message);
    }
}

async function loadBmActivityLogs() {
    const tbody = document.getElementById('bmLogsTableBody');
    tbody.innerHTML = `<tr><td colspan="4"><div class="loading-spinner"></div></td></tr>`;

    try {
        const res = await apiFetch(`${API_BASE}/manageBms?action=logs`);
        if (!res.ok) throw new Error(await res.text());
        const logs = await res.json();
        renderBmActivityLog(logs);
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4" class="no-results"><p>Error: ${e.message}</p></td></tr>`;
    }
}

function renderBmActivityLog(logs) {
    const tbody = document.getElementById('bmLogsTableBody');
    if (logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="no-results"><p>No activity logs found yet.</p></td></tr>`;
        return;
    }

    tbody.innerHTML = logs.map(log => {
        const ts = formatBeijingDT(new Date(log.timestamp));
        let actionLabel = '';
        let detailsHtml = '';

        if (log.action === 'create_student') {
            actionLabel = '<span class="badge badge-complete">Created Student</span>';
            detailsHtml = `Student ID: <code>${log.details.studentId}</code>, Name: <strong>${log.details.studentName}</strong>`;
        } else if (log.action === 'update_student') {
            actionLabel = '<span class="badge badge-active">Updated Student</span>';
            const changeItems = [];
            const changes = log.details.changes || {};
            for (const field of Object.keys(changes)) {
                let fromVal = changes[field].from;
                let toVal = changes[field].to;
                if (typeof fromVal === 'object') fromVal = JSON.stringify(fromVal);
                if (typeof toVal === 'object') toVal = JSON.stringify(toVal);
                changeItems.push(`<li><code>${field}</code>: <span style="text-decoration: line-through; color: var(--dash-danger);">${fromVal ?? 'none'}</span> → <span style="color: var(--dash-accent); font-weight: bold;">${toVal ?? 'none'}</span></li>`);
            }
            detailsHtml = `
                <div>Student: <strong>${log.details.studentName}</strong> (<code>${log.details.studentId}</code>)</div>
                <ul style="margin: 4px 0 0 15px; padding: 0; font-size: 0.8rem; line-height: 1.3;">
                    ${changeItems.join('')}
                </ul>
            `;
        }

        return `<tr>
            <td style="font-size:0.8rem; white-space: nowrap;">${ts}</td>
            <td><code>${log.bmId}</code></td>
            <td>${actionLabel}</td>
            <td style="font-size:0.85rem;">${detailsHtml}</td>
        </tr>`;
    }).join('');
}

