import * as THREE from 'three';
import { RippleBus } from './ripple';
import { createLakeBed } from './lakeBed';
import { waterVertex, causticFragment, surfaceFragment } from './waterOptics';

// Height/velocity ping-pong and smooth drop profile adapted from threejs-water.
// Original work Copyright (c) 2011 Evan Wallace; modified work Copyright (c) 2026 Yong Su.
// MIT notice: see THIRD_PARTY_LICENSES.md.
const simulation=`varying vec2 uv0; uniform sampler2D stateTex; uniform vec2 texel;
void main(){vec4 s=texture2D(stateTex,uv0);float h=s.r;
float n=texture2D(stateTex,uv0+vec2(0.,texel.y)).r+texture2D(stateTex,uv0-vec2(0.,texel.y)).r+texture2D(stateTex,uv0+vec2(texel.x,0.)).r+texture2D(stateTex,uv0-vec2(texel.x,0.)).r-4.*h;
float v=(s.g+n*.38)*.993;float edge=min(min(uv0.x,uv0.y),min(1.-uv0.x,1.-uv0.y));float fade=smoothstep(0.,.025,edge);
gl_FragColor=vec4(clamp((h+v)*fade,-.15,.15),clamp(v*fade,-.08,.08),0.,1.);}`;
const injection=`varying vec2 uv0;uniform sampler2D stateTex;uniform vec2 center;uniform vec2 aspect;uniform float radius;uniform float strength;uniform vec2 trail;
void main(){vec4 s=texture2D(stateTex,uv0);vec2 p=(uv0-center)*aspect;float d=length(p);
float fade=1.;float width=radius;
if(length(trail)>.0001){vec2 a=trail*aspect;float t=clamp(dot(p,a)/max(dot(a,a),.00001),0.,1.);d=length(p-a*t);width=radius*(1.-.42*t);fade=1.-.62*t;}
float q=max(0.,1.-d/width);float bump=.5-.5*cos(q*3.14159265);gl_FragColor=vec4(clamp(s.r+bump*strength*fade,-.15,.15),s.g,0.,1.);}`;

