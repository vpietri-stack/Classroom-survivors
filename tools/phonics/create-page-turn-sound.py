"""Five original soft paper-friction/rustle variations; no external samples."""
from pathlib import Path
import subprocess,wave
import numpy as np
root=Path(__file__).resolve().parents[2];work=root/'.checks/page-turn';work.mkdir(parents=True,exist_ok=True)
sr=44100;duration=1.8;n=round(sr*duration);t=np.arange(n)/sr
for variant in range(1,6):
 rng=np.random.default_rng(6491+variant*431)
 noise=rng.normal(0,1,n);f=np.fft.rfftfreq(n,1/sr)
 low=[620,760,540,820,680][variant-1];high=[5800,6500,5400,6100,6900][variant-1]
 shape=(1-np.exp(-(f/low)**2))*np.exp(-(f/high)**2)
 friction=np.fft.irfft(np.fft.rfft(noise)*shape,n)
 times=np.array([0,.08,.23,.46,.75,1.02,1.24,1.45,1.7,1.8])
 times[1:-1]+=rng.uniform(-.04,.04,8)
 levels=np.array([0,.05,.25,.12,.65,.9,.5,.22,.03,0]);levels[1:-1]*=rng.uniform(.8,1.12,8)
 envelope=np.interp(t,times,levels)
 grain=.65+.18*np.sin(2*np.pi*rng.uniform(28,43)*t)+.1*np.sin(2*np.pi*rng.uniform(53,72)*t)
 sound=friction*envelope*grain
 for at in sorted(rng.uniform(.12,1.6,6+variant)):
  burst=np.exp(-((t-at)/rng.uniform(.006,.014))**2);sound+=friction*burst*rng.uniform(.18,.32)
 sound*=.38/max(np.max(np.abs(sound)),1e-8)
 source=work/f'paper-turn-soft-{variant}.wav'
 with wave.open(str(source),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(sr);w.writeframes((sound*32767).astype('<i2').tobytes())
 subprocess.run(['ffmpeg','-v','error','-y','-i',str(source),'-c:a','libmp3lame','-b:a','96k',str(root/f'media/phonics/p1-u1-picture-book/paper-turn-soft-{variant}.mp3')],check=True)
 print(f'Created soft paper rustle {variant}')
