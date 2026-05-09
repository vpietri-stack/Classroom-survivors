// ============================================================
// SR ENGINE — Spaced Repetition Logic
// Pure utility module: no DOM or Phaser dependencies.
// Loaded before teaching_content.js and all game scripts.
// ============================================================

/**
 * Returns a normalised string key for any content item.
 *  - Strings (vocab, sentences): lowercased + trimmed
 *  - Sentence pairs {a, b}:      lowercased + trimmed question side (a)
 */
function itemKey(item) {
    if (!item) return '';
    if (typeof item === 'string') return item.trim().toLowerCase();
    if (item.a && item.b) return (item.a.trim() + " | " + item.b.trim()).toLowerCase();
    if (item.a) return item.a.trim().toLowerCase();
    return JSON.stringify(item).toLowerCase();
}

/**
 * Priority groups (lower = higher priority):
 *   0  failed during THIS game session (in-memory inSessionFailures set)
 *   1  failed last session (lastResult='failure', due this session or overdue)
 *   2  succeeded before, now due/overdue (lastResult='success', dueAfterSession <= currentSession)
 *   3  never seen (no SR state)
 *   4  in cooldown — EXCLUDED from selection (dueAfterSession > currentSession)
 *   5  succeeded THIS session — used only as absolute fallback
 *
 * @param {string} key            normalised item key
 * @param {Object} srTypeState    the per-type sub-object (e.g. srState.vocab)
 * @param {number} currentSession current session index
 * @param {Set}   [inSessionFailures] keys failed earlier in this game session
 * @param {Set}   [inSessionSuccesses] keys succeeded earlier in this game session
 * @returns {{ group: number, dueAfterSession: number|null }}
 */
function getSRPriority(key, srTypeState, currentSession, inSessionFailures, inSessionSuccesses) {
    if (inSessionFailures && inSessionFailures.has(key)) {
        return { group: 0, dueAfterSession: null };
    }

    if (inSessionSuccesses && inSessionSuccesses.has(key)) {
        return { group: 5, dueAfterSession: null };
    }

    const entry = srTypeState && srTypeState[key];
    if (!entry) {
        return { group: 3, dueAfterSession: null };
    }

    const { dueAfterSession, lastResult } = entry;

    if (dueAfterSession > currentSession) {
        return { group: 4, dueAfterSession };        // in cooldown
    }

    return {
        group: lastResult === 'failure' ? 1 : 2,
        dueAfterSession
    };
}

/** Fisher-Yates shuffle (in-place, returns array). */
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Annotates a pool of { item, key, pageAbsIndex } entries with priority,
 * filters out cooldown items (group 4), and returns a sorted copy.
 *
 * Within group 2: sorted by dueAfterSession DESC ("closeness" = most recently due first).
 * Within group 3: sorted by ascending page distance from activePageIndex.
 * Groups 0 and 1: randomly shuffled within the group.
 */
function sortPoolBySR(pool, srTypeState, currentSession, activePageIndex, inSessionFailures, inSessionSuccesses) {
    const annotated = pool.map(entry => ({
        ...entry,
        priority: getSRPriority(entry.key, srTypeState, currentSession, inSessionFailures, inSessionSuccesses)
    })).filter(e => e.priority.group !== 4);   // drop cooldown items

    const g0 = annotated.filter(e => e.priority.group === 0);
    const g1 = annotated.filter(e => e.priority.group === 1);
    const g2 = annotated.filter(e => e.priority.group === 2);
    const g3 = annotated.filter(e => e.priority.group === 3);
    const g5 = annotated.filter(e => e.priority.group === 5);

    shuffleArray(g0);
    shuffleArray(g1);
    g2.sort((a, b) => (b.priority.dueAfterSession || 0) - (a.priority.dueAfterSession || 0));
    
    // Group 3: Weighted random based on page distance
    g3.forEach(e => {
        const distance = Math.abs(e.pageAbsIndex - activePageIndex);
        // w = 0.2^distance -> ~90% chance for distance 0 to beat distance 1
        const weight = Math.pow(0.2, distance);
        e._randomScore = Math.random() * weight;
    });
    g3.sort((a, b) => b._randomScore - a._randomScore);
    
    shuffleArray(g5);

    return [...g0, ...g1, ...g2, ...g3, ...g5];
}

/**
 * Selects `count` items from a flat candidate pool using SR priority.
 *
 * @param {Array}  pool            [{ item, key, pageAbsIndex }, ...]
 * @param {number} count           how many items to return
 * @param {Object} srTypeState     e.g. authActiveUser.srState.vocab
 * @param {number} currentSession
 * @param {number} activePageIndex for page-proximity tie-breaking among unseen items
 * @param {Set}   [inSessionFailures]
 * @param {Set}   [inSessionSuccesses]
 * @returns {Array} raw item values (strings or pair objects)
 */
