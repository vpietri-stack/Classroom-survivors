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
    const unit2Catalog = {
        missing: [
            { id: 'M1', sentences: ["She's the woman ___ makes the noodles.", 'This is the sauce ___ we put on pancakes.'], answers: ['who', 'which'] },
            { id: 'M2', sentences: ['This is the café ___ we have breakfast.', 'These are the pancakes ___ we ate.'], answers: ['where', 'which'] },
            { id: 'M3', sentences: ["He's the man ___ taught me to swim.", "That's the pool ___ I learned to swim."], answers: ['who', 'where'] },
            { id: 'M4', sentences: ['This is the woman ___ works in the café.', 'This is the camera ___ I use to take photos.', 'This is the café ___ we eat.'], answers: ['who', 'which', 'where'] },
            { id: 'M5', sentences: ['This is the restaurant ___ we ate noodles.', 'This is the woman ___ cooked them.', 'These are the noodles ___ she cooked.'], answers: ['where', 'who', 'which'] },
            { id: 'M6', sentences: ['This is the photo ___ I took yesterday.', 'This is the boy ___ took the photo.'], answers: ['which', 'who'] },
            { id: 'M7', sentences: ['Yesterday, Dad ___ our car to town.', 'Last night, I ___ an email to Grandma.'], answers: ['drove', 'wrote'] },
            { id: 'M8', sentences: ['Last year, she ___ English at my school.', 'Yesterday, Dad ___ me a milkshake.'], answers: ['taught', 'gave'] },
            { id: 'M9', sentences: ['We ___ a film at the cinema yesterday.', 'I ___ a photo with my camera yesterday.'], answers: ['saw', 'took'] },
            { id: 'M10', sentences: ['They ___ a tree house last summer.', 'My grandma ___ up in a small village.'], answers: ['built', 'grew'] },
            { id: 'M11', sentences: ['We ___ noodles for lunch yesterday.', 'Grandpa ___ me a story last night.'], answers: ['had', 'told'] },
            { id: 'M12', sentences: ['___ you see the film yesterday?', '___ your sister like pancakes now?'], answers: ['did', 'does'] },
            { id: 'M13', sentences: ["We didn't ___ a tree house yesterday.", 'We ___ one last summer.'], answers: ['build', 'built'] },
            { id: 'M14', sentences: ["She didn't ___ the email yesterday.", 'She ___ it this morning.'], answers: ['write', 'wrote'] },
            { id: 'M15', sentences: ['___ we finished lunch, we went to the funfair.', 'This is the funfair ___ we went after lunch.'], answers: ['when', 'where'] },
            { id: 'M16', sentences: ['When the bus ___, we got on it.', 'When we ___ lunch, we went to the funfair.'], answers: ['arrived', 'finished'] }
        ],
        fix: [
            { id: 'F1', sentence: "She's the woman which makes the noodles.", wrongWord: 'which', answer: 'who' },
            { id: 'F2', sentence: 'This is the café which we have breakfast.', wrongWord: 'which', answer: 'where' },
            { id: 'F3', sentence: 'This is the camera where I use to take photos.', wrongWord: 'where', answer: 'which' },
            { id: 'F4', sentence: "He's the teacher where helped me with my homework.", wrongWord: 'where', answer: 'who' },
            { id: 'F5', sentence: "That's the restaurant who sells pancakes.", wrongWord: 'who', answer: 'which' },
            { id: 'F6', sentence: 'This is the kitchen who my grandma cooks.', wrongWord: 'who', answer: 'where' },
            { id: 'F7', sentence: 'Yesterday, Dad drive our car to town.', wrongWord: 'drive', answer: 'drove' },
            { id: 'F8', sentence: 'She writed an email last night.', wrongWord: 'writed', answer: 'wrote' },
            { id: 'F9', sentence: "He's the teacher who teaches me English last year.", wrongWord: 'teaches', answer: 'taught' },
            { id: 'F10', sentence: 'He gived me a bowl of noodles yesterday.', wrongWord: 'gived', answer: 'gave' },
            { id: 'F11', sentence: 'This is the tree house which they build last summer.', wrongWord: 'build', answer: 'built' },
            { id: 'F12', sentence: "We didn't saw the film yesterday.", wrongWord: 'saw', answer: 'see' },
            { id: 'F13', sentence: 'Did she took a photo?', wrongWord: 'took', answer: 'take' },
            { id: 'F14', sentence: "My dad didn't drove to work yesterday.", wrongWord: 'drove', answer: 'drive' },
            { id: 'F15', sentence: 'We were happy who the bus arrived.', wrongWord: 'who', answer: 'when' },
            { id: 'F16', sentence: 'When we finished lunch yesterday, we go to the funfair.', wrongWord: 'go', answer: 'went' },
            { id: 'F17', sentence: 'We have noodles for lunch yesterday.', wrongWord: 'have', answer: 'had' },
            { id: 'F18', sentence: 'Mum taked a photo yesterday.', wrongWord: 'taked', answer: 'took' },
            { id: 'F19', sentence: 'My grandma grows up in this village when she was a child.', wrongWord: 'grows', answer: 'grew' },
            { id: 'F20', sentence: 'Grandpa telled me a story last night.', wrongWord: 'telled', answer: 'told' }
        ]
    };
    const unit3Catalog = {
        missing: [
            { id: 'M1', sentences: ['Jenny is ___ than Jim.', 'Jenny is the ___ of the three children.'], answers: ['taller', 'tallest'] },
            { id: 'M2', sentences: ['Ivan is the ___ of all the acrobats.', 'Ivan is ___ than Jim.'], answers: ['strongest', 'stronger'] },
            { id: 'M3', sentences: ['My sister runs ___ than me.', 'She is the ___ runner in our whole school.'], answers: ['faster', 'fastest'] },
            { id: 'M4', sentences: ['This is the ___ of the three boxes.', 'This box is ___ than that one.'], answers: ['biggest', 'bigger'] },
            { id: 'M5', sentences: ['This mouse is ___ than that mouse.', 'This is the ___ of the three mice.'], answers: ['smaller', 'smallest'] },
            { id: 'M6', sentences: ['This is the ___ dangerous of all these sports.', 'This sport is ___ dangerous than tennis.'], answers: ['most', 'more'] },
            { id: 'M7', sentences: ['My drawing is ___ than yours.', 'This is the ___ of all my drawings.'], answers: ['better', 'best'] },
            { id: 'M8', sentences: ['This is the ___ of the three films.', 'This film is ___ than that one.'], answers: ['worst', 'worse'] },
            { id: 'M9', sentences: ['Jim is as tall ___ Jenny.', 'Ivan is taller ___ Jim.'], answers: ['as', 'than'] },
            { id: 'M10', sentences: ['Jenny is taller than Jim, so Jim is ___ as tall as Jenny.', "I'm ___ tall as my brother."], answers: ['not', 'as'] },
            { id: 'M11', sentences: ['I want ___ play football.', 'She ___ to play tennis.'], answers: ['to', 'wants'] },
            { id: 'M12', sentences: ['He ___ to see a doctor.', 'We need ___ do our homework.'], answers: ['needs', 'to'] },
            { id: 'M13', sentences: ['I ___ to go to the party.', 'My sister ___ to go too.'], answers: ['want', 'wants'] },
            { id: 'M14', sentences: ['Tom ___ to finish his homework.', 'They ___ to finish theirs.'], answers: ['needs', 'need'] },
            { id: 'M15', sentences: ['Your arm bends at your ___.', 'Your leg bends at your ___.'], answers: ['elbow', 'knee'] },
            { id: 'M16', sentences: ['We wear shoes on our ___.', 'We wear gloves on our ___.'], answers: ['feet', 'hands'] },
            { id: 'M17', sentences: ['Ivan is ___ strongest man in the circus.', 'Ivan is stronger ___ Jim.'], answers: ['the', 'than'] },
            { id: 'M18', sentences: ['Jenny is taller ___ Jim.', 'Jenny is ___ tallest of the three children.'], answers: ['than', 'the'] },
            { id: 'M19', sentences: ['Jim is ___ tall as Jenny.', 'Ivan is ___ strongest of all the acrobats.'], answers: ['as', 'the'] },
            { id: 'M20', sentences: ['My bag is heavier ___ yours.', "Your bag isn't as heavy ___ mine."], answers: ['than', 'as'] },
            { id: 'M21', sentences: ['This is ___ biggest of the three boxes.', 'This box is bigger ___ that one.', 'This box is ___ big as yours.'], answers: ['the', 'than', 'as'] },
            { id: 'M22', sentences: ['My brother is ___ tall ___ me.', 'My sister is taller ___ me.', 'She is ___ tallest of the three of us.'], answers: ['as', 'as', 'than', 'the'] }
        ],
        fix: [
            { id: 'F1', sentence: 'Jenny is tallest than Jim.', wrongWord: 'tallest', answer: 'taller' },
            { id: 'F2', sentence: 'Ivan is the stronger of all the acrobats.', wrongWord: 'stronger', answer: 'strongest' },
            { id: 'F3', sentence: 'This box is big than that one.', wrongWord: 'big', answer: 'bigger' },
            { id: 'F4', sentence: 'This is the smaller of all the boxes.', wrongWord: 'smaller', answer: 'smallest' },
            { id: 'F5', sentence: 'This animal is most dangerous than that one.', wrongWord: 'most', answer: 'more' },
            { id: 'F6', sentence: 'This is the more beautiful of all the flowers.', wrongWord: 'more', answer: 'most' },
            { id: 'F7', sentence: 'Jim is as tall than Jenny.', wrongWord: 'than', answer: 'as' },
            { id: 'F8', sentence: "I'm not than strong as Ivan.", wrongWord: 'than', answer: 'as' },
            { id: 'F9', sentence: 'My drawing is good than yours.', wrongWord: 'good', answer: 'better' },
            { id: 'F10', sentence: 'This is the worse of all my drawings.', wrongWord: 'worse', answer: 'worst' },
            { id: 'F11', sentence: 'I want to playing football.', wrongWord: 'playing', answer: 'play' },
            { id: 'F12', sentence: 'She needs to resting her ankle.', wrongWord: 'resting', answer: 'rest' },
            { id: 'F13', sentence: 'He want to go to the party.', wrongWord: 'want', answer: 'wants' },
            { id: 'F14', sentence: 'They needs to do their homework.', wrongWord: 'needs', answer: 'need' },
            { id: 'F15', sentence: 'I need for see a doctor.', wrongWord: 'for', answer: 'to' },
            { id: 'F16', sentence: "She doesn't wants to go to the party.", wrongWord: 'wants', answer: 'want' },
            { id: 'F17', sentence: 'I hurt both my knee.', wrongWord: 'knee', answer: 'knees' },
            { id: 'F18', sentence: 'My fingers hurts.', wrongWord: 'hurts', answer: 'hurt' },
            { id: 'F19', sentence: "I've got a sore throats.", wrongWord: 'throats', answer: 'throat' },
            { id: 'F20', sentence: "I've got a headache, but I wants to play football.", wrongWord: 'wants', answer: 'want' },
            { id: 'F21', sentence: 'Ivan is than strongest man in the circus.', wrongWord: 'than', answer: 'the' },
            { id: 'F22', sentence: 'Jenny is taller the Jim.', wrongWord: 'the', answer: 'than' },
            { id: 'F23', sentence: 'Jim is the tall as Jenny.', wrongWord: 'the', answer: 'as' },
            { id: 'F24', sentence: 'My bag is as heavy than yours.', wrongWord: 'than', answer: 'as' },
            { id: 'F25', sentence: 'This is as biggest of the three boxes.', wrongWord: 'as', answer: 'the' },
            { id: 'F26', sentence: 'This box is bigger as that one.', wrongWord: 'as', answer: 'than' },
            // F27 duplicated F8 and was explicitly excluded by the teacher.
            { id: 'F28', sentence: 'This is the most dangerous of all the sports. That sport is more dangerous the swimming.', wrongWord: 'the', wrongIndex: 14, answer: 'than' }
        ]
    };
    const pageCatalogs = { 'PU3:1:16': unit1Catalog, 'PU3:2:28': unit2Catalog, 'PU3:3:40': unit3Catalog, 'PU3:9:109': catalog };

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
