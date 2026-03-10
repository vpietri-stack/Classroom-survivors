import os
import re

audio_dir = r"D:\coding\html games\Classroom-survivors\audio_mp3"

# Create a set of base names (lowercase, no extension, punctuation cleaned)
def normalize(s):
    # Remove non-alphanumeric and spaces
    return re.sub(r'[^a-zA-Z0-9 ]', '', s).lower().strip()

audio_files = os.listdir(audio_dir)
audio_basenames = {normalize(f.replace(".mp3", "")) for f in audio_files}

def get_missing(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    vocabs = re.findall(r'vocab:\s*\[(.*?)\]', content, re.DOTALL)
    phrases = set()
    for v in vocabs:
        items = re.findall(r"'(.*?)'|\"(.*?)\"", v)
        for i in items:
            item = (i[0] or i[1]).strip()
            if len(item.split()) >= 2:
                phrases.add(item)
    missing = []
    for p in sorted(list(phrases)):
        if normalize(p) not in audio_basenames:
            missing.append(p)
    return missing

all_missing = set()
files = [
    r"D:\coding\html games\Classroom-survivors\content_pu1.js",
    r"D:\coding\html games\Classroom-survivors\content_pu2.js",
    r"D:\coding\html games\Classroom-survivors\content_pu3.js",
    r"D:\coding\html games\Classroom-survivors\content_think1.js"
]

for f in files:
    all_missing.update(get_missing(f))

print("\n".join(sorted(list(all_missing))))
