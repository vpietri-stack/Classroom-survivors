const API_BASE = 'http://localhost:7071/api';
let authActiveUser = null;

// --- ANALYTICS TRACKING ---
let analyticsQueue = [];
let analyticsFlushTimer = null;

// Exercise tracking state
let exerciseStartTime = 0;
let exerciseAttempts = 0;

function startExerciseTracking() {
    exerciseStartTime = Date.now();
    exerciseAttempts = 1; // First attempt counts as 1
}

function incrementExerciseAttempts() {
    exerciseAttempts++;
}

function queueExerciseEvent(exerciseType, mode) {
    if (!authActiveUser) return;
    const durationMs = Date.now() - exerciseStartTime;
    analyticsQueue.push({
        type: 'exercise',
        exerciseType: exerciseType,
        mode: mode,
        attempts: exerciseAttempts,
        durationMs: durationMs,
        timestamp: new Date().toISOString()
    });
    scheduleAnalyticsFlush();
}

function queueSessionEvent(sessionType, data) {
    if (!authActiveUser) return;
    analyticsQueue.push({
        type: 'session',
        sessionType: sessionType,
        data: data,
        timestamp: new Date().toISOString()
    });
    scheduleAnalyticsFlush();
}

function scheduleAnalyticsFlush() {
    if (analyticsFlushTimer) clearTimeout(analyticsFlushTimer);
    analyticsFlushTimer = setTimeout(flushAnalytics, 2000);
}

async function flushAnalytics() {
    if (!authActiveUser || analyticsQueue.length === 0) return;
    const events = [...analyticsQueue];
    analyticsQueue = [];
    try {
        await fetch(`${API_BASE}/saveAnalytics`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId: authActiveUser.id, events })
        });
    } catch (e) {
        console.warn('Failed to flush analytics:', e);
        // Re-queue failed events
        analyticsQueue = events.concat(analyticsQueue);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initAuth();
});

function initAuth() {
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
        btn.onclick = () => loginWithProfile(user);
        
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

function loginWithProfile(user) {
    // In a real app we might verify token, here we just trust localStorage and drop them in
    authActiveUser = user;
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
    const loginVal = document.getElementById('login-username').value.trim();
    const passVal = document.getElementById('login-password').value.trim();
    const errorDiv = document.getElementById('login-error');
    
    if (!loginVal || !passVal) {
        errorDiv.innerText = "Please enter username and password.";
        errorDiv.classList.remove('hidden');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: loginVal, password: passVal })
        });
        
        if (!response.ok) {
            const errText = await response.text();
            errorDiv.innerText = errText || "Login failed.";
            errorDiv.classList.remove('hidden');
            return;
        }
        
        const data = await response.json();
        authActiveUser = {
            id: data.id,
            name: data.fullName,
            avatar: data.avatar,
            role: data.role,
            classTime: data.classTime
        };
        
        if (data.needsPasswordChange) {
            showChangePasswordScreen(data.fullName);
        } else if (!data.avatar) {
            showAvatarSelectionScreen();
        } else {
            saveUserToLocalAndStart(authActiveUser);
        }
    } catch (e) {
        errorDiv.innerText = "Error connecting to server.";
        errorDiv.classList.remove('hidden');
    }
}

function showChangePasswordScreen(name) {
    hideAllAuthScreens();
    document.getElementById('changePasswordOverlay').classList.remove('hidden');
    document.getElementById('change-pw-greeting').innerText = `Hello ${name}`;
    document.getElementById('change-pw-error').classList.add('hidden');
    document.getElementById('new-password').value = '';
}

async function handleChangePasswordSubmit() {
    const newPass = document.getElementById('new-password').value.trim();
    const errorDiv = document.getElementById('change-pw-error');
    
    if (!newPass) {
        errorDiv.innerText = "Please enter a new password.";
        errorDiv.classList.remove('hidden');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/changePassword`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: authActiveUser.id, newPassword: newPass })
        });
        
        if (!response.ok) {
            errorDiv.innerText = "Failed to change password.";
            errorDiv.classList.remove('hidden');
            return;
        }
        
        showAvatarSelectionScreen();
    } catch (e) {
        errorDiv.innerText = "Error connecting to server.";
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
        const response = await fetch(`${API_BASE}/updateAvatar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: authActiveUser.id, avatar: avatarEmoji })
        });
        
        if (!response.ok) {
            errorDiv.innerText = "Failed to update avatar.";
            errorDiv.classList.remove('hidden');
            return;
        }
        
        authActiveUser.avatar = avatarEmoji;
        saveUserToLocalAndStart(authActiveUser);
    } catch (e) {
        errorDiv.innerText = "Error connecting to server.";
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
    
    finishLogin();
}

function finishLogin() {
    hideAllAuthScreens();

    // Auto-resolve the student's class content from their classTime
    if (authActiveUser && authActiveUser.classTime) {
        resolveContentFromClassTime(authActiveUser.classTime, authActiveUser.name);
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
    const savedUsers = JSON.parse(localStorage.getItem('savedUsers') || '[]');
    if (savedUsers.length > 0) {
        showProfileSelection(savedUsers);
    } else {
        showLoginScreen(true);
    }
}
