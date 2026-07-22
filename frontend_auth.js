// API_BASE_URL is defined in config.js (loaded before this script)
const API_BASE = API_BASE_URL;

// --- SESSION TOKEN (c) design) ---
// The server mints a signed token on login. We store it in localStorage
// (parity with the prior savedUsers approach) and send it as a Bearer header.
// The server derives the acting identity from this token; it NEVER trusts a
// client-supplied student/creator id for scoping.
const SESSION_TOKEN_KEY = 'csSessionToken';

function getSessionToken() {
    try { return localStorage.getItem(SESSION_TOKEN_KEY) || null; } catch { return null; }
}
function setSessionToken(token) {
    try { if (token) localStorage.setItem(SESSION_TOKEN_KEY, token); else localStorage.removeItem(SESSION_TOKEN_KEY); } catch {}
}

async function apiFetch(url, options = {}) {
    const appKey = await getAppKey();
    const token = getSessionToken();
    options.headers = {
        ...options.headers,
        'X-App-Key': appKey
    };
    if (token) {
        // Azure SWA's managed-functions proxy OWNS the `Authorization` header
        // (it overwrites it with the host's own token), so we ship our session
        // token in X-Auth-Token — the only header that reaches the function
        // intact. Without this, every token-protected call returns 403.
        options.headers['X-Auth-Token'] = token;
    }
    // NOTE: we no longer append ?creatorId — the server scopes by the token.
    return fetch(url, options);
}
// --- AUTH & ANALYTICS STATE (Moved to teaching_content.js) ---

// --- TEST MODE FLAG ---
var isTestMode = false;

// --- SR STATE (set on login, finalised at session end) ---
var srPendingState = null;       // computed new srState waiting for the next flush
var srIncrementSession = false;  // whether this flush should increment sessionCount

/** Current session index = completed sessions so far (0-based). */
function getCurrentSession() {
    return (authActiveUser && authActiveUser.sessionCount) || 0;
}

/**
 * Called by study_mode.js / game.js at the end of every session (in game mode
 * the whole run's accumulated results are finalised once at game-over).
 * Computes the new srState and marks the next analytics flush to persist it.
 *
 * SR interval + success/failure are written ONCE per session per item — at the
 * FIRST check — then locked. A session is a single finalizeSession call (one
 * game run / one study session), and its results are accumulated in
 * srGameResults / srStudyResults before this fires. We therefore collapse each
 * (type,key) to its canonical first-check outcome so a later same-session
 * prompt (fail-then-success on the same item) is recorded once, as a failure,
 * and never re-doubles an interval.
 *
 * Canonical outcome for an item's first check this session:
 *   - firstAttempt correct (firstAttempt === true)            -> success
 *   - firstAttempt wrong, later correct (firstAttempt false)  -> failure
 *   - firstAttempt wrong, never succeeded this prompt         -> failure
 *   (firstAttempt === false means "first recorded check was wrong".)
 *
 * @param {Array} sessionResults  [{ type, key, firstAttempt }, ...]
 */
function finalizeSession(sessionResults, shouldIncrementSession = true) {
    if (!authActiveUser || isTestMode || !sessionResults || sessionResults.length === 0) return;

    const currentSession = getCurrentSession();
    const currentSRState = authActiveUser.srState || { vocab: {}, sentences: {}, sentencePairs: {} };

    // Collapse each (type,key) to its canonical FIRST-check outcome.
    // First occurrence in the batch wins (fail-then-success -> recorded as failure).
    const canonical = new Map();
    for (const r of sessionResults) {
        if (!r || !r.type || r.key === undefined || r.key === null) continue;
        const id = r.type + '|' + r.key;
        if (!canonical.has(id)) canonical.set(id, r);
    }
    const merged = Array.from(canonical.values());
    if (merged.length === 0) return;

    const newSRState = updateSRStateForSession(currentSRState, merged, currentSession);

    // Eagerly update in-memory user so the next session in the same page-load gets fresh data
    authActiveUser.srState = newSRState;
    if (shouldIncrementSession) {
        authActiveUser.sessionCount = currentSession + 1;
        srIncrementSession = true;
    }

    // Queue for next flush
    srPendingState = newSRState;

    // Check if we need to auto-advance the page
    checkAndAdvancePageIfAllOnCooldown();
}

function startExerciseTracking() {
    exerciseStartTime = Date.now();
    exerciseAttempts = 1; // First attempt counts as 1
}

function incrementExerciseAttempts() {
    exerciseAttempts++;
}

