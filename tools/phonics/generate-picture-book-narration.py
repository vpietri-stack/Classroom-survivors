"""Prepare page clips from a reviewed continuous teacher narration.

Use the teacher's supplied recording. Align its page boundaries and save
reviewed-cuts.json with a matching master SHA256. Keep the natural pitch/tempo.
"""
from pathlib import Path
import hashlib, json, subprocess
ROOT=Path(__file__).resolve().parents[2]
MEDIA=ROOT/'media/phonics/p1-u1-picture-book'
WORK=ROOT/'.checks/picture-book-narration';WORK.mkdir(parents=True,exist_ok=True)
story=json.loads((MEDIA/'story.json').read_text(encoding='utf-8'))
recipe=json.loads((WORK/'reviewed-cuts.json').read_text(encoding='utf-8'))
source=ROOT/recipe['master']
if hashlib.sha256(source.read_bytes()).hexdigest()!=recipe['sha256']:
 raise RuntimeError('Narration master changed: align and review the cuts again.')
if len(recipe['cuts'])!=len(story['pages']):raise RuntimeError('Each story page needs one reviewed cut.')
for page,(start,end) in zip(story['pages'],recipe['cuts']):
 number=page['page'];stem=f'page-{number:02d}'
 output=MEDIA/(stem+'-'+recipe.get('version','recorded-v1')+'.mp3')
 if not output.exists():
  subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(start),'-i',str(source),'-t',str(end-start),'-af','loudnorm=I=-20:TP=-2:LRA=7','-ar','44100','-ac','1','-c:a','libmp3lame','-b:a','96k',str(output)],check=True)
 duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(output)]))
 print(f'{stem}: ready ({duration:.2f}s)',flush=True)
 page['narration']=output.name;page['narrationSeconds']=round(duration,3)
story['narration']={'voice':'teacher original recording','sourceKind':recipe['sourceKind'],'delivery':'Natural recorded voice, pitch and tempo preserved; consistent playback volume.','masterSHA256':recipe['sha256']}
(MEDIA/'story.json').write_text(json.dumps(story,ensure_ascii=False,indent=2),encoding='utf-8')
print('All ten story pages have narration.',flush=True)
