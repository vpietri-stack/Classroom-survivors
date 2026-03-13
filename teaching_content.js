const TEACHING_CONTENT = {};
const AVAILABLE_CONTENT = {};


/**
 * Spaced Repetition Logic Helpers
 */

const BOOK_SERIES = {
    "PU1": ["PU1"],
    "PU2": ["PU2"],
    "PU3": ["PU3"],
    "Think0": ["Think0"],
    "Think1": ["Think1"]
};

/**
 * Returns a sorted array of all pages in a book series: [{book, unit, page, absIndex}, ...]
 * Based on the order in AVAILABLE_CONTENT and the series defined in BOOK_SERIES.
 */
function getSortedPagesForBook(book) {
    const series = BOOK_SERIES[book] || [book];
    const sorted = [];
    let absIndex = 0;

    series.forEach(b => {
        if (!AVAILABLE_CONTENT[b]) return;
        const units = Object.keys(AVAILABLE_CONTENT[b]).sort((a, b) => parseInt(a) - parseInt(b));
        units.forEach(unit => {
            const pages = AVAILABLE_CONTENT[b][unit].sort((a, b) => parseInt(a) - parseInt(b));
            pages.forEach(page => {
                sorted.push({ book: b, unit, page: page.toString(), absIndex: absIndex++ });
            });
        });
    });
    return sorted;
}

/**
 * Weighted random selection from an array of indices.
 * weights: array of numbers corresponding to items.
 */
function getWeightedRandomIndex(weights) {
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    for (let i = 0; i < weights.length; i++) {
        if (random < weights[i]) return i;
        random -= weights[i];
    }
    return weights.length - 1;
}

/**
 * Picks N unique items from a pool of pages.
 * if useWeights is true, it uses linear weighting based on proximity to activePageIndex.
 * pages: array of {unit, page, absIndex} objects
 */
function pickUniqueItems(pages, count, type, activePageIndex, useWeights = false) {
    const allItems = [];
    const seenIdentifier = new Set(); // Track unique items by content to avoid showing the same question twice

    pages.forEach((p) => {
        const content = TEACHING_CONTENT[p.book] && TEACHING_CONTENT[p.book][p.unit] && TEACHING_CONTENT[p.book][p.unit][p.page];
        if (content && content[type]) {
            const items = content[type];
            items.forEach(item => {
                // Generate identifier based on item content
                let identifier = "";
                if (typeof item === 'string') {
                    // Normalize vocab/sentence text
                    identifier = item.trim().toLowerCase();
                } else if (item && item.a && item.b) {
                    // For sentence pairs, deduplicate based on question (a)
                    identifier = "pair:" + item.a.trim().toLowerCase();
                } else {
                    identifier = JSON.stringify(item);
                }

                if (!seenIdentifier.has(identifier)) {
                    seenIdentifier.add(identifier);
                    allItems.push({ item, pageIndex: p.absIndex });
                }
            });
        }
    });

    if (allItems.length === 0) return [];

    const selected = [];
    const pool = [...allItems];

    for (let i = 0; i < count && pool.length > 0; i++) {
        let index;
        if (useWeights) {
            // Weights based on distance to activePageIndex
            const weights = pool.map(entry => {
                const distance = Math.abs(entry.pageIndex - activePageIndex);
                return 1 / Math.pow(distance + 1, 2);
            });
            index = getWeightedRandomIndex(weights);
        } else {
            index = Math.floor(Math.random() * pool.length);
        }
        selected.push(pool[index].item);
        pool.splice(index, 1);
    }

    return selected;
}

/**
 * Main function to get content based on Spaced Repetition logic.
 */
function getSpacedRepetitionContent(book, unit, page, type, isStudyMode, count = 5) {
    const sortedPages = getSortedPagesForBook(book);
    const activePageIndex = sortedPages.findIndex(p => p.book === book && p.unit === unit && p.page === page.toString());

    if (activePageIndex === -1) {
        // Fallback logic
        const content = TEACHING_CONTENT[book] && TEACHING_CONTENT[book][unit] && TEACHING_CONTENT[book][unit][page];
        return content ? (content[type] || []) : [];
    }

    if (isStudyMode) {
        // Study Mode: ~60% from Recent, ~40% from Review
        const countRecent = Math.ceil(count * 0.6);
        const countReview = count - countRecent;

        // Recent Pool: current page (activePageIndex) and the page immediately preceding it.
        const recentPageIndices = [activePageIndex];
        if (activePageIndex > 0) recentPageIndices.push(activePageIndex - 1);

        const recentPages = recentPageIndices.map(idx => sortedPages[idx]);
        let recentItems = pickUniqueItems(recentPages, countRecent, type, activePageIndex, false);

        // Review Pool: all other previous pages
        const reviewPageIndices = [];
        for (let i = 0; i < activePageIndex - 1; i++) {
            reviewPageIndices.push(i);
        }

        if (reviewPageIndices.length === 0) {
            // Edge case: no review pages, pull more from recent if possible
            if (recentItems.length < count) {
                const moreRecent = pickUniqueItems(recentPages, count - recentItems.length, type, activePageIndex, false);
                // Filter duplicates
                moreRecent.forEach(item => {
                    if (!recentItems.includes(item)) recentItems.push(item);
                });
            }
            return recentItems.slice(0, count);
        }

        const reviewPages = reviewPageIndices.map(idx => sortedPages[idx]);
        // Weight review pages based on index (closer to current = higher weight)
        const reviewItems = pickUniqueItems(reviewPages, countReview, type, activePageIndex, true);

        // Combine and ensure no duplicates
        const finalSet = [...recentItems];
        reviewItems.forEach(item => {
            if (finalSet.length < count && !finalSet.includes(item)) {
                finalSet.push(item);
            }
        });

        // If still not enough, fill from recent again (avoiding dupes)
        if (finalSet.length < count) {
            const allRecent = pickUniqueItems(recentPages, count * 2, type, activePageIndex, false);
            allRecent.forEach(item => {
                if (finalSet.length < count && !finalSet.includes(item)) finalSet.push(item);
            });
        }

        return finalSet;
    } else {
        // Game Mode: Return metadata so game.js can handle it
        const gamePageIndices = [];
        for (let i = 0; i <= activePageIndex; i++) {
            gamePageIndices.push(i);
        }
        return gamePageIndices.map(idx => sortedPages[idx]);
    }
}

/**
 * Picks a single item for Game Mode based on weighted probability.
 */
function getWeightedItemForGame(book, unit, page, type) {
    const sortedPages = getSortedPagesForBook(book);
    const activePageIndex = sortedPages.findIndex(p => p.book === book && p.unit === unit && p.page === page.toString());

    if (activePageIndex === -1) {
        const content = TEACHING_CONTENT[book] && TEACHING_CONTENT[book][unit] && TEACHING_CONTENT[book][unit][page];
        const items = content ? (content[type] || []) : [];
        return items[Math.floor(Math.random() * items.length)];
    }

    const gamePageIndices = [];
    for (let i = 0; i <= activePageIndex; i++) {
        gamePageIndices.push(i);
    }
    const gamePages = gamePageIndices.map(idx => sortedPages[idx]);

    // Use pickUniqueItems with count=1 and useWeights=true
    const items = pickUniqueItems(gamePages, 1, type, activePageIndex, true);
    return items[0];
}
