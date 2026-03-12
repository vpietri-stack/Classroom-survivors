const fs = require('fs');

// Read the current translations.js
const content = fs.readFileSync('translations.js', 'utf8');

// Parse ALL key-value pairs, handling both properly formatted and malformed multi-key lines
const allTranslations = {};

const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line || line.startsWith('//') || line === 'const LOCAL_TRANSLATIONS = {' || line === '};') continue;

    // Check if this is a malformed multi-key line like: "name": "名字', 'age': '年龄', ..."
    // These lines pack multiple translations in one line as a string value
    const multiMatch = line.match(/^"([^"]+)":\s*"(.+)"[,]?$/);
    if (multiMatch) {
        const firstKey = multiMatch[1];
        const fullValue = multiMatch[2];
        
        // Check if it contains embedded key-value pairs
        if (fullValue.includes("': '")) {
            // Parse the embedded pairs
            // The first key's value is before the first ', '
            const parts = (firstKey + "': '" + fullValue).split("', '");
            for (let j = 0; j < parts.length - 1; j += 2) {
                let k = parts[j].replace(/^'/, '');
                let v = parts[j + 1] || '';
                if (k && v) {
                    allTranslations[k] = v;
                }
            }
            // Try a different parsing approach for these complex lines
            // Actually let's parse them as: key1': 'val1', 'key2': 'val2  
            const rawStr = firstKey + "': '" + fullValue;
            const pairRegex = /([^']+)'\s*:\s*'([^']*)/g;
            let pm;
            while ((pm = pairRegex.exec(rawStr)) !== null) {
                let k = pm[1].replace(/^,\s*'?/, '').replace(/^\s*'/, '').trim();
                let v = pm[2].trim();
                if (k && v) {
                    allTranslations[k] = v;
                }
            }
            continue;
        }
    }

    // Normal JSON-like line: "key": "value", or with escaped quotes
    const normalMatch = line.match(/^("(?:[^"\\]|\\.)*")\s*:\s*("(?:[^"\\]|\\.)*")[,]?\s*$/);
    if (normalMatch) {
        try {
            let key = JSON.parse(normalMatch[1]);
            let value = JSON.parse(normalMatch[2]);
            if (key && value) {
                allTranslations[key] = value;
            }
        } catch(e) {}
        continue;
    }
}

console.log("Total unique entries parsed:", Object.keys(allTranslations).length);

// Now categorize everything
const categories = {
    // --- NOUNS ---
    'School Supplies': {},
    'Classroom Furniture & Room Parts': {},
    'Animals': {},
    'Body Parts': {},
    'Family': {},
    'Food & Drinks': {},
    'Toys & Games': {},
    'Vehicles & Transport': {},
    'Clothes & Accessories': {},
    'Places & Nature': {},
    'Shapes': {},
    'Other Nouns': {},
    
    // --- OTHER WORD TYPES ---
    'Colors': {},
    'Numbers & Articles': {},
    'Pronouns & Determiners': {},
    'Verbs & Actions': {},
    'Adjectives & Descriptions': {},
    'Prepositions & Adverbs': {},
    'Question Words & Phrases': {},
    'Common Expressions': {},
    'Time & Days': {},
    
    // --- SENTENCES ---
    'Sentences': {}
};

