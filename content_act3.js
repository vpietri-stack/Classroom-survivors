// Act3 curriculum content & syllable-gap metadata
TEACHING_CONTENT["Act3"] = {
    "1": {
        "3": {
            vocab: [
                "morning", "afternoon", "evening", "airport", "library",
                "supermarket", "zoo", "museum", "good", "where",
                "are", "you", "going", "we", "to",
                "the", "me", "too", "how", "about"
            ],
            sentences: [
                "Good morning!",
                "Good afternoon!",
                "Good evening!",
                "Where are you going?",
                "We're going to the zoo.",
                "We're going to the library.",
                "We're going to the museum.",
                "We're going to the airport.",
                "We're going to the supermarket.",
                "How about you?",
                "Me, too!"
            ]
        },
        "4": {
            vocab: [
                "bakery", "fire station", "hospital", "toy store", "police station",
                "is", "it's", "next to", "school"
            ],
            sentences: [
                "Where is the bakery?",
                "Where is the fire station?",
                "Where is the hospital?",
                "Where is the toy store?",
                "Where is the police station?",
                "It's next to the school.",
                "It's next to the hospital.",
                "It's next to the museum.",
                "It's next to the library."
            ]
        },
        "5": {
            vocab: [
                "pilot", "librarian", "shop assistant", "zookeeper", "guide",
                "baker", "this", "what", "does", "he",
                "she", "do"
            ],
            sentences: [
                "What does he do?",
                "What does she do?",
                "He's a pilot.",
                "She's a librarian.",
                "He's a zookeeper.",
                "She's a guide.",
                "He's a baker.",
                "She's a shop assistant."
            ]
        },
        "6": {
            vocab: [
                "firefighter", "doctor", "cashier", "police officer", "teacher",
                "who", "see"
            ],
            sentences: [
                "Who are you going to see?",
                "We're going to see a guide.",
                "We're going to see a librarian.",
                "We're going to see a firefighter.",
                "We're going to see a doctor.",
                "He's a firefighter.",
                "She's a doctor.",
                "He's a cashier.",
                "He's a police officer."
            ]
        }
    },
    "2": {
        "11": {
            vocab: [
                "classroom", "classmate", "chair", "board", "book",
                "hi", "our", "my", "look", "at"
            ],
            sentences: [
                "We're classmates.",
                "This is our classroom.",
                "This is our library.",
                "This is our teacher.",
                "This is our school.",
                "This is my chair.",
                "This is my classmate.",
                "Look at the books!"
            ]
        },
        "12": {
            vocab: [
                "quiet", "run", "walk", "open", "close",
                "pick up", "slowly", "be", "don't", "your",
                "listen", "marker", "have"
            ],
            sentences: [
                "Be quiet.",
                "Don't run.",
                "Walk slowly.",
                "Open your books.",
                "Close your books.",
                "Pick up a marker.",
                "Listen to your teacher!",
                "I have a book."
            ]
        },
        "13": {
            vocab: [
                "eraser", "glue stick", "notebook", "crayon", "backpack",
                "red", "yellow", "blue", "green", "orange",
                "purple", "big", "small", "no", "isn't",
                "color"
            ],
            sentences: [
                "Is this your backpack?",
                "Is this your eraser?",
                "Yes, it is.",
                "No, it isn't.",
                "My backpack isn't blue.",
                "My backpack is red.",
                "What color is your eraser?",
                "My eraser is yellow.",
                "My notebook is big.",
                "My glue stick is small."
            ]
        },
        "14": {
            vocab: [
                "hello", "boys", "girls", "and", "new",
                "nice", "meet", "show", "thank you", "pencil"
            ],
            sentences: [
                "Hello, boys and girls.",
                "This is our new classmate.",
                "Nice to meet you.",
                "Nice to meet you, too.",
                "This is our board.",
                "We have notebooks.",
                "We have markers.",
                "This is your chair.",
                "My backpack is big and blue."
            ]
        }
    }
};