function queueExerciseEvent(exerciseType, mode, itemDetails = null, customAttempts = null) {
    if (!authActiveUser || isTestMode) return;  // Skip recording in test mode
    const durationMs = Date.now() - exerciseStartTime;
    
    const event = {
        type: 'exercise',
        exerciseType: exerciseType,
        mode: mode,
        attempts: customAttempts !== null ? customAttempts : exerciseAttempts,
        durationMs: durationMs,
        timestamp: new Date().toISOString(),
        // Stable id so the server can de-duplicate if this event is flushed
        // again after a retry (tab-close + next-launch re-send).
        eventId: 'ex_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10)
    };
    
    if (itemDetails) {
        event.itemDetails = itemDetails;
    }
    
    analyticsQueue.push(event);
    persistAnalyticsQueue();
    if (authActiveUser) {
        if (!authActiveUser.analytics) authActiveUser.analytics = [];
        authActiveUser.analytics.push(event);
        saveActiveUserToCache();
    }
    scheduleAnalyticsFlush();
}

function queueSessionEvent(sessionType, data) {
    if (!authActiveUser || isTestMode) return;  // Skip recording in test mode
    const event = {
        type: 'session',
        sessionType: sessionType,
        data: data,
        timestamp: new Date().toISOString(),
        // Stable id so the server can de-duplicate if this event is flushed
        // again after a retry (tab-close + next-launch re-send).
        eventId: 'se_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10)
    };
    analyticsQueue.push(event);
    persistAnalyticsQueue();
    if (authActiveUser) {
        if (!authActiveUser.analytics) authActiveUser.analytics = [];
        authActiveUser.analytics.push(event);
        saveActiveUserToCache();
    }
    scheduleAnalyticsFlush();
}

function scheduleAnalyticsFlush() {
    if (analyticsFlushTimer) clearTimeout(analyticsFlushTimer);
    analyticsFlushTimer = setTimeout(flushAnalytics, 2000);
}

/**
 * FIX #2: fire-and-forget flush on page hide / tab close.
 *
 * Mobile Safari (iOS) and most browsers do NOT run async `fetch` started in
 * `beforeunload`/`pagehide` to completion — the request is abandoned when the
 * page unloads, which is exactly when a kid closes the app after game-over. The
 * reliable mechanism is `navigator.sendBeacon`, which is guaranteed to be
 * delivered even as the page goes away. We also try `fetch(..., {keepalive:true})`
 * as a synchronous-enough fallback.
 *
 * This is the PRIMARY writer on unload. The persisted localStorage queue (fix #3)
 * is the SECONDARY safety net: if even sendBeacon fails (e.g. offline at the
 * moment of closing), the events remain in localStorage and are retried on the
 * next launch.
 */
let _unloadFlushBound = false;
function bindUnloadAnalyticsFlush() {
    if (_unloadFlushBound) return;
    _unloadFlushBound = true;

    const sendNow = () => flushAnalyticsViaBeacon();
    // `pagehide` is the modern, reliable unload signal (covers mobile Safari).
    // `visibilitychange` -> hidden catches tab switches / app backgrounding on
    // iOS where pagehide may not fire promptly.
    window.addEventListener('pagehide', sendNow);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') sendNow();
    });
}

async function flushAnalyticsViaBeacon() {
    if (!authActiveUser || analyticsQueue.length === 0) return;

    const events = [...analyticsQueue];
    // Capture pending SR state for this final send.
    const srPayload = srPendingState;
    const incrementSession = srIncrementSession;

    const body = { studentId: authActiveUser.id, events };
    if (srPayload)        body.srState          = srPayload;
    if (incrementSession) body.incrementSession = true;

    const token = getSessionToken();
    const appKey = await getAppKey();

    // sendBeacon (and fetch keepalive) cannot set custom headers, so the auth
    // token + app key must travel in the request BODY, not headers. We keep the
    // query-param copy below for backward-compat, BUT Azure SWA's
    // managed-functions proxy does NOT populate request.query on POST — so the
    // query fallback 401s while the body is delivered reliably (exactly like the
    // X-Auth-Token header path). Ship the token in the body so the unload flush
    // authenticates even when the session is enforced.
    if (token)  body.authToken = token;
    if (appKey) body.appKey   = appKey;

    const payload = JSON.stringify(body);

    // (Legacy) query-param copy — ignored by SWA on POST, harmless elsewhere.
    const qs = new URLSearchParams();
    if (token)  qs.set('authToken', token);
    if (appKey) qs.set('appKey', appKey);

    const url = `${API_BASE}/saveAnalytics?${qs.toString()}`;
    let sent = false;
    try {
        if (navigator.sendBeacon) {
            // text/plain is the only content type sendBeacon reliably delivers.
            const blob = new Blob([payload], { type: 'text/plain;charset=UTF-8' });
            sent = navigator.sendBeacon(url, blob);
        }
    } catch { sent = false; }

    // Fallback for browsers without sendBeacon: keepalive fetch is accepted by
    // the browser even during unload.
    if (!sent && typeof fetch === 'function') {
        try {
            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload,
                keepalive: true
            });
            sent = true;
        } catch { sent = false; }
    }

    // NOTE: we deliberately do NOT clear the queue here. `sendBeacon` returns
    // true the moment the browser accepts the payload for *buffering* — which
    // can happen even when the device is offline (the request is then lost if
    // connectivity never returns before the app is killed). By leaving the
    // queue persisted in localStorage, the next app launch will re-send these
    // same events; the server's eventId de-dup makes that re-send idempotent,
    // so we never double-count even on a successful beacon + retry. This trades
    // a little redundant traffic for guaranteed delivery.
    if (sent) {
        persistAnalyticsQueue(); // no-op if empty; ensures on-disk state matches
    }
}