const schoolSupplies = ['rubber', 'pencil', 'pen', 'book', 'crayon', 'pencil case', 'ruler', 'paper', 'bag', 'notebook'];
const classroomFurniture = ['desk', 'chair', 'table', 'door', 'wall', 'window', 'board', 'cupboard', 'bookcase', 'floor', 'shelf', 'shelves'];
const animals = ['cat', 'dog', 'duck', 'rooster', 'hen', 'cow', 'donkey', 'horse', 'spider', 'sheep', 'goat', 'bee', 'bear', 'polar bear', 'snake', 'crocodile', 'monkey', 'tiger', 'elephant', 'lizard', 'giraffe', 'hippo', 'zebra', 'penguin', 'flamingo', 'lion', 'panda', 'rhino', 'whale', 'jellyfish', 'chameleon', 'frog', 'mouse', 'animal', 'pet', 'chicken', 'twin', 'twins'];
const bodyParts = ['head', 'ear', 'ears', 'eyes', 'eye', 'mouth', 'nose', 'hair', 'face', 'tail', 'hand', 'hands', 'arm', 'arms', 'leg', 'legs', 'foot', 'feet', 'body', 'neck'];
const family = ['family', 'father', 'dad', 'mother', 'mum', 'brother', 'sister', 'grandfather', 'grandpa', 'grandmother', 'grandma', 'cousin', 'baby', 'Mr.', 'Ms.', 'Grandpa', 'Grandma', 'Dad', 'Mum', 'Tom'];
const foodDrinks = ['lemonade', 'bananas', 'banana', 'mango', 'mangoes', 'grapes', 'juice', 'sausages', 'meatballs', 'beans', 'carrots', 'eggs', 'honey', 'wool', 'food', 'milk', 'bread', 'burger', 'cake', 'cheese', 'chocolate', 'egg', 'fruit', 'meat', 'onion', 'pasta', 'potato', 'rice', 'salad', 'tomatoes', 'vegetable'];
const toysGames = ['ball', 'kite', 'plane', 'doll', 'keyboard', 'toy box', 'balloon', 'balloons', 'radio', 'helicopter', 'teddy', 'teddy bear', 'board game', 'ship', 'monster', 'alien', 'present', 'robot', 'card', 'computer', 'game'];
const vehicles = ['bus', 'lorry', 'truck', 'motorbike', 'car', 'bus stop'];
const clothes = ['cap', 'shorts', 'sunglasses', 'clothes', 'T-shirt', 'hat', 'jacket', 'jeans', 'dress'];
const places = ['school', 'classroom', 'playground', 'park', 'zoo', 'house', 'street', 'tree', 'flower', 'jungle', 'grassland', 'ice', 'ocean', 'leaf', 'land', 'garden'];
const shapes = ['Shapes', 'circle', 'square', 'triangle', 'rectangle'];
const colors = ['red', 'blue', 'yellow', 'green', 'orange', 'purple', 'pink', 'grey', 'black', 'white', 'brown'];
const numbers = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'a', 'an', 'the'];
const pronouns = ['I', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'this', 'that', 'these', 'those', 'who', 'what', 'where'];
const verbs = ['is', 'are', 'have', 'has', 'got', 'move', 'touch', 'close', 'open', 'clap', 'play', 'run', 'running', 'jump', 'jumping', 'eat', 'eating', 'swim', 'swimming', 'ride', 'riding', 'watch', 'watching', 'clean', 'cleaning', 'paint', 'painting', 'do', 'doing', 'smile', 'smiling', 'can', 'want', 'wear', 'wearing', 'look', 'looks', 'help', 'listen', 'share', 'hear', 'see', 'come', 'comes', 'count', 'take', 'put', 'stand up', 'sit down', 'pick up', 'guessing', 'playing'];
const adjectives = ['big', 'small', 'long', 'short', 'tall', 'thin', 'young', 'beautiful', 'ugly', 'new', 'old', 'clean', 'dirty', 'scary', 'funny', 'nice', 'sad', 'cool', 'great'];
const prepositions = ['in', 'on', 'under', 'next to', 'at', 'from', 'with', 'for', 'to', 'of', 'up', 'there', 'here'];
const questionWords = ["what's", "where's", "who's", "how", "how many"];
const expressions = ['yes', 'no', 'ok', 'OK.', 'please', 'thank', 'thank you', 'sorry', 'hello', 'hi', 'not', 'too', 'now', 'and', 'but I don\'t'];

