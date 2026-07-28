// ============================================================
// BGM — background music manager (Vampire Survivors / global)
// - WebAudio gapless loop: decodes the MP3 and auto-detects the
//   real musical end (skips encoder padding + trailing silence),
//   so the loop is seamless WITHOUT re-encoding the file.
// - Ducking with stacked reasons (lowest wins):
//     'minigame' : ESL overlay open           -> 25% volume
//     'prompt'   : word/sentence audio playing -> 25% volume
//     'speaking' : student is recording speech -> 6% volume (barely audible)
// - Auto-duck: polls the DOM (minigame overlays + recording
//   indicator) so no game code needs to remember to duck.
// ============================================================
(function (global) {
    const SRC = 'music/study_hall_shuffle.mp3';
    const BASE_VOL = 0.35;
    const DUCK_LEVELS = { minigame: 0.25, prompt: 0.25, speaking: 0.06 };

    let ctx = null, gainNode = null, srcNode = null, buffer = null;
    let playing = false, loading = false;
    const ducks = new Set();

    function ensureCtx() {
        if (!ctx) {
            ctx = new (global.AudioContext || global.webkitAudioContext)();
            gainNode = ctx.createGain();
            gainNode.gain.value = 0;
            gainNode.connect(ctx.destination);
        }
        if (ctx.state === 'suspended') ctx.resume();
    }

    // Find the last audible sample => true musical end. Trims the ~1s of
    // trailing silence so loopEnd lands right where the music stops.
    function findLoopEnd(buf) {
        const thresh = 0.01;
        let last = buf.length - 1;
        outer:
        for (let i = buf.length - 1; i >= 0; i -= 32) { // stride for speed
            for (let c = 0; c < buf.numberOfChannels; c++) {
                if (Math.abs(buf.getChannelData(c)[i]) > thresh) { last = i; break outer; }
            }
        }
        return Math.max(1, last / buf.sampleRate);
    }

    function currentTarget() {
        let mult = 1;
        ducks.forEach(d => { mult = Math.min(mult, DUCK_LEVELS[d] !== undefined ? DUCK_LEVELS[d] : 1); });
        return BASE_VOL * mult;
    }

    function applyVolume(fadeSec) {
        if (!gainNode || !ctx) return;
        const t = ctx.currentTime;
        gainNode.gain.cancelScheduledValues(t);
        gainNode.gain.setValueAtTime(gainNode.gain.value, t);
        gainNode.gain.linearRampToValueAtTime(playing ? currentTarget() : 0, t + (fadeSec || 0.4));
    }

    const BGM = {
        start() {
            try { ensureCtx(); } catch (e) { return; }
            if (playing) { applyVolume(0.5); return; }
            playing = true;
            if (buffer) { BGM._play(); return; }
            if (loading) return;
            loading = true;
            fetch(SRC)
                .then(r => r.arrayBuffer())
                .then(ab => new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej)))
                .then(buf => { buffer = buf; loading = false; if (playing) BGM._play(); })
                .catch(e => { loading = false; console.warn('BGM load failed', e); });
        },
        _play() {
            if (srcNode) { try { srcNode.stop(); } catch (e) { } srcNode = null; }
            srcNode = ctx.createBufferSource();
            srcNode.buffer = buffer;
            srcNode.loop = true;
            srcNode.loopStart = 0;
            srcNode.loopEnd = findLoopEnd(buffer); // gapless: skip trailing silence
            srcNode.connect(gainNode);
            srcNode.start();
            applyVolume(1.2); // gentle fade-in
        },
        stop() {
            playing = false;
            if (!ctx) return;
            applyVolume(0.8); // fade out
            const node = srcNode; srcNode = null;
            if (node) setTimeout(() => { try { node.stop(); } catch (e) { } }, 900);
        },
        duck(reason) { ducks.add(reason); applyVolume(0.25); },
        unduck(reason) { ducks.delete(reason); applyVolume(0.6); },
        isPlaying() { return playing; },
        // introspection for tests/diagnostics
        _debug() {
            return {
                playing, ducks: Array.from(ducks), target: currentTarget(),
                gain: gainNode ? gainNode.gain.value : null,
                duration: buffer ? buffer.duration : null,
                loopEnd: srcNode ? srcNode.loopEnd : null
            };
        }
    };

    // ---- Automatic ducking: watch the DOM, no game-code coupling ----
    const MINIGAME_IDS = ['spellingGame', 'wordRecGame', 'grammarGame', 'sentenceMatchGame'];
    setInterval(() => {
        if (!playing) return;
        const mgOpen = MINIGAME_IDS.some(id => {
            const el = document.getElementById(id);
            return el && !el.classList.contains('hidden');
        });
        if (mgOpen) ducks.add('minigame'); else ducks.delete('minigame');
        // speech recording indicator (speech_ui.js inline element)
        const speaking = !!document.querySelector('.rec-inline.show');
        if (speaking) ducks.add('speaking'); else ducks.delete('speaking');
        applyVolume(0.3);
    }, 300);

    global.BGM = BGM;
})(window);
