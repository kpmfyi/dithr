// Independent renderer for coupling ablations. Not imported by the viewer/runtime.
import { Color, Vector3, NoToneMapping, SRGBColorSpace, Mesh, PlaneGeometry, Scene, OrthographicCamera } from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { uniform } from 'three/tsl';
import { createEffect } from '../src/seedbank/effects';
import { createSynthesis } from '../src/seedbank/synthesis';
import { presets, isSynthesis, type Recipe } from '../src/seedbank/recipes';
const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
async function create(recipe: Recipe, coupling = 1) {
  const renderer = new WebGPURenderer({canvas,forceWebGL:true,antialias:false});
  renderer.outputColorSpace=SRGBColorSpace; renderer.toneMapping=NoToneMapping; renderer.setPixelRatio(1);
  const u = {seed:uniform(recipe.seed/65535*60),scale:uniform(recipe.parameters.scale),speed:uniform(recipe.parameters.speed),intensity:uniform(recipe.parameters.intensity),detail:uniform(recipe.parameters.detail),aspect:uniform(1.5),
    colors:recipe.palette.map(hex=>{const c=new Color(hex);return uniform(new Vector3(c.r,c.g,c.b));})};
  const legacy = isSynthesis(recipe.family) ? undefined : createEffect(recipe);
  if (legacy) legacy.uniforms.aspect.value = 1.5;
  const effect = isSynthesis(recipe.family) ? createSynthesis(u,recipe.family,{coupling}) : legacy!.feedback;
  if (!effect) throw new Error('A feedback family is required');
  const geometry=new PlaneGeometry(2,2), mesh=new Mesh(geometry,effect.material), scene=new Scene(), camera=new OrthographicCamera(-1,1,1,-1,0,2);
  camera.position.z=1;mesh.frustumCulled=false;scene.add(mesh);
  await renderer.init();renderer.setSize(960,640,false);effect.resize(960,640);
  await effect.compile(renderer);await renderer.compileAsync(scene,camera);
  return {advance(t:number){effect.advance(renderer,t);},present(){renderer.render(scene,camera);},render(t:number){effect.advance(renderer,t);renderer.render(scene,camera);},
    async capture(t:number){this.render(t);return new Promise<string>((resolve,reject)=>canvas.toBlob(b=>{if(!b)return reject(new Error('capture'));const r=new FileReader();r.onload=()=>resolve(String(r.result));r.readAsDataURL(b);},'image/png'));},
    dispose(){effect.dispose();effect.material.dispose();geometry.dispose();renderer.dispose();},
    environment(){
      const gl=canvas.getContext('webgl2')!, ext=gl.getExtension('WEBGL_debug_renderer_info');
      return {...effect.environment(),backend:'webgl2',browser:navigator.userAgent,width:canvas.width,height:canvas.height,pixelRatio:1,
        adapter:String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER))};
    }};
}
Object.assign(window,{synthesisLab:{create,presets}});