for (let key in allTranslations) {
    let value = allTranslations[key];
    let placed = false;
    
    // Sentences (longer strings with spaces + punctuation)
    if (key.length > 15 || (key.includes(' ') && (key.includes('.') || key.includes('?') || key.includes('!')))) {
        categories['Sentences'][key] = value;
        placed = true;
        continue;
    }
    
    // Try to place in noun categories
    if (schoolSupplies.includes(key)) { categories['School Supplies'][key] = value; placed = true; }
    else if (classroomFurniture.includes(key)) { categories['Classroom Furniture & Room Parts'][key] = value; placed = true; }
    else if (animals.includes(key)) { categories['Animals'][key] = value; placed = true; }
    else if (bodyParts.includes(key)) { categories['Body Parts'][key] = value; placed = true; }
    else if (family.includes(key)) { categories['Family'][key] = value; placed = true; }
    else if (foodDrinks.includes(key)) { categories['Food & Drinks'][key] = value; placed = true; }
    else if (toysGames.includes(key)) { categories['Toys & Games'][key] = value; placed = true; }
    else if (vehicles.includes(key)) { categories['Vehicles & Transport'][key] = value; placed = true; }
    else if (clothes.includes(key)) { categories['Clothes & Accessories'][key] = value; placed = true; }
    else if (places.includes(key)) { categories['Places & Nature'][key] = value; placed = true; }
    else if (shapes.includes(key)) { categories['Shapes'][key] = value; placed = true; }
    else if (colors.includes(key)) { categories['Colors'][key] = value; placed = true; }
    else if (numbers.includes(key)) { categories['Numbers & Articles'][key] = value; placed = true; }
    else if (pronouns.includes(key)) { categories['Pronouns & Determiners'][key] = value; placed = true; }
    else if (verbs.includes(key)) { categories['Verbs & Actions'][key] = value; placed = true; }
    else if (adjectives.includes(key)) { categories['Adjectives & Descriptions'][key] = value; placed = true; }
    else if (prepositions.includes(key)) { categories['Prepositions & Adverbs'][key] = value; placed = true; }
    else if (expressions.includes(key)) { categories['Common Expressions'][key] = value; placed = true; }
    
    if (!placed) {
        // Try verb-like phrases   
        if (key.startsWith('play ') || key.startsWith('ride ') || key.startsWith('watch ') || key.startsWith('listen') || key.startsWith('work ') || key.includes(' got') || key.startsWith('I ') || key.startsWith('he ') || key.startsWith('she ') || key.startsWith('they ') || key.startsWith('we ') || key.startsWith('you ') || key.startsWith('it ') || key.endsWith(' like') || key.endsWith(' likes')) {
            categories['Verbs & Actions'][key] = value;
        } else if (key.includes("n't") || key.includes("'re") || key.includes("'s") || key.includes("'ve") || key.includes("'m")) {
            // Contractions - likely verb phrases or expressions
            categories['Common Expressions'][key] = value;
        } else if (key.length <= 15 && !key.includes(' ')) {
            // Single short words that weren't categorized - likely nouns
            categories['Other Nouns'][key] = value;
        } else {
            categories['Common Expressions'][key] = value;
        }
    }
}

// Build output
let output = '// Master translation file for Classroom Survivors\n';
output += '// Contains simplified Chinese translations for vocabulary and sentences\n\n';
output += 'const LOCAL_TRANSLATIONS = {\n';

const catOrder = [
    'School Supplies', 'Classroom Furniture & Room Parts', 'Animals', 'Body Parts',
    'Family', 'Food & Drinks', 'Toys & Games', 'Vehicles & Transport',
    'Clothes & Accessories', 'Places & Nature', 'Shapes', 'Other Nouns',
    'Colors', 'Numbers & Articles', 'Pronouns & Determiners',
    'Verbs & Actions', 'Adjectives & Descriptions', 'Prepositions & Adverbs',
    'Question Words & Phrases', 'Common Expressions', 'Time & Days',
    'Sentences'
];

let totalEntries = 0;
for (let cat of catOrder) {
    let entries = categories[cat];
    let keys = Object.keys(entries).sort();
    if (keys.length === 0) continue;
    
    output += `\n    // --- ${cat} ---\n`;
    for (let key of keys) {
        output += `    ${JSON.stringify(key)}: ${JSON.stringify(entries[key])},\n`;
        totalEntries++;
    }
}

output += '};\n';

fs.writeFileSync('translations.js', output);
console.log(`Wrote ${totalEntries} unique entries to translations.js (organized in ${catOrder.length} categories)`);
