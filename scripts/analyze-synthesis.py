"""Review diagnostics, not a scalar aesthetic score. Requires Pillow and numpy."""
import json, os
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
root = Path(os.environ.get('SYNTHESIS_ANALYSIS_DIR', 'artifacts/synthesis-analysis-01'))
root.mkdir(parents=True, exist_ok=True)
comp = Path(os.environ.get('SYNTHESIS_COMPARISON_DIR', 'artifacts/synthesis-comparison-01'))
abl = Path(os.environ.get('SYNTHESIS_COUPLING_DIR', 'artifacts/synthesis-coupling-01'))
records=json.loads((comp/'report.json').read_text())['records']
old=[r['family'] for r in records[:40]]; new=[r['family'] for r in records[40:]]
times=[3.25,13.25,33.25]
def rgb(path): return np.array(Image.open(path).convert('RGB'),dtype=np.float32)/255

def structure(path):
    # BOX area averaging deliberately suppresses native scanline/dither flicker.
    return np.array(Image.open(path).convert('RGB').resize((120,80),Image.Resampling.BOX),dtype=np.float32)/255

signals={f:[structure(comp/f'{f}-{t}.png') for t in times] for f in old+new}
rows=[]
for f in new:
    distances=[]
    for g in old:
        distances.append((sum(float(np.abs(a-b).mean()) for a,b in zip(signals[f],signals[g]))/3,g))
    distance,closest=min(distances)
    ablations=[]
    for t in times:
        a,b=rgb(abl/f'{f}-1-{t}.png'),rgb(abl/f'{f}-0-{t}.png')
        sa,sb=structure(abl/f'{f}-1-{t}.png'),structure(abl/f'{f}-0-{t}.png')
        ablations.append({'time':t,'nativeChangedFraction':float((np.abs(a-b).sum(2)>12/255).mean()),
                          'coarseChangedFraction':float((np.abs(sa-sb).mean(2)>.04).mean()),'coarseMeanAbsoluteDifference':float(np.abs(sa-sb).mean())})
    # Multi-scale edge magnitudes record structure after fine pixel noise is removed.
    edge=[]
    for a in signals[f]: edge.append(float((np.abs(np.diff(a,axis=0)).mean()+np.abs(np.diff(a,axis=1)).mean())/2))
    rows.append({'family':f,'nearestEarlierStudy':closest,'nearestMeanAbsoluteDifference':distance,'coarseEdgeMagnitude':sum(edge)/3,'couplingAblations':ablations})
    sheet=Image.new('RGB',(960,700),'#f4f1e7');d=ImageDraw.Draw(sheet)
    for col,t in enumerate(times):
        for row,c in enumerate([1,0]):
            im=Image.open(abl/f'{f}-{c}-{t}.png').resize((320,214),Image.Resampling.NEAREST)
            sheet.paste(im,(col*320,row*235+30));d.text((col*320+6,row*235+8),f'{f} / coupling {c} / {t}s',fill='black')
        im=Image.open(comp/f'{closest}-{t}.png').resize((320,214),Image.Resampling.NEAREST)
        sheet.paste(im,(col*320,486));d.text((col*320+6,470),f'Closest coarse image: {closest}',fill='black')
    sheet.save(root/f'{f}-comparison.png')
# One shared-input sheet allows direct inspection without palette confounds.
sheet=Image.new('RGB',(1200,1750),'#f4f1e7');d=ImageDraw.Draw(sheet)
for i,f in enumerate(old+new):
    im=Image.open(comp/f'{f}-3.25.png').resize((240,155),Image.Resampling.NEAREST);x=i%5*240;y=i//5*175
    sheet.paste(im,(x,y));d.text((x+5,y+158),f,fill='black')
sheet.save(root/'all-shared-inputs.png')
(root/'report.json').write_text(json.dumps({'results':rows,'methodology':'Shared-input 120x80 BOX averages suppress fine scanlines/dither. Nearest earlier study minimizes RGB mean absolute difference averaged over three equal times. Causal ablation changes only memory coupling. Native difference threshold: summed RGB >12/255; coarse threshold: mean RGB >.04. These describe image differences and causal influence, not a quality ranking, physical model, or proof of perceptual novelty.'},indent=2))
for r in rows: print(r['family'], 'nearest',r['nearestEarlierStudy'],'coarse distance',round(r['nearestMeanAbsoluteDifference'],3),'ablation coarse fraction',round(sum(a['coarseChangedFraction'] for a in r['couplingAblations'])/3,3))