async function flushAnalytics(opts = {}) {
    if (!authActiveUser || analyticsQueue.length === 0) return;

    const events = [...analyticsQueue];

    // Capture and clear pending SR update
    const srPayload = srPendingState;
    const incrementSession = srIncrementSession;
    srPendingState = null;
    srIncrementSession = false;

    const body = { studentId: authActiveUser.id, events };
    if (srPayload)       body.srState          = srPayload;
    if (incrementSession) body.incrementSession = true;

    try {
        const response = await apiFetch(`${API_BASE}/saveAnalytics`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        // FIX #1: a non-2xx (e.g. 401 from an expired/invalid session token)
        // resolves fine as fetch never throws. Treat it as a hard failure so we
        // re-queue instead of silently dropping the student's data.
        if (!response.ok) {
            // FIX #4: if the server rejected our session token, try ONE silent
            // re-login with the cached credentials, then retry the flush once.
            // If that also fails, re-queue and surface a recoverable error.
            if (response.status === 401 && !opts._retried) {
                const relogged = await trySilentRelogin();
                if (relogged) {
                    // Restore pending SR state for the retry, then re-flush.
                    if (srPayload && !srPendingState) srPendingState = srPayload;
                    if (incrementSession) srIncrementSession = true;
                    return await flushAnalytics({ ...opts, _retried: true });
                }
            }
            throw new Error('saveAnalytics responded ' + response.status);
        }

        // Success: these events are now safely persisted server-side.
        // Remove only the events we just sent from the persisted queue (they may
        // have been joined by newer events during the await above).
        const sentSet = new Set(events);
        analyticsQueue = analyticsQueue.filter(e => !sentSet.has(e));
        persistAnalyticsQueue();
    } catch (e) {
        console.warn('Failed to flush analytics:', e);
        // Re-queue failed events and restore SR pending state.
        analyticsQueue = events.concat(analyticsQueue);
        if (srPayload && !srPendingState) srPendingState = srPayload;
        if (incrementSession) srIncrementSession = true;
        persistAnalyticsQueue();
    }
}

/**
 * FIX #4: attempt a silent re-login using the cached profile credentials so an
 * expired session token doesn't lose queued analytics. Returns true only when a
 * fresh token was actually obtained and stored. Never blocks the UI or shows an
 * error — on failure the caller falls back to re-queueing.
 */
async function trySilentRelogin() {
    try {
        const savedUsers = JSON.parse(localStorage.getItem('savedUsers') || '[]');
        const me = savedUsers.find(u => authActiveUser && u.id === authActiveUser.id);
        if (!me || !me.login || !me.password) return false;

        const response = await apiFetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: me.login, password: me.password })
        });
        if (!response.ok) return false;
        const data = await response.json();
        if (!data || !data.token) return false;

        setSessionToken(data.token);
        // Update the in-memory user with anything the fresh login returned.
        authActiveUser.login = me.login;
        authActiveUser.password = me.password;
        if (data.fullName) authActiveUser.fullName = data.fullName;
        return true;
    } catch {
        return false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initAuth();
});

