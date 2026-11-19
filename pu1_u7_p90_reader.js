(function () {
    "use strict";

    if (parent === window || !parent.PreviewNotes?.isReader(window)) {
        location.replace("index.html");
        return;
    }

    const lesson = parent.GoodFriendLesson || window.GoodFriendLesson;
    const assets = "pu1_u7_p90_assets/";
    const query = new URLSearchParams(location.search);
    const request = query.get("request");
    const review = query.get("mode") === "review";
    const byId = id => document.getElementById(id);
    const action = byId("reader-study-start");
    const speed = byId("speed");
    const status = byId("playerStatus");
    const stopButton = byId("stop");
    const replay = byId("replay");
    const parts = byId("parts");

    let audio, selected, sentencePack, clipUrl;
    let playback = 0;

    action.textContent = review ? "返回主界面" : "开始学习";
    action.onclick = () => {
        stop();
        action.disabled = !review;
        parent.postMessage({ action: review ? "close-note" : "start-note-study", request }, location.origin);
    };
    window.addEventListener("message", event => {
        if (event.source === parent && event.origin === location.origin &&
            event.data?.request === request && event.data.action === "note-study-error") {
            action.disabled = false;
        }
    });

    async function fetchAsset(path) {
        async function read(url) {
            const response = await fetch(url);
            if (!response.ok) throw new Error("Unavailable");
            return response;
        }
        const direct = read(path);
        if (!parent.AssetCache) return direct;
        const mirrored = parent.AssetCache.getBlobUrl(path).then(url => {
            if (!url) throw new Error("Unavailable");
            return read(url);
        });
        return Promise.any([direct, mirrored]);
    }

    function getSentencePack() {
        sentencePack ??= Promise.all([
            fetchAsset(assets + "sentences.bin").then(response => response.arrayBuffer()),
            fetchAsset(assets + "sentence-index.json").then(response => response.json()),
        ]).catch(error => {
            sentencePack = null;
            throw error;
        });
        return sentencePack;
    }

    function stop() {
        playback++;
        audio?.pause();
        audio = null;
        if (clipUrl) URL.revokeObjectURL(clipUrl);
        clipUrl = null;
        stopButton.disabled = true;
    }

    function highlight(clip) {
        parts.querySelectorAll(".story-tap.active").forEach(tap => tap.classList.remove("active"));
        if (clip) {
            parts.querySelectorAll('[data-clip="' + clip + '"]').forEach(tap => tap.classList.add("active"));
        }
    }

    async function play(item) {
        stop();
        const attempt = playback;
        selected = item;
        highlight(item.clip);
        byId("nowPlaying").textContent = item.text;
        status.textContent = item.zh;
        stopButton.disabled = replay.disabled = false;
        window.dispatchEvent(new CustomEvent("notes-select", {
            detail: { id: item.source || String(item.clip), text: item.text },
        }));

        try {
            let source = item.source;
            if (item.clip) {
                const [bytes, index] = await getSentencePack();
                if (attempt !== playback) return;
                const [offset, length] = index[item.clip];
                clipUrl = URL.createObjectURL(new Blob([bytes.slice(offset, offset + length)], { type: "audio/mpeg" }));
                source = clipUrl;
            } else if (parent.AssetCache) {
                source = await parent.AssetCache.getBlobUrl(source).catch(() => null) || source;
                if (attempt !== playback) return;
            }
            audio = new Audio(source);
            audio.playbackRate = Number(speed.value);
            audio.onended = () => { if (attempt === playback) stop(); };
            await audio.play();
        } catch (_) {
            if (attempt !== playback) return;
            stop();
            status.textContent = "音频正在加载，请再试一次。";
        }
    }

    stopButton.onclick = stop;
    replay.onclick = () => { if (selected) play(selected); };
    speed.onchange = () => { if (audio) audio.playbackRate = Number(speed.value); };
    window.InteractiveNotesPOC = { pause: stop };
    document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });

    function loadImage(img, path) {
        img.onerror = () => {
            img.onerror = null;
            parent.AssetCache?.getBlobUrl(path).then(url => { if (url) img.src = url; }).catch(() => {});
        };
        img.src = path;
    }

    for (const [text, zh, , path] of lesson.words) {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "card";
        card.onclick = () => play({ text, zh, source: lesson.wordAudio(text) });
        const img = document.createElement("img");
        img.alt = "";
        img.width = img.height = 320;
        img.loading = "lazy";
        loadImage(img, path);
        const en = document.createElement("strong");
        en.textContent = text;
        const cn = document.createElement("span");
        cn.textContent = zh;
        card.append(img, en, cn);
        byId("cards").append(card);
    }

    lesson.sections.forEach((part, index) => {
        const box = document.createElement("section");
        box.className = "race-part";
        const scan = document.createElement("div");
        scan.className = "story-scan";
        const img = document.createElement("img");
        const [width, height] = part.dimensions;
        img.width = width;
        img.height = height;
        img.alt = part.title;
        img.loading = "lazy";
        loadImage(img, assets + "story-" + (index + 1) + ".webp");
        scan.append(img);

        part.sentences.forEach(sentence => sentence.hotspots.forEach(([x, y, w, h], line) => {
            const tap = document.createElement("button");
            tap.type = "button";
            tap.className = "story-tap";
            tap.dataset.clip = sentence.clip;
            tap.setAttribute("aria-label", sentence.text);
            if (line) tap.tabIndex = -1;
            Object.assign(tap.style, {
                left: 100 * x / width + "%",
                top: 100 * y / height + "%",
                width: 100 * w / width + "%",
                height: 100 * h / height + "%",
            });
            tap.onclick = () => play(sentence);
            scan.append(tap);
        }));
        box.append(scan);
        parts.append(box);
    });

    if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver(entries => {
            if (!entries.some(entry => entry.isIntersecting)) return;
            observer.disconnect();
            getSentencePack().catch(() => {});
        }, { rootMargin: "250px" });
        observer.observe(byId("article"));
    }
})();
