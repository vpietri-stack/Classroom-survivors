// Shared curriculum and SR selection for the mixed non-spelling round.
(() => {
    'use strict';
    const catalog = {
        missing: [
            { id: 'M1', sentences: ['I washed my hands ___ I ate lunch.', 'I ate lunch ___ I washed my hands.'], answers: ['before', 'after'] },
            { id: 'M2', sentences: ['He put on his socks ___ he put on his shoes.', 'He put on his shoes ___ he put on his socks.'], answers: ['before', 'after'] },
            { id: 'M3', sentences: ['We bought tickets ___ we went into the cinema.', 'We went into the cinema ___ we bought tickets.'], answers: ['before', 'after'] },
            { id: 'M4', sentences: ['She dried her hair ___ she had a shower.', 'She had a shower ___ she dried her hair.'], answers: ['after', 'before'] },
            { id: 'M5', sentences: ['I cleaned my teeth ___ I went to bed.', 'I laughed ___ I heard the funny joke.'], answers: ['before', 'when'] },
            { id: 'M6', sentences: ['He had breakfast ___ he got dressed.', 'I waved ___ I saw my friend.'], answers: ['after', 'when'] }
        ],
        fix: [
            { id: 'F1', sentence: 'I washed my hands after I ate lunch.', wrongWord: 'after', answer: 'before' },
            { id: 'F2', sentence: 'He put on his shoes before he put on his socks.', wrongWord: 'before', answer: 'after' },
            { id: 'F3', sentence: 'We bought tickets after we went into the cinema.', wrongWord: 'after', answer: 'before' },
            { id: 'F4', sentence: 'She dried her hair before she had a shower.', wrongWord: 'before', answer: 'after' },
            { id: 'F5', sentence: 'I laughed before I heard the funny joke.', wrongWord: 'before', answer: 'when' },
            { id: 'F6', sentence: 'I waved before I saw my friend.', wrongWord: 'before', answer: 'when' },
            { id: 'F7', sentence: 'He put on his socks when he put on his shoes.', wrongWord: 'when', answer: 'before' },
            { id: 'F8', sentence: 'She dried her hair when she had a shower.', wrongWord: 'when', answer: 'after' }
        ]
    };

    // Approved Unit 1 boards remain grouped under the existing page 16 entry.
    const unit1Catalog = {
        missing: [
            { id: 'M1', sentences: ["It's 7:30. It's half ___ seven.", "It's twelve o'clock at night. It's ___."], answers: ['past', 'midnight'] },
            { id: 'M2', sentences: ["I have breakfast ___ seven o'clock.", 'We practise ___ Mondays.'], answers: ['at', 'on'] },
            { id: 'M3', sentences: ['___ do you live? In Russia.', "___ are you running? Because I'm late."], answers: ['where', 'why'] },
            { id: 'M4', sentences: ['___ helps you with your homework? My brother.', '___ many acrobats are there? Four.'], answers: ['who', 'how'] },
            { id: 'M5', sentences: ['She is ___ on one leg.', 'They are ___ up as clowns.'], answers: ['hopping', 'dressing'] },
            { id: 'M7', sentences: ['When I ___ four, I could hop.', 'When we ___ six, we could skip.'], answers: ['was', 'were'] },
            { id: 'M8', sentences: ['I ___ hop on one leg when I was four.', "I couldn't ___ a bike when I was two."], answers: ['could', 'ride'] },
            { id: 'M11', sentences: ['Anastasia practises ___ day.', 'She performs ___ stage.'], answers: ['every', 'on'] },
            { id: 'M12', sentences: ['The clowns ___ dancing.', 'The boy ___ clapping.'], answers: ['are', 'is'] },
            { id: 'M13', sentences: ['___ is your favourite sport? Tennis.', '___ do you practise? On Saturdays.'], answers: ['what', 'when'] },
            { id: 'M14', sentences: ['___ bag is yours: the red one or the blue one? The red one.', "___ bag is this? It's Lily's."], answers: ['which', 'whose'] },
            { id: 'M15', sentences: ["___ old is your brother? He's ten.", '___ is your teacher? Mr Friendly.'], answers: ['how', 'who'] },
            { id: 'M16', sentences: ['___ are my shoes? Under the bed.', '___ do acrobats practise? Because they want to improve.'], answers: ['where', 'why'] },
            { id: 'M17', sentences: ['I ___ five when I could ride a bike.', 'My brothers ___ seven when they could climb trees.'], answers: ['was', 'were'] },
            { id: 'M18', sentences: ['He ___ three when he could hop.', 'They ___ six when they could skip.'], answers: ['was', 'were'] },
            { id: 'M19', sentences: ['I ___ ride a bike when I was two,', 'but I ___ do it now.'], answers: ["couldn't", 'can'] },
            { id: 'M20', sentences: ['My grandma ___ do gymnastics when she was eighteen,', 'but she ___ do it anymore.'], answers: ['could', "can't"] },
            { id: 'M21', sentences: ["I couldn't ___ in the swimming pool when I was two.", 'I could ___ a bike when I was six.'], answers: ['swim', 'ride'] },
            { id: 'M22', sentences: ['I ___ swim when I was two,', 'but after lots of practice I ___ swim now.'], answers: ["couldn't", 'can'] },
            { id: 'M23', sentences: ['My grandpa ___ climb trees when he was young,', 'but he ___ climb them anymore.'], answers: ['could', "can't"] }
        ],
        fix: [
            { id: 'F1', sentence: "It's 7:30. It's half to seven.", wrongWord: 'to', answer: 'past' },
            { id: 'F2', sentence: "It's twelve o'clock at night. It's midday.", wrongWord: 'midday', answer: 'midnight' },
            { id: 'F3', sentence: 'When do you live? In Russia.', wrongWord: 'when', answer: 'where' },
            { id: 'F4', sentence: "Who are you running? Because I'm late.", wrongWord: 'who', answer: 'why' },
            { id: 'F5', sentence: 'The acrobats is practising.', wrongWord: 'is', answer: 'are' },
            { id: 'F6', sentence: 'The clown is climb a ladder.', wrongWord: 'climb', answer: 'climbing' },
            { id: 'F7', sentence: 'I were four when I could hop on one leg.', wrongWord: 'were', answer: 'was' },
            { id: 'F8', sentence: 'Could you swimming when you were five?', wrongWord: 'swimming', answer: 'swim' },
            { id: 'F11', sentence: 'Anastasia practises every days.', wrongWord: 'days', answer: 'day' },
            { id: 'F12', sentence: 'There are thirteen clown in the circus.', wrongWord: 'clown', answer: 'clowns' },
            { id: 'F13', sentence: 'Where colour is your bag? Blue.', wrongWord: 'where', answer: 'what' },
            { id: 'F14', sentence: "Who's bag is this? It's Lily's.", wrongWord: "who's", answer: 'whose' },
            { id: 'F15', sentence: 'Why many clowns are there? Three.', wrongWord: 'why', answer: 'how' },
            { id: 'F16', sentence: 'Who do you practise? On Saturdays.', wrongWord: 'who', answer: 'when' },
            { id: 'F17', sentence: 'We was six when we could skip.', wrongWord: 'was', answer: 'were' },
            { id: 'F18', sentence: 'He were five when he could swim.', wrongWord: 'were', answer: 'was' },
            { id: 'F19', sentence: 'You is very good at climbing.', wrongWord: 'is', answer: 'are' },
            { id: 'F20', sentence: 'She are dressing up as a clown.', wrongWord: 'are', answer: 'is' },
            { id: 'F21', sentence: "I can't ride a bike when I was two, but I can do it now.", wrongWord: "can't", answer: "couldn't" },
            { id: 'F22', sentence: "My grandma could do gymnastics when she was eighteen, but she couldn't do it anymore now.", wrongWord: "couldn't", answer: "can't" },
            { id: 'F23', sentence: "I couldn't swim when I was two, but after lots of practice I could swim now.", wrongWord: 'could', answer: 'can' },
            { id: 'F24', sentence: "My grandpa can climb trees when he was young, but he can't climb them anymore.", wrongWord: 'can', answer: 'could' }
        ]
    };
    const pageCatalogs = { 'PU3:1:16': unit1Catalog, 'PU3:9:109': catalog };

    function normalize() {
        if (typeof TEACHING_CONTENT === 'undefined') return;
        for (const book of Object.keys(TEACHING_CONTENT)) {
            for (const unit of Object.keys(TEACHING_CONTENT[book])) {
                for (const page of Object.keys(TEACHING_CONTENT[book][unit])) {
                    const content = TEACHING_CONTENT[book][unit][page];
                    if (Array.isArray(content.nonSpellingExercises)) continue;
                    // Retain the legacy arrays for existing readers and SR identities.
                    content.nonSpellingExercises = [
                        ...(content.sentences || []).map(sentence => ({ type: 'sentence-scramble', sentence })),
                        ...((content.sentencePairs || []).length ? [{ type: 'sentence-match', pairs: content.sentencePairs }] : [])
                    ];
                    const authored = pageCatalogs[[book, unit, page].join(':')];
                    if (authored) {
                        content.nonSpellingExercises.push(
                            ...authored.missing.map(item => ({ ...item, type: 'missing-word' })),
                            ...authored.fix.map(item => ({ ...item, type: 'find-fix' }))
                        );
                    }
                }
            }
        }
    }

    function typedKey(item, page) {
        return ['non-spelling', item.type, page.book, page.unit, page.page, item.id].join(':').toLowerCase();
    }

    function buildPool(book, unit, page, options = {}) {
        normalize();
        const pages = getSortedPagesForBook(book);
        const activeIndex = pages.findIndex(p => p.book === book && String(p.unit) === String(unit) && String(p.page) === String(page));
        if (activeIndex < 0) return { entries: [], activeIndex };
        const state = options.srState || (typeof authActiveUser !== 'undefined' && authActiveUser && authActiveUser.srState) || {};
        const session = options.session === undefined ? getCurrentSession() : options.session;
        const seen = new Set();
        const seenPairs = new Set();
        const entries = [];
        const priority = (key, bucket) => getSRPriority(key, state[bucket] || {}, session, options.failures, options.successes);
        const add = (item, p, key, bucket, status, varietyEligible = true) => {
            const identity = item.type + ':' + key;
            if (seen.has(identity)) return;
            seen.add(identity);
            const weight = Math.pow(.2, Math.abs(p.absIndex - activeIndex));
            entries.push({ item: { ...item, book: p.book, unit: p.unit, page: p.page, key, srType: bucket }, key, pageAbsIndex: p.absIndex,
                priority: status || priority(key, bucket), score: Math.random() * weight, varietyEligible });
        };
        for (const p of pages.slice(0, activeIndex + 1).reverse()) {
            const content = TEACHING_CONTENT[p.book][p.unit][p.page];
            for (const item of content.nonSpellingExercises || []) {
                if (item.type === 'sentence-scramble') {
                    const sentence = Array.isArray(item.sentence) ? item.sentence[0] : item.sentence;
                    if (typeof sentence === 'string' && sentence.trim()) add(item, p, itemKey(item.sentence), 'sentences');
                } else if (item.type === 'missing-word' || item.type === 'find-fix') {
                    add(item, p, typedKey(item, p), 'sentences');
                } else if (item.type === 'sentence-match') {
                    const pairs = (item.pairs || []).filter(pair => {
                        const key = itemKey(pair);
                        if (!pair.a || !pair.b || seenPairs.has(key)) return false;
                        seenPairs.add(key);
                        return true;
                    }).map(pair => ({ pair, priority: priority(itemKey(pair), 'sentencePairs'), tie: Math.random() }));
                    const eligible = pairs.filter(p => p.priority.group !== 4).sort((a, b) => a.priority.group - b.priority.group || b.tie - a.tie);
                    const cooldown = pairs.filter(p => p.priority.group === 4).sort((a, b) => a.priority.dueAfterSession - b.priority.dueAfterSession);
                    const size = Math.min(3, pairs.length);
                    if (!size) continue;
                    const addBoard = selected => {
                        const boardPairs = selected.map(p => p.pair);
                        const cooling = selected.filter(p => p.priority.group === 4);
                        const pickable = selected.filter(p => p.priority.group !== 4);
                        const status = pickable.length
                            ? pickable.reduce((best, p) => p.priority.group < best.group ? p.priority : best, pickable[0].priority)
                            : { group: 4, dueAfterSession: Math.max(...cooling.map(p => p.priority.dueAfterSession)) };
                        add({ type: 'sentence-match', pairs: boardPairs }, p, boardPairs.map(itemKey).sort().join(' || '), 'sentencePairs', status, cooling.length === 0);
                    };
                    while (eligible.length >= size) addBoard(eligible.splice(0, size));
                    // Serve a due pair even if its board needs cooldown partners.
                    // Such a board may win on SR, but cannot be pulled just for variety.
                    const remaining = [...eligible, ...cooldown];
                    while (remaining.length >= size) addBoard(remaining.splice(0, size));
                }
            }
        }
        return { entries, activeIndex };
    }

    function select(book, unit, page, count = 5, options = {}) {
        const { entries } = buildPool(book, unit, page, options);
        const compare = (a, b) => a.priority.group - b.priority.group || b.score - a.score;
        let eligible = entries.filter(e => e.priority.group !== 4).sort(compare);
        const cooldown = entries.filter(e => e.priority.group === 4)
            .sort((a, b) => a.priority.dueAfterSession - b.priority.dueAfterSession || b.score - a.score);
        if (options.avoidKey && eligible.some(e => e.key !== options.avoidKey)) eligible = eligible.filter(e => e.key !== options.avoidKey);
        const picked = pickWithNewQuota(eligible, count);
        if (count > 1) {
            const varietyPool = eligible.filter(e => e.varietyEligible);
            const targetTypes = Math.min(3, new Set(varietyPool.map(e => e.item.type)).size, count);
            for (const candidate of varietyPool) {
                if (new Set(picked.map(e => e.item.type)).size >= targetTypes) break;
                if (picked.some(e => e.item.type === candidate.item.type)) continue;
                let replaceIndex = -1;
                for (let i = picked.length - 1; i >= 0; i--) {
                    if (picked.filter(p => p.item.type === picked[i].item.type).length > 1) { replaceIndex = i; break; }
                }
                if (replaceIndex >= 0) picked.splice(replaceIndex, 1, candidate);
            }
        }
        const used = new Set(picked.map(e => e.item.type + ':' + e.key));
        for (const entry of cooldown) {
            if (picked.length >= count) break;
            const identity = entry.item.type + ':' + entry.key;
            if (!used.has(identity)) { picked.push(entry); used.add(identity); }
        }
        return shuffleArray(picked).map(e => e.item);
    }
    window.NonSpellingContent = { catalog, normalize, buildPool, select, typedKey };
    normalize();
})();