function initAuth() {
    // Only run on pages that have the student UI (not teacher_dashboard.html)
    if (!document.getElementById('startScreen')) return;

    // Check for test mode (teacher testing student content)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('testMode') === 'true') {
        isTestMode = true;
        const studentName = urlParams.get('studentName') || 'Test Student';
        const studentAvatar = urlParams.get('studentAvatar') || '👤';
        const studentBook = urlParams.get('studentBook') || '';
        const studentUnit = urlParams.get('studentUnit') || '';
        const studentPage = urlParams.get('studentPage') || '';
        const studentClassTime = urlParams.get('studentClassTime') || '';

        authActiveUser = {
            id: 'test-mode',
            name: studentName,
            avatar: studentAvatar,
            role: 'student',
            classTime: studentClassTime,
            book: studentBook,
            unit: studentUnit,
            page: studentPage
        };

        // Hide start screen and go directly to greeting
        document.getElementById('startScreen').classList.add('hidden');
        selectedStudent = studentName;
        if (studentBook && studentUnit && studentPage) {
            loadContent();
        } else if (studentClassTime) {
            resolveContentFromClassTime(studentClassTime, studentName);
        }

        document.getElementById('startScreen').classList.remove('hidden');
        ['step-day', 'step-time', 'step-student', 'step-book', 'step-unit'].forEach(id => {
            document.getElementById(id).classList.add('hidden');
        });
        document.getElementById('step-greeting').classList.remove('hidden');
        document.getElementById('greeting-text').innerText = `Hello, ${studentName}!`;
        document.getElementById('greeting-avatar').innerText = studentAvatar || '👤';
        return;
    }

    // Hide start screen if it is visible
    document.getElementById('startScreen').classList.add('hidden');
    
    const savedUsers = JSON.parse(localStorage.getItem('savedUsers') || '[]');
    if (savedUsers.length > 0) {
        showProfileSelection(savedUsers);
    } else {
        showLoginScreen(true); // true means no cancel button since no profiles exist
    }
}

function hideAllAuthScreens() {
    document.getElementById('profileSelectionOverlay').classList.add('hidden');
    document.getElementById('loginOverlay').classList.add('hidden');
    document.getElementById('changePasswordOverlay').classList.add('hidden');
    document.getElementById('avatarSelectionOverlay').classList.add('hidden');
}

function showProfileSelection(users) {
    hideAllAuthScreens();
    const overlay = document.getElementById('profileSelectionOverlay');
    overlay.classList.remove('hidden');
    
    const container = document.getElementById('profile-list');
    container.innerHTML = '';
    
    users.forEach(user => {
        const btn = document.createElement('div');
        btn.className = 'profile-btn flex flex-col items-center gap-2 cursor-pointer transform hover:scale-110 transition-transform';
        btn.onclick = () => loginWithProfile(user, btn);
        
        const img = document.createElement('div');
        img.className = 'w-24 h-24 sm:w-32 sm:h-32 rounded-md flex items-center justify-center text-5xl bg-[#333] border-4 border-transparent hover:border-white transition-all shadow-lg';
        img.innerText = user.avatar || '👤';
        
        const name = document.createElement('span');
        name.className = 'text-gray-300 font-bold text-lg mt-2';
        name.innerText = user.name;
        
        btn.appendChild(img);
        btn.appendChild(name);
        container.appendChild(btn);
    });
    
    // Add "添加新用户" button
    const addBtn = document.createElement('div');
    addBtn.className = 'profile-btn flex flex-col items-center gap-2 cursor-pointer transform hover:scale-110 transition-transform';
    addBtn.onclick = () => showLoginScreen(false);
    
    const addImg = document.createElement('div');
    addImg.className = 'w-24 h-24 sm:w-32 sm:h-32 rounded-md border-4 border-gray-600 flex items-center justify-center text-5xl text-gray-500 hover:text-white hover:border-white bg-transparent transition-all shadow-lg';
    addImg.innerHTML = '+';
    
    const addText = document.createElement('span');
    addText.className = 'text-gray-300 font-bold text-lg mt-2';
    addText.innerText = '添加新用户';
    
    addBtn.appendChild(addImg);
    addBtn.appendChild(addText);
    container.appendChild(addBtn);
}

