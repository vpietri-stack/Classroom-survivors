import os
import re

audio_dir = r"D:\coding\html games\Classroom-survivors\audio_mp3"
content_file = r"D:\coding\html games\Classroom-survivors\content_pu2.js"

# Create a set of base names (lowercase, no extension, punctuation cleaned)
def normalize(s):
    # Remove non-alphanumeric and spaces
    return re.sub(r'[^a-zA-Z0-9 ]', '', s).lower().strip()

audio_files = os.listdir(audio_dir)
audio_basenames = {normalize(f.replace(".mp3", "")) for f in audio_files}

# Extract vocab from content_pu2.js
with open(content_file, "r", encoding="utf-8") as f:
    content = f.read()

# Simple regex to find content of vocab arrays
vocabs = re.findall(r'vocab:\s*\[(.*?)\]', content, re.DOTALL)

phrases = set()
for v in vocabs:
    # Extract items between quotes (handle single and double quotes)
    items = re.findall(r"'(.*?)'|\"(.*?)\"", v)
    for i in items:
        item = (i[0] or i[1]).strip()
        if len(item.split()) >= 2:
            phrases.add(item)

# Filter missing
missing = []
for p in sorted(list(phrases)):
    norm_p = normalize(p)
    if norm_p not in audio_basenames:
        missing.append(p)

print("\n".join(missing))
