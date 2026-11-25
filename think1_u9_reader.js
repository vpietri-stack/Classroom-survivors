(function () {
    'use strict';

    const embedded = parent !== window;
    const local = /^(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(location.hostname);
    if (embedded ? !parent.PreviewNotes?.isReader(window) : !local) {
        location.replace('index.html');
        return;
    }

    const $ = id => document.getElementById(id);
    const slug = new URLSearchParams(location.search).get('page');
    const pages = new Set(['wild', 'extreme', 'dialogue', 'community', 'pole', 'email']);
    const root = 'think1_u9_reader_assets/';
    const cache = (embedded ? parent.AssetCache : null) || window.AssetCache;
    const viewport = $('viewport');
    const scan = $('scan');
    const player = $('player');
    const caption = $('nowPlaying');
    const translation = $('translation');
    const wordButtons = $('wordButtons');
    const partButtons = $('partButtons');
    const audio = new Audio();
    audio.preservesPitch = true;
    const clips = new Map();
    const loading = new Map();
    const regions = new Map();
    const wordPattern = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu;
    const gradeClasses = ['notes-heard', 'notes-grade-yellow', 'notes-grade-red'];
    let selected, activeTerm, activeCue, activePart, clipUrl;
    let ticket = 0, authorizedPlayback = false, wordPlayback = false;

    async function asset(name) {
        const path = root + name;
        return await cache?.getBlobUrl(path, { race: true }) || path;
    }

    async function read(name) {
        const response = await fetch(await asset(name));
        if (!response.ok) throw new Error('Reader asset unavailable');
        return response;
    }

    function loadPack(name) {
        if (loading.has(name)) return loading.get(name);
        const result = read(name).then(response => response.arrayBuffer()).then(bytes => {
            clips.set(name, bytes);
            return bytes;
        }).finally(() => loading.delete(name));
        loading.set(name, result);
        return result;
    }

    function stopAudio() {
        ticket++;
        audio.pause();
        if (clipUrl) {
            audio.removeAttribute('src');
            URL.revokeObjectURL(clipUrl);
            clipUrl = undefined;
        }
    }

    function primeAudio() {
        if (authorizedPlayback) return;
        // Preserve a user-initiated playback session while the first pack is fetched.
        const sampleCount = 400;
        const wav = new ArrayBuffer(44 + sampleCount * 2);
        const data = new DataView(wav);
        for (const [offset, text] of [[0, 'RIFF'], [8, 'WAVEfmt '], [36, 'data']]) {
            [...text].forEach((letter, i) => data.setUint8(offset + i, letter.charCodeAt(0)));
        }
        data.setUint32(4, wav.byteLength - 8, true);
        data.setUint32(16, 16, true);
        data.setUint16(20, 1, true);
        data.setUint16(22, 1, true);
        data.setUint32(24, 8000, true);
        data.setUint32(28, 16000, true);
        data.setUint16(32, 2, true);
        data.setUint16(34, 16, true);
        data.setUint32(40, sampleCount * 2, true);
        clipUrl = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
        audio.src = clipUrl;
        audio.play().then(() => { authorizedPlayback = true; }).catch(() => {});
    }

    async function play([pack, offset, length], word = false) {
        stopAudio();
        const request = ticket;
        const status = $('audioStatus');
        status.textContent = '';
        try {
            let bytes = clips.get(pack);
            if (!bytes) {
                primeAudio();
                status.textContent = '正在加载音频…';
                bytes = await loadPack(pack);
                if (request !== ticket) return;
                if (clipUrl) URL.revokeObjectURL(clipUrl);
            }
            clipUrl = URL.createObjectURL(new Blob([bytes.slice(offset, offset + length)], { type: 'audio/mpeg' }));
            audio.src = clipUrl;
            wordPlayback = word;
            audio.playbackRate = word ? 1 : Number($('speed').value);
            await audio.play();
            if (request === ticket) {
                authorizedPlayback = true;
                status.textContent = '';
            }
        } catch (_) {
            if (request === ticket) status.textContent = '音频暂时无法播放，请再次点击。';
        }
    }

    function renderMeaning(ranges = []) {
        let startAt = 0;
        const fragment = document.createDocumentFragment();
        for (const [from, to] of ranges) {
            const highlight = document.createElement('mark');
            highlight.textContent = selected.zh.slice(from, to);
            fragment.append(selected.zh.slice(startAt, from), highlight);
            startAt = to;
        }
        fragment.append(selected.zh.slice(startAt));
        translation.replaceChildren(fragment);
    }

    function selectPart(part) {
        if (part !== activePart) renderFeedback();
        activePart = part;
        for (const span of caption.children) {
            const start = Number(span.dataset.start);
            span.classList.toggle('in-part', !!part && start >= part[0] && start < part[1]);
        }
        for (const button of partButtons.children) {
            button.setAttribute('aria-pressed', String(selected.parts[Number(button.dataset.index)] === part));
        }
        const text = part ? selected.en.slice(part[0], part[1]).trim() : selected.en;
        const id = part ? selected.id + ':' + part[0] : selected.id;
        window.dispatchEvent(new CustomEvent('notes-select', { detail: { id, text } }));
    }

    function sayTerm(term, control) {
        activeTerm?.setAttribute('aria-pressed', 'false');
        activeTerm = control;
        control.setAttribute('aria-pressed', 'true');
        window.dispatchEvent(new Event('notes-playback'));
        renderMeaning(term.ranges);
        play(term.audio, true);
    }

    function openTerm(term, control) {
        wordButtons.replaceChildren();
        wordButtons.hidden = term.words.length < 2;
        if (!wordButtons.hidden) {
            for (const word of term.words) {
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = word.text;
                button.setAttribute('aria-pressed', 'false');
                button.onclick = () => sayTerm(word, button);
                wordButtons.append(button);
            }
        }
        sayTerm(term, control);
    }

    function appendCaptionWords(container, from, to) {
        const text = selected.en.slice(from, to);
        let offset = 0;
        for (const match of text.matchAll(wordPattern)) {
            const span = document.createElement('span');
            span.dataset.wordStart = from + match.index;
            span.textContent = match[0];
            container.append(text.slice(offset, match.index), span);
            offset = match.index + match[0].length;
        }
        container.append(text.slice(offset));
    }

    function renderFeedback(words) {
        let index = 0;
        for (const span of caption.querySelectorAll('[data-word-start]')) {
            span.classList.remove(...gradeClasses);
            span.removeAttribute('title');
            const start = Number(span.dataset.wordStart);
            if (activePart && (start < activePart[0] || start >= activePart[1])) continue;
            const word = words?.[index++];
            if (word?.grade === 'yellow' || word?.grade === 'red') {
                span.classList.add('notes-grade-' + word.grade);
                if (word.tip) span.title = word.tip;
            } else if (word?.heardClear || word?.grade === 'green') {
                span.classList.add('notes-heard');
            }
        }
        return true;
    }

    window.InteractiveNotesPOC = { pause: stopAudio, renderFeedback };

    function renderCaption() {
        const fragment = document.createDocumentFragment();
        let at = 0;
        for (const term of selected.terms) {
            const span = document.createElement('span');
            span.className = 'term';
            span.role = 'button';
            span.tabIndex = 0;
            span.dataset.start = term.start;
            span.setAttribute('aria-pressed', 'false');
            appendCaptionWords(span, term.start, term.end);
            span.onclick = () => openTerm(term, span);
            span.onkeydown = event => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                openTerm(term, span);
            };
            appendCaptionWords(fragment, at, term.start);
            fragment.append(span);
            at = term.end;
        }
        appendCaptionWords(fragment, at, selected.en.length);
        caption.replaceChildren(fragment);
    }

    function renderParts() {
        partButtons.replaceChildren();
        $('parts').hidden = selected.parts.length < 2;
        selected.parts.forEach((part, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = '▶ ' + (index + 1);
            button.dataset.index = index;
            const text = selected.en.slice(part[0], part[1]).trim();
            button.title = text;
            button.setAttribute('aria-label', '播放第 ' + (index + 1) + ' 段 ' + text);
            button.setAttribute('aria-pressed', 'false');
            button.onclick = () => {
                selectPart(part);
                play(part[2]);
            };
            partButtons.append(button);
        });
    }

    function setCueActive(cue, active) {
        for (const button of regions.get(cue) || []) {
            button.classList.toggle('selected', active);
            button.setAttribute('aria-pressed', String(active));
        }
    }

    function selectCue(cue, trigger) {
        setCueActive(selected, false);
        selected = cue;
        activeCue = trigger;
        activeTerm = undefined;
        setCueActive(cue, true);
        wordButtons.hidden = true;
        wordButtons.replaceChildren();
        renderCaption();
        renderMeaning();
        renderParts();
        selectPart();
        player.hidden = false;
        player.scrollTop = 0;
        const top = trigger.getBoundingClientRect();
        const bounds = viewport.getBoundingClientRect();
        if (top.bottom > bounds.bottom) viewport.scrollTop += top.bottom - bounds.bottom + 10;
        play(cue.audio);
    }

    function addHotspots(lesson) {
        const fragment = document.createDocumentFragment();
        for (const cue of lesson.cues) {
            const buttons = cue.rects.map(([x, y, width, height], index) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'hotspot';
                Object.assign(button.style, { left: x * 100 + '%', top: y * 100 + '%',
                    width: width * 100 + '%', height: height * 100 + '%' });
                button.setAttribute('aria-label', cue.en);
                button.setAttribute('aria-pressed', 'false');
                if (index) {
                    button.tabIndex = -1;
                    button.setAttribute('aria-hidden', 'true');
                }
                button.onclick = () => selectCue(cue, button);
                fragment.append(button);
                return button;
            });
            regions.set(cue, buttons);
        }
        $('hotspots').append(fragment);
    }

    function zoom(fit) {
        const oldWidth = scan.clientWidth;
        const oldCentre = viewport.scrollLeft + viewport.clientWidth / 2;
        scan.classList.toggle('fit', fit);
        $('fit').setAttribute('aria-pressed', String(fit));
        $('fit').textContent = fit ? '恢复阅读大小' : '适合屏幕';
        if (oldWidth) viewport.scrollLeft = oldCentre / oldWidth * scan.clientWidth - viewport.clientWidth / 2;
    }

    $('fit').onclick = () => zoom(!scan.classList.contains('fit'));
    $('stop').onclick = () => {
        stopAudio();
        $('audioStatus').textContent = '';
    };
    $('replay').onclick = () => {
        if (!selected) return;
        selectPart();
        play(selected.audio);
    };
    $('speed').onchange = () => { if (!wordPlayback) audio.playbackRate = Number($('speed').value); };
    $('closePlayer').onclick = () => {
        stopAudio();
        window.NotesSpeech?.dispose();
        setCueActive(selected, false);
        player.hidden = true;
        activeCue?.focus({ preventScroll: true });
    };
    window.addEventListener('pagehide', stopAudio);

    async function open() {
        if (!pages.has(slug)) throw new Error('Unknown reader page');
        const lesson = await (await read(slug + '.json')).json();
        $('pageLabel').textContent = lesson.book + ' · 点读课文，可横向滑动';
        document.title = 'Think 1 · ' + lesson.title;
        const image = $('pageImage');
        image.alt = lesson.book + ' · ' + lesson.title;
        image.width = lesson.width;
        image.height = lesson.height;
        scan.style.setProperty('--reading-width', (slug === 'email' || slug === 'community' ? 920 : 880) + 'px');
        image.src = await asset(lesson.scan);
        await image.decode();
        addHotspots(lesson);
        $('scanStatus').hidden = true;
        scan.hidden = false;
        $('fit').hidden = false;
        if (lesson.startX && scan.clientWidth > viewport.clientWidth) {
            viewport.scrollLeft = lesson.startX / lesson.width * scan.clientWidth - 16;
        }
    }

    open().catch(() => {
        $('scanStatus').textContent = '暂时无法打开课本。请重新打开这篇预习笔记。';
    });
})();