async function loginWithProfile(user, clickedBtn) {
    // Prevent double-clicks while a login is already in progress
    if (window.authLoading) return;
    window.authLoading = true;

    // --- Visual feedback: dim all profiles, show spinner on the clicked one ---
    const allProfileBtns = document.querySelectorAll('#profile-list .profile-btn');
    const originalAvatar = clickedBtn ? clickedBtn.querySelector('div')?.innerText : null;
    const originalName = clickedBtn ? clickedBtn.querySelector('span')?.innerText : null;
    allProfileBtns.forEach(b => {
        if (b !== clickedBtn) {
            b.style.opacity = '0.35';
            b.style.pointerEvents = 'none';
        }
    });
    if (clickedBtn) {
        clickedBtn.style.pointerEvents = 'none';
        const avatarDiv = clickedBtn.querySelector('div');
        const nameSpan = clickedBtn.querySelector('span');
        if (avatarDiv) avatarDiv.innerHTML = '<i class="fas fa-circle-notch fa-spin text-white"></i>';
        if (nameSpan) nameSpan.innerText = '登录中...';
    }

    // Helper to restore the profile list UI (used on failure / fallback)
    function restoreProfileUI() {
        allProfileBtns.forEach(b => {
            b.style.opacity = '';
            b.style.pointerEvents = '';
        });
        if (clickedBtn) {
            const avatarDiv = clickedBtn.querySelector('div');
            const nameSpan = clickedBtn.querySelector('span');
            if (avatarDiv) avatarDiv.innerText = originalAvatar || '👤';
            if (nameSpan) nameSpan.innerText = originalName || '';
        }
        window.authLoading = false;
    }

    // Refresh user data from API to ensure we have the latest DB fields (like book/unit/page)
    try {
        const response = await apiFetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: user.id, login: user.login, password: user.password })
        });
        if (response.ok) {
            const data = await response.json();
            setSessionToken(data.token); // (c) persist session token
            if (data.needsPasswordChange) {
                // Edge case: admin reset password while user was logged out
                authActiveUser = {
                    id: data.id,
                    login: user.login,
                    name: data.fullName,
                    avatar: data.avatar,
                    role: data.role,
                    classTime: data.classTime,
                    book: data.book,
                    unit: data.unit,
                    page: data.page,
                    password: user.password,
                    analytics: data.analytics || [],
                    teacher: data.teacher || null
                };
                window.authLoading = false;
                showChangePasswordScreen(data.fullName);
                return;
            }
            authActiveUser = {
                id: data.id,
                login: user.login,
                name: data.fullName,
                avatar: data.avatar,
                role: data.role,
                classTime: data.classTime,
                book: data.book,
                unit: data.unit,
                page: data.page,
                password: user.password,
                srState: data.srState || { vocab: {}, sentences: {}, sentencePairs: {} },
                sessionCount: data.sessionCount || 0,
                targets: data.targets || [],
                analytics: data.analytics || [],
                teacher: data.teacher || null
            };
            
            // Update the local cache with the fresh data
            let savedUsers = JSON.parse(localStorage.getItem('savedUsers') || '[]');
            savedUsers = savedUsers.filter(u => u.id !== authActiveUser.id);
            savedUsers.unshift(authActiveUser);
            localStorage.setItem('savedUsers', JSON.stringify(savedUsers));
            localStorage.setItem('activeUserId', authActiveUser.id);
            
            window.authLoading = false;
            finishLogin();
            return;
        }
    } catch(e) {
        console.warn("Failed to refresh profile from server, falling back to local cache", e);
    }

    // Fallback to cached user if offline or server error
    authActiveUser = user;
    window.authLoading = false;
    finishLogin();
}

function showLoginScreen(isFirstTime = false) {
    hideAllAuthScreens();
    document.getElementById('loginOverlay').classList.remove('hidden');
    document.getElementById('login-error').classList.add('hidden');
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    
    const cancelBtn = document.getElementById('login-cancel-btn');
    if (isFirstTime) {
        cancelBtn.classList.add('hidden');
    } else {
        cancelBtn.classList.remove('hidden');
    }
}

function cancelLogin() {
    const savedUsers = JSON.parse(localStorage.getItem('savedUsers') || '[]');
    if (savedUsers.length > 0) {
        showProfileSelection(savedUsers);
    }
}

async function handleLoginSubmit() {
    // Prevent double-clicks while a login is already in progress
    if (window.authLoading) return;

    const loginVal = document.getElementById('login-username').value.trim();
    const passVal = document.getElementById('login-password').value.trim();
    const errorDiv = document.getElementById('login-error');
    const submitBtn = document.querySelector('#loginOverlay .game-btn.bg-red-600');
    const cancelBtn = document.getElementById('login-cancel-btn');
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    
    if (!loginVal || !passVal) {
        errorDiv.innerText = "请输入用户名和密码。";
        errorDiv.classList.remove('hidden');
        return;
    }

    // --- Visual feedback: disable form, show spinner on button ---
    window.authLoading = true;
    errorDiv.classList.add('hidden');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '登录中... <i class="fas fa-circle-notch fa-spin ml-2"></i>';
        submitBtn.classList.add('opacity-70', 'cursor-not-allowed');
    }
    if (usernameInput) usernameInput.disabled = true;
    if (passwordInput) passwordInput.disabled = true;
    if (cancelBtn) cancelBtn.classList.add('hidden');

    // Helper to restore the login form UI (used on failure)
    function restoreLoginUI() {
        window.authLoading = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '登录';
            submitBtn.classList.remove('opacity-70', 'cursor-not-allowed');
        }
        if (usernameInput) usernameInput.disabled = false;
        if (passwordInput) passwordInput.disabled = false;
        // Only re-show cancel if there are saved profiles
        const hasSaved = JSON.parse(localStorage.getItem('savedUsers') || '[]').length > 0;
        if (cancelBtn && hasSaved) cancelBtn.classList.remove('hidden');
    }
    
    try {
        const response = await apiFetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: loginVal, password: passVal })
        });
        
        if (!response.ok) {
            const errText = await response.text();
            errorDiv.innerText = errText || "登录失败。";
            errorDiv.classList.remove('hidden');
            restoreLoginUI();
            return;
        }
        
        const data = await response.json();
        setSessionToken(data.token); // (c) persist session token
        authActiveUser = {
            id: data.id,
            login: loginVal,
            name: data.fullName,
            avatar: data.avatar,
            role: data.role,
            classTime: data.classTime,
            book: data.book,
            unit: data.unit,
            page: data.page,
            password: passVal,
            srState: data.srState || { vocab: {}, sentences: {}, sentencePairs: {} },
            sessionCount: data.sessionCount || 0,
            targets: data.targets || [],
            analytics: data.analytics || [],
            teacher: data.teacher || null
        };
        
        window.authLoading = false;
        if (data.needsPasswordChange) {
            showChangePasswordScreen(data.fullName);
        } else if (!data.avatar) {
            showAvatarSelectionScreen();
        } else {
            saveUserToLocalAndStart(authActiveUser);
        }
    } catch (e) {
        errorDiv.innerText = "连接服务器出错。";
        errorDiv.classList.remove('hidden');
        restoreLoginUI();
    }
}

