# Teaching Content Reorganization - Summary of Changes

## Changes Implemented

### 1. ✅ Randomized Power-Up Assignment
**Previous behavior:** 
- Left power-up = spelling
- Middle power-up = sight word  
- Right power-up = sentence scramble

**New behavior:**
- Game types (spelling, sight word, grammar) are now randomly assigned to the three power-up cards each time
- Each power-up has an equal chance of getting any minigame type

**Code change:** Line 1039 in `game.js`
```javascript
const gameTypes = ['spelling', 'wordrec', 'scramble'].sort(() => 0.5 - Math.random());
```

---

### 2. ✅ Adjusted Teaching Content Difficulty

#### Spelling Game
**Previous:** Number of missing letters scaled with player level
**New:** ALWAYS requires arranging ALL letters of the word

**Code change:** Line 1141 in `game.js`
```javascript
// Always use ALL letters - no level-based scaling
let missingCount = totalChars;
```

#### Sight Word Game
**Previous:** 2-4 words depending on player level
**New:** ALWAYS displays 5 different words

**Code change:** Line 1266 in `game.js`
```javascript
// Always show 5 words - no level-based scaling
let choiceCount = 5;
```

#### Grammar Sentence Game
**Previous:** Number of blank words scaled with player level
**New:** ALWAYS requires placing ALL words in the sentence

**Code change:** Line 1348 in `game.js`
```javascript
// Always use ALL words - no level-based scaling
let numBlanks = tokens.length;
```

---

### 3. ✅ Power-Up Reward Logic

**Spelling & Grammar:**
- ✅ Players now get the power-up for subsequent tries
- As long as they eventually answer correctly, they get the reward
- More forgiving for complex spelling words and long sentences

**Sight Words:**
- ✅ Keeps current logic: only get power-up on first try AND within time limit
- Maintains challenge and importance of quick word recognition

**Code change:** Lines 1445-1448 in `game.js`
```javascript
// New reward logic:
// - Spelling and Grammar: always give reward if answered correctly (even on subsequent tries)
// - Sight words (rec): only give reward on first try within time limit
const shouldGiveReward = (gameType === 'spelling' || gameType === 'grammar') || isFirstAttempt;
```

---

### 4. ✅ Time Penalty System

**New mechanic:** Time spent answering teaching questions is deducted from survival time
- If player survived 60 seconds and took 20 seconds to answer, survival time becomes 40 seconds
- Time cannot go negative (minimum is 0 seconds)
- Applies to ALL teaching question types

**Code changes:**
- Lines 1022-1023: Track minigame start time
- Lines 1073-1074: Record timestamp when minigame starts  
- Lines 1086-1094: Calculate and apply time penalty

```javascript
// Calculate time penalty
const timeSpentMs = Date.now() - minigameStartTime;
const timeSpentSec = Math.floor(timeSpentMs / 1000);

// Apply time penalty - deduct from accumulated time (can't go below 0)
if (scene) {
    scene.accumulatedTime = Math.max(0, scene.accumulatedTime - (timeSpentSec * 1000));
    updateDOMHUD(scene.playerStats, Math.floor(scene.accumulatedTime / 1000), scene.killCount);
}
```

---

## Testing Recommendations

1. **Test randomization:** Level up multiple times and verify minigame types are randomly distributed
2. **Test spelling difficulty:** Try with short and long words - all letters should be blank
3. **Test sight word difficulty:** Should always see exactly 5 word choices
4. **Test grammar difficulty:** All words in the sentence should be draggable blanks
5. **Test spelling rewards:** Make intentional errors, then correct - should still get power-up
6. **Test grammar rewards:** Make intentional errors, then correct - should still get power-up  
7. **Test sight word rewards:** Try after time runs out or after wrong answer - should NOT get power-up
8. **Test time penalty:** Check that survival time decreases by the amount spent in minigames

---

## File Modified
- `D:\coding\html games\Classroom-survivors\game.js`