AVAILABLE_CONTENT["Act3"] = {
    "1": ["3", "4", "5", "6"],
    "2": ["11", "12", "13", "14"]
};

const ACT3_ILLUSTRATED_WORDS = new Set([
    "are", "you", "going", "we", "to", "the", "me", "too", "how", "about",
    "bakery", "toy store", "is", "it's", "pilot", "librarian", "shop assistant", "zookeeper",
    "guide", "baker", "this", "does", "he", "she", "cashier",
    "hi", "our", "my", "at", "be", "your", "marker", "have",
    "glue stick", "no", "isn't", "color", "hello", "boys", "girls", "and", "meet", "thank you", "show"
]);
// Keep each revised image on its own cache version.
const ACT3_ILLUSTRATION_VERSIONS = {
    "be": 2, "does": 2, "have": 2, "is": 2, "it's": 2, "thank you": 3
};
const ACT3_SENTENCES = new Set(Object.values(TEACHING_CONTENT.Act3)
    .flatMap(unit => Object.values(unit).flatMap(page => page.sentences)));

function getAct3VocabImagePath(word) {
    const key = word.trim().toLowerCase();
    if (!ACT3_ILLUSTRATED_WORDS.has(key)) return '';
    const version = ACT3_ILLUSTRATION_VERSIONS[key];
    const query = version ? '?v=' + version : '';
    return 'media/act3/vocab/' + key.replace(/ /g, '-') + '.webp' + query;
}

