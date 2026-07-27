// ============================================================
// SCHOOL DEFENSE 3D — input.js
// Virtual joystick (dynamic, left zone) + action buttons (touch)
// and WASD / J K L B Q E 1-4 (desktop).
// Emits: sword, bow, special, buildToggle, buildSelect(type), rotate(dir)
// Exposes: move {x,y} normalized screen-space movement intent.
// ============================================================

export class Input {
    constructor() {
        this.move = { x: 0, y: 0 };          // screen space: x=right, y=down
        this.handlers = {};
        this.keys = {};
        this._joyTouchId = null;
        this._joyOrigin = { x: 0, y: 0 };
        this._bindJoystick();
        this._bindButtons();
        this._bindKeyboard();
    }
    on(evt, fn) { (this.handlers[evt] = this.handlers[evt] || []).push(fn); }
    emit(evt, arg) { (this.handlers[evt] || []).forEach(fn => fn(arg)); }

    // ---------------- JOYSTICK ----------------
    _bindJoystick() {
        const zone = document.getElementById('joyZone');
        const base = document.getElementById('joyBase');
        const knob = document.getElementById('joyKnob');
        const R = 55; // max knob travel px

        const start = (x, y, id) => {
            this._joyTouchId = id;
            this._joyOrigin = { x, y };
            base.style.display = 'block';
            knob.style.display = 'block';
            base.style.left = (x - 55) + 'px';
            base.style.top = (y - 55) + 'px';
            knob.style.left = (x - 24) + 'px';
            knob.style.top = (y - 24) + 'px';
        };
        const moveTo = (x, y) => {
            let dx = x - this._joyOrigin.x, dy = y - this._joyOrigin.y;
            const d = Math.hypot(dx, dy);
            if (d > R) { dx = dx / d * R; dy = dy / d * R; }
            knob.style.left = (this._joyOrigin.x + dx - 24) + 'px';
            knob.style.top = (this._joyOrigin.y + dy - 24) + 'px';
            const dead = 0.15;
            const nx = dx / R, ny = dy / R;
            const mag = Math.hypot(nx, ny);
            if (mag < dead) { this.move.x = 0; this.move.y = 0; }
            else { this.move.x = nx; this.move.y = ny; }
        };
        const end = () => {
            this._joyTouchId = null;
            this.move.x = 0; this.move.y = 0;
            base.style.display = 'none';
            knob.style.display = 'none';
        };

        zone.addEventListener('touchstart', e => {
            e.preventDefault();
            const t = e.changedTouches[0];
            start(t.clientX, t.clientY, t.identifier);
        }, { passive: false });
        window.addEventListener('touchmove', e => {
            if (this._joyTouchId === null) return;
            for (const t of e.changedTouches) {
                if (t.identifier === this._joyTouchId) { moveTo(t.clientX, t.clientY); e.preventDefault(); }
            }
        }, { passive: false });
        window.addEventListener('touchend', e => {
            for (const t of e.changedTouches) {
                if (t.identifier === this._joyTouchId) end();
            }
        });
        window.addEventListener('touchcancel', end);

        // mouse fallback for quick desktop drag testing
        zone.addEventListener('mousedown', e => {
            start(e.clientX, e.clientY, 'mouse');
            const mm = ev => moveTo(ev.clientX, ev.clientY);
            const mu = () => { end(); window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); };
            window.addEventListener('mousemove', mm);
            window.addEventListener('mouseup', mu);
        });
    }

    // ---------------- BUTTONS ----------------
    _bindButtons() {
        const press = (id, evt, arg) => {
            const el = document.getElementById(id);
            if (!el) return;
            const fire = e => { e.preventDefault(); e.stopPropagation(); this.emit(evt, arg); };
            el.addEventListener('touchstart', fire, { passive: false });
            el.addEventListener('mousedown', fire);
        };
        press('btnSword', 'sword');
        press('btnBow', 'bow');
        press('btnSpecial', 'special');
        press('btnBuild', 'buildToggle');
        press('btnRotate', 'rotate', 1);
        document.querySelectorAll('.build-btn').forEach(b => {
            const fire = e => { e.preventDefault(); e.stopPropagation(); this.emit('buildSelect', b.dataset.build); };
            b.addEventListener('touchstart', fire, { passive: false });
            b.addEventListener('mousedown', fire);
        });
    }

    // ---------------- KEYBOARD ----------------
    _bindKeyboard() {
        const buildKeys = { '1': 'wall', '2': 'arrow', '3': 'frost', '4': 'cannon' };
        window.addEventListener('keydown', e => {
            const k = e.key.toLowerCase();
            if (this.keys[k]) return; // ignore auto-repeat
            this.keys[k] = true;
            if (k === 'j') this.emit('sword');
            else if (k === 'k') this.emit('bow');
            else if (k === 'l') this.emit('special');
            else if (k === 'b') this.emit('buildToggle');
            else if (k === 'q') this.emit('rotate', -1);
            else if (k === 'e') this.emit('rotate', 1);
            else if (buildKeys[k]) this.emit('buildSelect', buildKeys[k]);
            this._updateKeyMove();
        });
        window.addEventListener('keyup', e => {
            this.keys[e.key.toLowerCase()] = false;
            this._updateKeyMove();
        });
        window.addEventListener('blur', () => {
            this.keys = {};
            this._updateKeyMove();
        });
    }
    _updateKeyMove() {
        // Only override joystick when no touch is active
        if (this._joyTouchId !== null) return;
        let x = 0, y = 0;
        if (this.keys['a'] || this.keys['arrowleft']) x -= 1;
        if (this.keys['d'] || this.keys['arrowright']) x += 1;
        if (this.keys['w'] || this.keys['arrowup']) y -= 1;
        if (this.keys['s'] || this.keys['arrowdown']) y += 1;
        const m = Math.hypot(x, y);
        if (m > 0) { x /= m; y /= m; }
        this.move.x = x; this.move.y = y;
    }
}