function showChangePasswordScreen(name) {
    hideAllAuthScreens();
    document.getElementById('changePasswordOverlay').classList.remove('hidden');
    document.getElementById('change-pw-greeting').innerText = `你好，${name}`;
    document.getElementById('change-pw-error').classList.add('hidden');
    document.getElementById('new-password').value = '';
}

async function handleChangePasswordSubmit() {
    const newPass = document.getElementById('new-password').value.trim();
    const errorDiv = document.getElementById('change-pw-error');
    
    if (!newPass) {
        errorDiv.innerText = "请输入新密码。";
        errorDiv.classList.remove('hidden');
        return;
    }
    
    try {
        const response = await apiFetch(`${API_BASE}/changePassword`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: authActiveUser.id, newPassword: newPass })
        });
        
        if (!response.ok) {
            errorDiv.innerText = "修改密码失败。";
            errorDiv.classList.remove('hidden');
            return;
        }
        
        showAvatarSelectionScreen();
    } catch (e) {
        errorDiv.innerText = "连接服务器出错。";
        errorDiv.classList.remove('hidden');
    }
}

function showAvatarSelectionScreen() {
    hideAllAuthScreens();
    document.getElementById('avatarSelectionOverlay').classList.remove('hidden');
    document.getElementById('avatar-error').classList.add('hidden');
}