function getAct3SentenceAudioPath(sentence) {
    const key = sentence.trim();
    return ACT3_SENTENCES.has(key) ? 'media/act3/sentences/' + key.replace(/[\\/:*?"<>|]/g, '') + '.mp3' : '';
}

const ACT3_TRANSLATIONS = {
    "about": "关于；……呢？（How about…?）",
    "at": "（look at 中）看向",
    "board": "黑板；白板",
    "does": "（用于 he、she 等的疑问句）",
    "do": "做；从事（工作）",
    "going": "去；要去",
    "it's": "它是；它在",
    "nice": "好的；令人愉快的",
    "orange": "橙色；橙色的",
    "see": "看见；去见",
    "show": "给……看；展示",
    "the": "这个；那个（指特定的人或事物）",
    "Who are you going to see?": "你们要去见谁？",
    "We're going to see a guide.": "我们要去见一位向导。",
    "We're going to see a librarian.": "我们要去见一位图书管理员。",
    "We're going to see a firefighter.": "我们要去见一位消防员。",
    "We're going to see a doctor.": "我们要去见一位医生。",
    "Pick up a marker.": "拿起一支马克笔。",
    "Hello, boys and girls.": "同学们，大家好！",
    "My backpack is big and blue.": "我的书包很大，是蓝色的。"
};

// Exact 0-based character indices of target letters for Act3 Rounds B (handwriting)
// and C (missing letters): first letter of each syllable, or first 2 letters for
// single-syllable words.
const ACT3_GAP_INDICES = {
    // Page 3 (Topic 1.1)
    "morning": [0, 3],
    "afternoon": [0, 2, 5],
    "evening": [0, 3],
    "airport": [0, 3],
    "library": [0, 2],
    "supermarket": [0, 2, 5, 8],
    "zoo": [0, 1],
    "museum": [0, 2, 4],
    "good": [0, 1],
    "where": [0, 3],
    "are": [0, 1],
    "you": [0, 1],
    "going": [0, 2],
    "we": [0, 1],
    "to": [0, 1],
    "the": [0, 1],
    "me": [0, 1],
    "too": [0, 1],
    "how": [0, 1],
    "about": [0, 1],

    // Page 4 (Topic 1.2)
    "bakery": [0, 2, 4],
    "fire station": [0, 5, 8],
    "hospital": [0, 3, 5],
    "toy store": [0, 4],
    "police station": [0, 2, 7, 10],
    "is": [0, 1],
    "it's": [0, 3],
    "next to": [0, 5],
    "school": [0, 1],

    // Page 5 (Topic 1.3)
    "pilot": [0, 2],
    "librarian": [0, 2, 5, 7],
    "shop assistant": [0, 5, 7, 10],
    "zookeeper": [0, 3, 6],
    "guide": [0, 1],
    "baker": [0, 2],
    "this": [0, 1],
    "what": [0, 1],
    "does": [0, 1],
    "he": [0, 1],
    "she": [0, 1],
    "do": [0, 1],

    // Page 6 (Topic 1.4)
    "firefighter": [0, 4, 8],
    "doctor": [0, 3],
    "cashier": [0, 2],
    "police officer": [0, 2, 7, 9, 11],
    "teacher": [0, 3],
    "who": [0, 1],
    "see": [0, 1],

    // Page 11 (Topic 2.1)
    "classroom": [0, 5],
    "classmate": [0, 5],
    "chair": [0, 1],
    "board": [0, 1],
    "book": [0, 1],
    "hi": [0, 1],
    "our": [0, 1],
    "my": [0, 1],
    "look": [0, 1],
    "at": [0, 1],

    // Page 12 (Topic 2.2)
    "quiet": [0, 3],
    "run": [0, 1],
    "walk": [0, 1],
    "open": [0, 1],
    "close": [0, 1],
    "pick up": [0, 5],
    "slowly": [0, 4],
    "be": [0, 1],
    "don't": [0, 4],
    "your": [0, 1],
    "listen": [0, 2],
    "marker": [0, 3],
    "have": [0, 1],

    // Page 13 (Topic 2.3)
    "eraser": [0, 1, 3],
    "glue stick": [0, 5],
    "notebook": [0, 4],
    "crayon": [0, 4],
    "backpack": [0, 4],
    "red": [0, 1],
    "yellow": [0, 3],
    "blue": [0, 1],
    "green": [0, 1],
    "orange": [0, 2],
    "purple": [0, 3],
    "big": [0, 1],
    "small": [0, 1],
    "no": [0, 1],
    "isn't": [0, 2],
    "color": [0, 2],

    // Page 14 (Topic 2.4)
    "hello": [0, 3],
    "boys": [0, 1],
    "girls": [0, 1],
    "and": [0, 1],
    "new": [0, 1],
    "nice": [0, 1],
    "meet": [0, 1],
    "show": [0, 1],
    "thank you": [0, 6],
    "pencil": [0, 3]
};

/**
 * Returns sorted 0-based letter indices to practice in Act3 Rounds B and C.
 * Falls back to the first two letter indices if an unmapped word is supplied.
 */
function getAct3GapIndices(word) {
    const raw = String(word || '');
    const key = raw.trim().toLowerCase();
    const mapped = ACT3_GAP_INDICES[key];
    if (Array.isArray(mapped) && mapped.length > 0) {
        return mapped.filter(i => Number.isInteger(i) && i >= 0 && i < raw.length && /[a-z0-9]/i.test(raw[i]));
    }
    const fallback = [];
    for (let i = 0; i < raw.length && fallback.length < 2; i++) {
        if (/[a-z0-9]/i.test(raw[i])) fallback.push(i);
    }
    return fallback;
}

/** Keep the authored gaps and fill to three using distinct letter positions. */
function getAct3MissingLetterIndices(word) {
    const gaps = getAct3GapIndices(word);
    const available = [...word].flatMap((letter, index) =>
        /[a-z]/i.test(letter) && !gaps.includes(index) ? [index] : []);
    for (; gaps.length < 3 && available.length;) {
        const next = Math.floor(Math.random() * available.length);
        gaps.push(available.splice(next, 1)[0]);
    }
    return gaps.sort((a, b) => a - b);
}
