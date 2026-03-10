import os
import re

# List of files in audio_mp3
audio_files = [
    "Here you are.mp3", "I am.mp3", "I don't like.mp3", "I haven't got.mp3", "I like.mp3",
    "I'm not.mp3", "I've got.mp3", "No, I don't.mp3", "No, he doesn't.mp3", "No, she doesn't.mp3",
    "Yes. I do.mp3", "Yes. he does.mp3", "Yes. she does.mp3", "arrive arrived.mp3", "ask asked.mp3",
    "become became.mp3", "board game.mp3", "boil boiled.mp3", "bus stop.mp3", "buy bought.mp3",
    "carry carried.mp3", "catch caught.mp3", "come came.mp3", "cook cooked.mp3", "cry cried.mp3",
    "dance danced.mp3", "decide decided.mp3", "do did.mp3", "draw drew.mp3", "drink drank.mp3",
    "drop dropped.mp3", "eat ate.mp3", "feel felt.mp3", "find found.mp3", "fly flew.mp3",
    "fry fried.mp3", "get got.mp3", "give gave.mp3", "go went.mp3", "guessing game.mp3",
    "hasn't got.mp3", "hate hated.mp3", "have got.mp3", "have had.mp3", "haven't got.mp3",
    "he doesn't like.mp3", "he hasn't got.mp3", "he is.mp3", "he isn't.mp3", "he likes.mp3",
    "he's got.mp3", "help helped.mp3", "it hasn't got.mp3", "it is.mp3", "it isn't.mp3",
    "it's got.mp3", "know knew.mp3", "leave left.mp3", "like liked.mp3", "listen to music.mp3",
    "listening to music.mp3", "live lived.mp3", "look looked.mp3", "lose lost.mp3", "love loved.mp3",
    "make made.mp3", "meet met.mp3", "move moved.mp3", "next to.mp3", "pencil case.mp3",
    "phone phoned.mp3", "pick up.mp3", "play basketball.mp3", "play football.mp3", "play played.mp3",
    "play tennis.mp3", "play the guitar.mp3", "play the piano.mp3", "polar bear.mp3", "ride a bike.mp3",
    "riding a bike.mp3", "run ran.mp3", "say said.mp3", "see saw.mp3", "send sent.mp3",
    "she doesn't like.mp3", "she hasn't got.mp3", "she is.mp3", "she isn't.mp3", "she likes.mp3",
    "she's got.mp3", "sit down.mp3", "sit sat.mp3", "smile smiled.mp3", "speak spoke.mp3",
    "stand up.mp3", "start started.mp3", "stay stayed.mp3", "stop stopped.mp3", "study studied.mp3",
    "take took.mp3", "teddy bear.mp3", "tell told.mp3", "they are.mp3", "they aren't.mp3",
    "they haven't got.mp3", "they like.mp3", "they've got.mp3", "think thought.mp3", "tidy tidied.mp3",
    "toy box.mp3", "visit visited.mp3", "want wanted.mp3", "wash washed.mp3", "watch TV.mp3",
    "watch television.mp3", "watch watched.mp3", "watching TV.mp3", "we are.mp3", "we aren't.mp3",
    "we haven't got.mp3", "we like.mp3", "we've got.mp3", "wear wore.mp3", "win won.mp3",
    "work together.mp3", "work worked.mp3", "write wrote.mp3", "you are.mp3", "you aren't.mp3",
    "you haven't got.mp3", "you like.mp3", "you've got.mp3"
]

# Create a set of base names (lowercase, no extension, punctuation cleaned)
def normalize(s):
    # Remove non-alphanumeric and spaces
    return re.sub(r'[^a-zA-Z0-9 ]', '', s).lower().strip()

audio_basenames = {normalize(f.replace(".mp3", "")) for f in audio_files}

# Extract vocab from content_pu2.js
with open(r"D:\coding\html games\Classroom-survivors\content_pu2.js", "r", encoding="utf-8") as f:
    content = f.read()

# Simple regex to find content of vocab arrays
vocabs = re.findall(r'vocab:\s*\[(.*?)\]', content, re.DOTALL)

phrases = set()
for v in vocabs:
    # Extract items between quotes
    items = re.findall(r"'(.*?)'|\"(.*?)\"", v)
    for i in items:
        item = (i[0] or i[1]).strip()
        if len(item.split()) >= 2:
            phrases.add(item)

# Filter missing
missing = []
for p in sorted(list(phrases)):
    if normalize(p) not in audio_basenames:
        missing.append(p)

print("\n".join(missing))