function selectItemsSR(pool, count, srTypeState, currentSession, activePageIndex, inSessionFailures, inSessionSuccesses) {
    if (!pool || pool.length === 0) return [];
    const sorted = sortPoolBySR(pool, srTypeState, currentSession, activePageIndex, inSessionFailures, inSessionSuccesses);
    return sorted.slice(0, count).map(e => e.item);
}

/**
 * Selects `count` sentence pairs from the highest-priority page.
 * Used for Round E sub-rounds and the game-mode sentence match minigame.
 *
 * Page priority = lowest priority group among that page's available items.
 * Tie-break: most items in the winning group → page proximity.
 *
 * @param {Array}  pagesWithItems  [{ pageAbsIndex, items: [{ item, key, pageAbsIndex }] }, ...]
 * @param {number} count           pairs to select (typically 3)
 * @param {Object} srTypeState     e.g. authActiveUser.srState.sentencePairs
 * @param {number} currentSession
 * @param {number} activePageIndex
 * @param {Set}   [excludePageIndices]  pages already used (E1/E2/E3 uniqueness)
 * @param {Set}   [inSessionFailures]
 * @param {Set}   [inSessionSuccesses]
 * @returns {{ pageAbsIndex: number, items: Array }|null}
 */
function selectSamePageSR(pagesWithItems, count, srTypeState, currentSession, activePageIndex, excludePageIndices, inSessionFailures, inSessionSuccesses) {
    const eligible = pagesWithItems.filter(
        p => !excludePageIndices || !excludePageIndices.has(p.pageAbsIndex)
    );
    if (eligible.length === 0) return null;

    const scored = eligible.map(p => {
        const sorted = sortPoolBySR(p.items, srTypeState, currentSession, activePageIndex, inSessionFailures, inSessionSuccesses);
        const bestGroup = sorted.length > 0 ? sorted[0].priority.group : 6;
        const bestGroupCount = sorted.filter(e => e.priority.group === bestGroup).length;
        const proximity = 1 / (Math.abs(p.pageAbsIndex - activePageIndex) + 1);
        
        let randomScore = 0;
        if (bestGroup === 3) {
            const distance = Math.abs(p.pageAbsIndex - activePageIndex);
            const weight = Math.pow(0.2, distance);
            randomScore = Math.random() * weight;
        }
        
        return { page: p, sorted, bestGroup, bestGroupCount, proximity, randomScore };
    });

    scored.sort((a, b) => {
        if (a.bestGroup !== b.bestGroup) return a.bestGroup - b.bestGroup;
        if (a.bestGroup === 3) return b.randomScore - a.randomScore;
        if (a.bestGroupCount !== b.bestGroupCount) return b.bestGroupCount - a.bestGroupCount;
        return b.proximity - a.proximity;
    });

    const winner = scored[0];
    return {
        pageAbsIndex: winner.page.pageAbsIndex,
        items: winner.sorted.slice(0, count).map(e => e.item)
    };
}

/**
 * Computes the updated srState after a session ends.
 *
 * Rules:
 *   first attempt success → interval = prev_interval + 1 (or 2 if never seen / after failure)
 *                           dueAfterSession = currentSession + newInterval
 *   failure               → interval unchanged (will reset on next success)
 *                           dueAfterSession = currentSession + 1
 *
 * @param {Object} srState        full SR state { vocab:{}, sentences:{}, sentencePairs:{} }
 * @param {Array}  sessionResults [{ type:'vocab'|'sentences'|'sentencePairs', key, firstAttempt:bool }, ...]
 * @param {number} currentSession session index that just completed
 * @returns {Object} new srState (does not mutate input)
 */
function updateSRStateForSession(srState, sessionResults, currentSession) {
    const newState = {
        vocab: Object.assign({}, (srState || {}).vocab || {}),
        sentences: Object.assign({}, (srState || {}).sentences || {}),
        sentencePairs: Object.assign({}, (srState || {}).sentencePairs || {})
    };

    (sessionResults || []).forEach(({ type, key, firstAttempt }) => {
        if (!type || !key || !newState[type]) return;

        const existing = newState[type][key];

        if (firstAttempt) {
            const prevResult = existing && existing.lastResult;
            const prevInterval = existing && existing.interval || 0;
            // Consecutive successes double the interval; failure or first-time resets to 2
            const newInterval = (prevResult === 'success' && prevInterval >= 2)
                ? prevInterval * 2
                : 2;
            newState[type][key] = {
                interval: newInterval,
                dueAfterSession: currentSession + newInterval,
                lastSession: currentSession,
                lastResult: 'success'
            };
        } else {
            const prevInterval = existing && existing.interval || 2;
            newState[type][key] = {
                interval: prevInterval,   // will be overridden to 2 on next success
                dueAfterSession: currentSession + 1,
                lastSession: currentSession,
                lastResult: 'failure'
            };
        }
    });

    return newState;
}