export type WaterQuality='auto'|'low'|'medium'|'high';
export class WaterSurface {
  readonly ripple=new RippleBus();
  readonly canvas=document.createElement('canvas');
  available=false;
  rippleStrength=1;
  private lastError='';
  private renderer?:THREE.WebGLRenderer;
  private targets?:[THREE.WebGLRenderTarget,THREE.WebGLRenderTarget];
  private causticTarget?:THREE.WebGLRenderTarget;
  private readonly bottom=createLakeBed();
  private readonly lightVectors=Array.from({length:4},()=>new THREE.Vector4(0,0,0,.2));
  private read=0;
  private scene=new THREE.Scene();
  private camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  private plane=new THREE.Mesh(new THREE.PlaneGeometry(2,2));
  private sim?:THREE.ShaderMaterial;private add?:THREE.ShaderMaterial;private display?:THREE.ShaderMaterial;private caustics?:THREE.ShaderMaterial;
  private quality:WaterQuality='auto';private gridWidth=256;private gridHeight=256;private width=1;private height=1;private time=0;
  constructor(parent:HTMLElement,before:HTMLCanvasElement){
    this.canvas.className='water-surface';this.canvas.setAttribute('aria-hidden','true');parent.insertBefore(this.canvas,before);
    this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.available=false;});
    this.canvas.addEventListener('webglcontextrestored',()=>{this.disposeGpu();this.init();this.resize(this.width,this.height);});
    this.scene.add(this.plane);this.init();
  }
  private material(fragmentShader:string,uniforms:Record<string,THREE.IUniform>){return new THREE.ShaderMaterial({vertexShader:waterVertex,fragmentShader,uniforms,depthTest:false,depthWrite:false});}
  private init(){
    try{this.lastError='';this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,alpha:false,antialias:false,powerPreference:'high-performance'});
      if(!this.renderer.capabilities.isWebGL2||!this.renderer.getContext().getExtension('EXT_color_buffer_float')){
        this.lastError='WebGL2 half-float render target unavailable';this.renderer.dispose();this.renderer=undefined;return;
      }
      this.sim=this.material(simulation,{stateTex:{value:null},texel:{value:new THREE.Vector2()}});
      this.add=this.material(injection,{stateTex:{value:null},center:{value:new THREE.Vector2()},aspect:{value:new THREE.Vector2()},radius:{value:0},strength:{value:0},trail:{value:new THREE.Vector2()}});
      this.caustics=this.material(causticFragment,{stateTex:{value:null},texel:{value:new THREE.Vector2()},time:{value:0},aspect:{value:1},intensity:{value:1},lights:{value:this.lightVectors}});
      this.display=this.material(surfaceFragment,{stateTex:{value:null},bottomTex:{value:this.bottom},causticTex:{value:null},texel:{value:new THREE.Vector2()},time:{value:0},aspect:{value:1}});
      this.available=true;
    }catch(error){this.available=false;this.lastError=String(error);this.renderer?.dispose();this.renderer=undefined;}
  }
  setQuality(value:WaterQuality){this.quality=value;this.resize(this.width,this.height);}
  setCausticIntensity(value:number){if(this.caustics)this.caustics.uniforms.intensity.value=Math.max(0,Math.min(2.5,value));}
  setLights(lights:readonly {x:number;y:number;radius:number;value:number}[]){
    this.lightVectors.forEach((v,i)=>{const l=lights[i];v.set(l?.x??0,1-(l?.y??0),l?.value??0,l?.radius??.2);});
  }
  resize(width:number,height:number){this.width=Math.max(1,width);this.height=Math.max(1,height);if(!this.available||!this.renderer)return;
    const level=this.quality==='auto'?(width>1100?256:width<850?128:192):this.quality==='high'?256:this.quality==='medium'?192:128;
    const gw=Math.min(512,Math.round(level*this.width/this.height)),gh=level;
    if(gw!==this.gridWidth||gh!==this.gridHeight||!this.targets){this.targets?.forEach(t=>t.dispose());this.gridWidth=gw;this.gridHeight=gh;
      const opts={type:THREE.HalfFloatType,format:THREE.RGBAFormat,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false,stencilBuffer:false};
      this.targets=[new THREE.WebGLRenderTarget(gw,gh,opts),new THREE.WebGLRenderTarget(gw,gh,opts)];this.read=0;this.clearTargets();}
    const factor=level===256?.52:level===192?.43:.33;
    const cw=Math.min(1024,Math.max(256,Math.round(this.width*factor))),ch=Math.min(768,Math.max(144,Math.round(this.height*factor)));
    if(!this.causticTarget||this.causticTarget.width!==cw||this.causticTarget.height!==ch){this.causticTarget?.dispose();this.causticTarget=new THREE.WebGLRenderTarget(cw,ch,{format:THREE.RGBAFormat,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false,stencilBuffer:false});}
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.setSize(this.width,this.height,false);
    this.sim!.uniforms.texel.value.set(1/gw,1/gh);this.display!.uniforms.texel.value.set(1/gw,1/gh);this.caustics!.uniforms.texel.value.set(1/gw,1/gh);
    this.add!.uniforms.aspect.value.set(this.width/this.height,1);
    this.display!.uniforms.aspect.value=this.width/this.height;this.caustics!.uniforms.aspect.value=this.width/this.height;
  }
  private clearTargets(){if(!this.renderer||!this.targets)return;this.targets.forEach(t=>{this.renderer!.setRenderTarget(t);this.renderer!.clear();});this.renderer.setRenderTarget(null);}
  reset(){this.ripple.clear();this.time=0;this.clearTargets();}
  private pass(material:THREE.ShaderMaterial){if(!this.renderer||!this.targets)return;material.uniforms.stateTex.value=this.targets[this.read].texture;this.plane.material=material;
    this.renderer.setRenderTarget(this.targets[1-this.read]);this.renderer.render(this.scene,this.camera);this.read=1-this.read;}
  step(dt:number){if(!this.available||!this.targets)return;this.time+=dt;
    for(const event of this.ripple.drain()){this.add!.uniforms.center.value.set(event.x,1-event.y);this.add!.uniforms.radius.value=event.radius;
      this.add!.uniforms.strength.value=event.strength*this.rippleStrength;
      const direction=(event.direction??0)*Math.PI/180,length=event.type==='wake'?.045:0;
      this.add!.uniforms.trail.value.set(-Math.cos(direction)*length,Math.sin(direction)*length);
      this.pass(this.add!);}
    this.pass(this.sim!);
  }
  draw(){if(!this.available||!this.renderer||!this.targets||!this.causticTarget)return;
    this.caustics!.uniforms.stateTex.value=this.targets[this.read].texture;this.caustics!.uniforms.time.value=this.time;
    this.plane.material=this.caustics!;this.renderer.setRenderTarget(this.causticTarget);this.renderer.render(this.scene,this.camera);
    this.display!.uniforms.stateTex.value=this.targets[this.read].texture;this.display!.uniforms.causticTex.value=this.causticTarget.texture;this.display!.uniforms.time.value=this.time;
    this.plane.material=this.display!;this.renderer.setRenderTarget(null);this.renderer.render(this.scene,this.camera);
  }
  // Readback is test-only. Production animation never reads pixels from the GPU.
  probe(x:number,y:number){if(!this.renderer)return null;this.draw();const gl=this.renderer.getContext();const pixel=new Uint8Array(4);
    gl.readPixels(Math.floor(x*this.canvas.width),Math.floor((1-y)*this.canvas.height),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
    return {pixel:[...pixel],error:gl.getError()};}
  get diagnostics(){return{webgl2:this.available,grid:[this.gridWidth,this.gridHeight],causticGrid:this.causticTarget?[this.causticTarget.width,this.causticTarget.height]:null,quality:this.quality,queue:this.ripple.length,error:this.lastError,gpuMemory:this.renderer?.info.memory};}
  private disposeGpu(){this.targets?.forEach(t=>t.dispose());this.targets=undefined;this.causticTarget?.dispose();this.causticTarget=undefined;this.sim?.dispose();this.add?.dispose();this.display?.dispose();this.caustics?.dispose();this.renderer?.dispose();this.renderer=undefined;}
  dispose(){this.disposeGpu();this.bottom.dispose();this.plane.geometry.dispose();this.canvas.remove();}
}
