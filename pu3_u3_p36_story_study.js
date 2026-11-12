(function (lesson) {
    "use strict";
    const audio = new Audio();
    const context = {"book": "PU3", "unit": "3", "page": "36"};
    const words = new Map(lesson.words.map(word => [word[0], word]));
    const $ = id => document.getElementById(id);

    function playWord() {
        const word = words.get(currentTTSWord);
        if (!word) return;
        const source = lesson.wordAudio(word[0]);
        if (audio.getAttribute("src") === source) audio.currentTime = 0;
        else audio.src = source;
        audio.play().catch(() => {});
    }

    function showWord(target) {
        const word = words.get(target);
        const translation = $("roundA-translation");
        const image = $("roundA-image");
        translation.textContent = word ? word[1] : "";
        translation.classList.toggle("hidden", !word);
        image.classList.toggle("hidden", !word);
        if (word) image.src = word[3];
    }

    function recognitionComplete() {
        const parks = STUDY_STATE.parks;
        if (parks.set < Math.ceil(lesson.words.length / 5) - 1) {
            parks.set++;
            STUDY_STATE.words = lesson.words.slice(parks.set * 5, parks.set * 5 + 5).map(word => word[0]);
            startRoundA();
        } else {
            audio.pause();
            STUDY_STATE.round = "E";
            STUDY_STATE.currentSentenceIndex = 0;
            startExerciseTracking();
            renderCloze();
        }
    }

    function renderCloze() {
        const parks = STUDY_STATE.parks;
        const index = STUDY_STATE.currentSentenceIndex;
        const part = lesson.sections[index];
        const heading = part.sentences.find(sentence => sentence.title && sentence.text === part.title);
        const body = part.sentences.filter(sentence => !sentence.title).map(sentence => sentence.text).join(" ");
        const blocks = heading ? [["h4", heading.text], ["p", body]] : [["p", body]];
        const passages = blocks.map(([tag, text]) => ({ tag, text, matches: lesson.clozeMatches(text) }));
        const answers = passages.flatMap(({ matches }) => matches.map(match => match[0]));
        if (parks.slots?.length !== answers.length) {
            parks.slots = answers.map(() => null);
            parks.dock = answers.map((_, i) => i);
            for (let i = parks.dock.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [parks.dock[i], parks.dock[j]] = [parks.dock[j], parks.dock[i]];
            }
            parks.selected = 0;
            parks.verdict = null;
        }

        updateStudyUI("课文填空 · " + (index + 1) + " / " + lesson.sections.length, "请查看本页的课本第 36–37 页，填完所有空格后，再点击「检查」。");
        const board = document.createElement("div");
        board.className = "parks-cloze";
        const reader = document.createElement("details");
        reader.open = parks.readerOpen === true;
        reader.addEventListener("toggle", () => {
            if (parks.readerOpen === reader.open) return;
            parks.readerOpen = reader.open;
            if (window.StudyRecovery) StudyRecovery.capture();
        });
        const summary = document.createElement("summary");
        summary.textContent = "查看这一段课文";
        const scan = document.createElement("img");
        scan.src = "pu3_u3_p36_story_assets/story-" + (index + 1) + ".webp";
        scan.alt = "Power Up 3 课本第 36–37 页";
        [scan.width, scan.height] = lesson.sections[index].dimensions;
        scan.loading = "lazy";
        reader.append(summary, scan);
        const title = document.createElement("h3");
        title.textContent = "第 " + (index + 1) + " 部分";
        const layout = document.createElement("div");
        layout.className = "parks-cloze-layout";
        const passage = document.createElement("div");
        passage.lang = "en";
        const dock = document.createElement("div");
        dock.className = "parks-dock";
        dock.setAttribute("aria-label", "词库");
        const check = makeButton("检查", "game-btn bg-green-500 parks-check", () => {
            if (parks.slots.includes(null) || parks.verdict) return;
            parks.verdict = parks.slots.map((tile, slot) => answers[tile].toLowerCase() === answers[slot].toLowerCase());
            const correct = parks.verdict.every(Boolean);
            if (correct) {
                playHappySound();
                queueExerciseEvent("missingWord", "study", { id: "pu3-u3-p36-paragraph-" + (index + 1), book: context.book, unit: context.unit, page: context.page,
                    sentences: [passages.map(({ text }) => text).join("\n")], answers, response: parks.slots.map(tile => answers[tile]) });
            } else {
                synthError();
                incrementExerciseAttempts();
            }
            paint();
            studyLater(correct ? "parks_next" : "parks_reset", correct ? next : reset, correct ? 950 : 1550);
        });
        const feedback = document.createElement("p");
        feedback.setAttribute("role", "status");

        const slots = [];
        for (const { tag, text, matches } of passages) {
            const block = document.createElement(tag);
            let cursor = 0;
            for (const match of matches) {
                const i = slots.length;
                block.append(text.slice(cursor, match.index));
                const slot = makeButton("", "parks-gap", () => {
                    if (parks.verdict) return;
                    parks.slots[i] = null;
                    parks.selected = i;
                    paint();
                });
                slots.push(slot);
                block.append(slot);
                cursor = match.index + match[0].length;
            }
            block.append(text.slice(cursor));
            passage.append(block);
        }

        const tiles = parks.dock.map(tile => makeButton(answers[tile], "study-word-tile", () => {
            if (parks.verdict || parks.selected === null || parks.slots.includes(tile)) return;
            parks.slots[parks.selected] = tile;
            const empty = parks.slots.indexOf(null);
            parks.selected = empty === -1 ? null : empty;
            paint();
        }));
        dock.append(...tiles);

        function paint() {
            slots.forEach((slot, i) => {
                const tile = parks.slots[i];
                const answer = tile === null ? "" : answers[tile];
                slot.textContent = answer || "___";
                slot.setAttribute("aria-label", "空格 " + (i + 1) + (answer ? "，" + answer : ""));
                slot.setAttribute("aria-pressed", String(parks.selected === i && !parks.verdict));
                slot.disabled = !!parks.verdict;
                slot.classList.toggle("parks-right", parks.verdict?.[i] === true);
                slot.classList.toggle("parks-wrong", parks.verdict?.[i] === false);
            });
            tiles.forEach((tile, i) => { tile.hidden = parks.slots.includes(parks.dock[i]); });
            check.disabled = !!parks.verdict || parks.slots.includes(null);
            feedback.textContent = parks.verdict ? parks.verdict.every(Boolean) ? "全部答对了！" : "有些答案需要修改。所有词会回到词库，请再试一次。" : "";
        }
        layout.append(passage, dock);
        board.append(reader, title, layout, check, feedback);
        $("study-game-area").replaceChildren(board);
        paint();
    }

    function makeButton(text, className, action) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = text;
        button.className = className;
        button.onclick = action;
        return button;
    }

    function reset() {
        const parks = STUDY_STATE.parks;
        parks.slots.fill(null);
        parks.selected = 0;
        parks.verdict = null;
        renderCloze();
    }

    function next() {
        const parks = STUDY_STATE.parks;
        if (++STUDY_STATE.currentSentenceIndex === lesson.sections.length) {
            finishStudySession();
            return;
        }
        parks.slots = null;
        startExerciseTracking();
        renderCloze();
    }

    window.WorkYourBodyStudy = { id: "pu3-u3-p36", context, setCount: Math.ceil(lesson.words.length / 5), exerciseCount: lesson.sections.length, words: lesson.words, recognitionComplete, playWord, showWord,
        renderCloze, reset, next, pause: () => audio.pause() };
    window.ArticleStudy.register("pu3-u3-p36", window.WorkYourBodyStudy);
})(window.WorkYourBody);