async function selectAvatar(avatarEmoji) {
    const errorDiv = document.getElementById('avatar-error');
    
    try {
        const response = await apiFetch(`${API_BASE}/updateAvatar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: authActiveUser.id, avatar: avatarEmoji })
        });
        
        if (!response.ok) {
            errorDiv.innerText = "更新头像失败。";
            errorDiv.classList.remove('hidden');
            return;
        }
        
        authActiveUser.avatar = avatarEmoji;
        saveUserToLocalAndStart(authActiveUser);
    } catch (e) {
        errorDiv.innerText = "连接服务器出错。";
        errorDiv.classList.remove('hidden');
    }
}

function saveUserToLocalAndStart(user) {
    let savedUsers = JSON.parse(localStorage.getItem('savedUsers') || '[]');
    // Remove if exists
    savedUsers = savedUsers.filter(u => u.id !== user.id);
    // Add to front
    savedUsers.unshift(user);
    localStorage.setItem('savedUsers', JSON.stringify(savedUsers));
    localStorage.setItem('activeUserId', user.id);
    
    finishLogin();
}

/**
 * Updates the currently active user in the local storage cache
 */
function saveActiveUserToCache() {
    if (!authActiveUser) return;
    let savedUsers = JSON.parse(localStorage.getItem('savedUsers') || '[]');
    savedUsers = savedUsers.filter(u => u.id !== authActiveUser.id);
    savedUsers.unshift(authActiveUser);
    localStorage.setItem('savedUsers', JSON.stringify(savedUsers));
}

function finishLogin() {
    hideAllAuthScreens();

    // Redirect teachers and admins to the dashboard
    if (authActiveUser && (authActiveUser.role === 'BM' || authActiveUser.role === 'admin')) {
        window.location.href = 'teacher_dashboard.html';
        return;
    }

    // FIX #2: arm the pagehide/visibilitychange flush now that a student is
    // logged in, so a tab-close / app-background right after game-over still
    // ships the queued analytics.
    bindUnloadAnalyticsFlush();

    // FIX #3: flush any events carried over in localStorage from a previous
    // session that was killed/closed before it could deliver them.
    if (analyticsQueue.length > 0) scheduleAnalyticsFlush();

    // Auto-resolve the student's class content
    if (authActiveUser) {
        selectedStudent = authActiveUser.fullName || authActiveUser.name;
        if (authActiveUser.book && authActiveUser.unit && authActiveUser.page) {
            // Priority: Directly use content assigned from DB
            checkAndAdvancePageIfAllOnCooldown();
            loadContent();
        } else if (authActiveUser.classTime) {
            // Fallback: Resolve via classTime mapping
            resolveContentFromClassTime(authActiveUser.classTime, authActiveUser.name);
        }
    }

    // Show the start screen but skip directly to the greeting step
    document.getElementById('startScreen').classList.remove('hidden');

    // Hide all wizard steps
    ['step-day', 'step-time', 'step-student', 'step-book', 'step-unit'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });

    // Show greeting directly
    document.getElementById('step-greeting').classList.remove('hidden');
    document.getElementById('greeting-text').innerText = `Hello, ${authActiveUser.name}!`;
    document.getElementById('greeting-avatar').innerText = authActiveUser.avatar || '👤';

    // Handle target banner
    const targetBanner = document.getElementById('greeting-target-banner');
    const targetText = getActiveTargetText();
    if (targetText) {
        targetBanner.innerText = targetText;
        targetBanner.classList.remove('hidden');
    } else {
        targetBanner.classList.add('hidden');
    }
}

/**
 * Maps a classTime string like "Sat 14:50" to the correct CLASS_CONFIG entry
 * and calls loadContent() so the games have the right vocab/sentences.
 */
function resolveContentFromClassTime(classTime, studentName) {
    const dayMap = {
        'Mon': '周一', 'Tue': '周二', 'Wed': '周三',
        'Thu': '周四', 'Fri': '周五', 'Sat': '周六', 'Sun': '周日'
    };

    // classTime format: "Sat 14:50" or "Mon/Thu 19:50"
    const parts = classTime.split(' ');
    if (parts.length < 2) return;

    const timeStr = parts[1]; // e.g. "14:50"
    const dayKeys = parts[0].split('/'); // e.g. ["Mon", "Thu"] or ["Sat"]

    // Try each day abbreviation until we find a matching config entry
    for (const dayAbbr of dayKeys) {
        const dayZh = dayMap[dayAbbr];
        if (!dayZh || !CLASS_CONFIG[dayZh]) continue;

        const daySlots = CLASS_CONFIG[dayZh];
        // Find the slot whose start time matches (e.g. "1450" matches "14:50")
        for (const slotKey of Object.keys(daySlots)) {
            const slotStart = slotKey.substring(0, 4); // e.g. "1450"
            const csvTime = timeStr.replace(':', '');   // e.g. "1450"
            if (slotStart === csvTime) {
                // Found the matching slot — set the wizard state variables
                selectedDay = dayZh;
                selectedTime = slotKey;
                selectedStudent = studentName;
                loadContent();
                return;
            }
        }
    }
    console.warn('Could not auto-resolve classTime:', classTime);
}

function goBackToProfiles() {
    // Hide start screen and go back to profile selection
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('step-greeting').classList.add('hidden');
    authActiveUser = null;
    setSessionToken(null); // (c) clear session token on logout
    const savedUsers = JSON.parse(localStorage.getItem('savedUsers') || '[]');
    if (savedUsers.length > 0) {
        showProfileSelection(savedUsers);
    } else {
        showLoginScreen(true);
    }
}

/**
 * Picks the target a student should see, mirroring teacher_dashboard.js
 * getStudentTargetInfo: active first, then most-recent past, then nearest
 * upcoming. This guarantees the student's meter never silently disappears
 * (e.g. Lucas's window had ended on his device, so the old active-only check
 * returned null while the dashboard still showed 14/70).
 * Returns { target, completed, status } or null.
 */
function selectStudentTarget(student) {
    if (!student || !student.targets || student.targets.length === 0) return null;
    const now = new Date();

    // 1. Active target (now within range)
    for (const t of student.targets) {
        const start = new Date(t.startTime);
        const end = new Date(t.endTime);
        if (now >= start && now <= end) {
            return {
                target: t,
                completed: countCompletedSessionsForTarget(student, t.startTime, t.endTime),
                status: 'active'
            };
        }
    }

    // 2. Most recent past target
    const past = student.targets
        .filter(t => new Date(t.endTime) < now)
        .sort((a, b) => new Date(b.endTime) - new Date(a.endTime));
    if (past.length > 0) {
        const t = past[0];
        return {
            target: t,
            completed: countCompletedSessionsForTarget(student, t.startTime, t.endTime),
            status: 'past'
        };
    }

    // 3. Nearest upcoming target
    const upcoming = student.targets
        .filter(t => new Date(t.startTime) > now)
        .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    if (upcoming.length > 0) {
        return { target: upcoming[0], completed: 0, status: 'upcoming' };
    }

    return null;
}

/**
 * Returns a formatted string for the greeting-screen meter, or null.
 * Now mirrors the teacher dashboard: shows active, most-recent-past, or
 * nearest-upcoming target so the student's meter always matches what the
 * teacher sees.
 */
function getActiveTargetText(studentOverride) {
    const student = studentOverride || authActiveUser;
    const sel = selectStudentTarget(student);
    if (!sel) return null;

    const { target, completed, status } = sel;

    // Format dates for display (e.g., 2026/05/14)
    const startStr = new Date(target.startTime).toLocaleString('en-GB', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });
    const endStr = new Date(target.endTime).toLocaleString('en-GB', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });

    const prefix = status === 'active' ? '打卡记录'
                 : status === 'past'   ? '上阶段'
                 : '未开始';

    return `${startStr} - ${endStr} ${prefix}: ${completed}/${target.targetSessions}`;
}

/**
 * Counts completed sessions in a time range for a student. MUST match the
 * teacher dashboard's countTargetSessions (teacher_dashboard.js) exactly: it
 * counts every `session` event in the window, including short (<60s) sessions
 * that the game flags `ignored`. Dropping them here made the app undercount
 * vs the dashboard (Test1: app 32/40 vs dashboard 37/40).
 */
function countCompletedSessionsForTarget(student, startTimeStr, endTimeStr) {
    if (!student.analytics || !Array.isArray(student.analytics)) return 0;
    const start = new Date(startTimeStr).getTime();
    const end = new Date(endTimeStr).getTime();

    return student.analytics.filter(e => {
        if (e.type !== 'session') return false;
        // NOTE: deliberately NOT filtering e.data.ignored — the dashboard counts
        // those too, so the student meter stays consistent with the teacher view.
        const ts = new Date(e.timestamp).getTime();
        return ts >= start && ts <= end;
    }).length;
}

/**
 * Checks if the user's content is entirely on SR cooldown and advances their assigned page if so.
 */
function checkAndAdvancePageIfAllOnCooldown() {
    if (!authActiveUser || !authActiveUser.srState) return false;
    
    if (!authActiveUser.book || !authActiveUser.unit || !authActiveUser.page) return false;

    let book = authActiveUser.book;
    let unit = authActiveUser.unit.toString();
    let page = authActiveUser.page.toString();
    
    let advanced = false;
    const currentSession = getCurrentSession();

    while (true) {
        const sortedPages = getSortedPagesForBook(book);
        const activePageIndex = sortedPages.findIndex(
            p => p.book === book && p.unit === unit && p.page === page
        );
        
        if (activePageIndex === -1) break;

        const candidatePages = sortedPages.slice(0, activePageIndex + 1);
        
        const vocabPool = buildItemPool(candidatePages, 'vocab').flatPool;
        const sentencesPool = buildItemPool(candidatePages, 'sentences').flatPool;
        const pairsPool = buildItemPool(candidatePages, 'sentencePairs').flatPool;

        let vocabAllCooldown = false;
        if (vocabPool.length > 0) {
            const vocabSR = authActiveUser.srState.vocab || {};
            vocabAllCooldown = vocabPool.every(e => {
                const priority = getSRPriority(e.key, vocabSR, currentSession, null, null);
                return priority.group === 4;
            });
        }
        
        let sentencesAllCooldown = false;
        if (sentencesPool.length > 0) {
            const sentencesSR = authActiveUser.srState.sentences || {};
            sentencesAllCooldown = sentencesPool.every(e => {
                const priority = getSRPriority(e.key, sentencesSR, currentSession, null, null);
                return priority.group === 4;
            });
        }
        
        let pairsAllCooldown = false;
        if (pairsPool.length > 0) {
            const pairsSR = authActiveUser.srState.sentencePairs || {};
            pairsAllCooldown = pairsPool.every(e => {
                const priority = getSRPriority(e.key, pairsSR, currentSession, null, null);
                return priority.group === 4;
            });
        }
        
        if ((vocabPool.length > 0 && vocabAllCooldown) || 
            (sentencesPool.length > 0 && sentencesAllCooldown) || 
            (pairsPool.length > 0 && pairsAllCooldown)) {
            
            if (activePageIndex + 1 < sortedPages.length) {
                const nextPage = sortedPages[activePageIndex + 1];
                book = nextPage.book;
                unit = nextPage.unit;
                page = nextPage.page;
                advanced = true;
            } else {
                break; // No more pages in this series
            }
        } else {
            break; // Content is available, stay on this page
        }
    }
    
    if (advanced) {
        authActiveUser.book = book;
        authActiveUser.unit = unit;
        authActiveUser.page = page;
        saveActiveUserToCache();
        
        // Fire-and-forget update to backend
        apiFetch(`${API_BASE}/updateStudent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                studentId: authActiveUser.id,
                fields: { book, unit, page }
            })
        }).catch(e => console.warn("Failed to auto-update student page", e));
        
        return true;
    }
    
    return false;
}

