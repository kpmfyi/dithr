import type { Recipe } from '../seedbank/recipes.ts';
/** Rotate actual recipe colors; no hidden display filter or export-only state. */
export function rotatePalette(palette: Recipe['palette'], degrees: number): Recipe['palette'] {
  if (!Number.isFinite(degrees) || degrees < -180 || degrees > 180) throw new Error('Hue shift must be between -180 and 180 degrees.');
  return palette.map(hex=>{
    if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error('Invalid palette color.');
    if (degrees===0) return hex;
    const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
    const high=Math.max(r,g,b),low=Math.min(r,g,b),delta=high-low,l=(high+low)/2;
    if (!delta) return hex;
    const s=delta/(1-Math.abs(2*l-1));
    const h=(((high===r?(g-b)/delta:high===g?(b-r)/delta+2:(r-g)/delta+4)*60+degrees)%360+360)%360;
    const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;
    const rgb=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
    return '#'+rgb.map(v=>Math.round((v+m)*255).toString(16).padStart(2,'0')).join('');
  }) as Recipe['palette'];
}
