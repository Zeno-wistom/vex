import * as THREE from 'three';
import { RippleBus, type RippleEvent } from './ripple';

// Height/velocity ping-pong and smooth drop profile adapted from threejs-water.
// Original work Copyright (c) 2011 Evan Wallace; modified work Copyright (c) 2026 Yong Su.
// MIT notice: see THIRD_PARTY_LICENSES.md.
const vertex=`varying vec2 uv0; void main(){uv0=uv;gl_Position=vec4(position,1.);}`;
const simulation=`varying vec2 uv0; uniform sampler2D stateTex; uniform vec2 texel;
void main(){vec4 s=texture2D(stateTex,uv0);float h=s.r;
float n=texture2D(stateTex,uv0+vec2(0.,texel.y)).r+texture2D(stateTex,uv0-vec2(0.,texel.y)).r+texture2D(stateTex,uv0+vec2(texel.x,0.)).r+texture2D(stateTex,uv0-vec2(texel.x,0.)).r-4.*h;
float v=(s.g+n*.38)*.992;gl_FragColor=vec4(clamp(h+v,-.15,.15),clamp(v,-.08,.08),0.,1.);}`;
const injection=`varying vec2 uv0;uniform sampler2D stateTex;uniform vec2 center;uniform vec2 aspect;uniform float radius;uniform float strength;uniform vec2 trail;
void main(){vec4 s=texture2D(stateTex,uv0);vec2 p=(uv0-center)*aspect;float d=length(p);
if(length(trail)>.0001){vec2 a=trail*aspect;float t=clamp(dot(p,a)/max(dot(a,a),.00001),0.,1.);d=length(p-a*t);}
float q=max(0.,1.-d/radius);float bump=.5-.5*cos(q*3.14159265);gl_FragColor=vec4(clamp(s.r+bump*strength,-.15,.15),s.g,0.,1.);}`;
const surface=`varying vec2 uv0;uniform sampler2D stateTex;uniform vec2 texel;uniform float time;
void main(){float h=texture2D(stateTex,uv0).r;vec2 n=vec2(texture2D(stateTex,uv0+vec2(texel.x,0.)).r-texture2D(stateTex,uv0-vec2(texel.x,0.)).r,texture2D(stateTex,uv0+vec2(0.,texel.y)).r-texture2D(stateTex,uv0-vec2(0.,texel.y)).r);
vec2 refr=uv0+n*1.8;float sun=exp(-length((refr-vec2(.50,.20))*vec2(1.2,1.7))*2.8);
vec3 a=vec3(.47,.70,.61),b=vec3(.19,.52,.55),c=vec3(.61,.71,.55);vec3 base=mix(mix(a,b,smoothstep(.0,.55,refr.x)),c,smoothstep(.55,1.,refr.x)*.55);
base+=sun*vec3(.16,.16,.10);float highlight=pow(max(0.,dot(normalize(vec3(-n*14.,1.)),normalize(vec3(-.35,-.45,1.)))),24.);
base+=highlight*vec3(.20,.27,.23)+abs(h)*vec3(.22,.27,.24)+min(length(n)*32.,.28)*vec3(.20,.27,.22);gl_FragColor=vec4(base,1.);}`;

export class WaterSurface {
  readonly ripple=new RippleBus();
  readonly canvas=document.createElement('canvas');
  available=false;
  private lastError='';
  private renderer?:THREE.WebGLRenderer;
  private targets?:[THREE.WebGLRenderTarget,THREE.WebGLRenderTarget];
  private read=0;
  private scene=new THREE.Scene();
  private camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  private plane=new THREE.Mesh(new THREE.PlaneGeometry(2,2));
  private sim?:THREE.ShaderMaterial;private add?:THREE.ShaderMaterial;private display?:THREE.ShaderMaterial;
  private size=256;private gridWidth=256;private gridHeight=256;private width=1;private height=1;private time=0;
  constructor(parent:HTMLElement, before:HTMLCanvasElement){
    this.canvas.className='water-surface';this.canvas.setAttribute('aria-hidden','true');parent.insertBefore(this.canvas,before);
    this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.available=false;});
    this.canvas.addEventListener('webglcontextrestored',()=>{this.disposeGpu();this.init();this.resize(this.width,this.height);});
    this.scene.add(this.plane);this.init();
  }
  private material(fragmentShader:string,uniforms:Record<string,THREE.IUniform>){return new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader,uniforms,depthTest:false,depthWrite:false});}
  private init(){
    try{this.lastError='';this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,alpha:false,antialias:false,powerPreference:'high-performance'});
      if(!this.renderer.capabilities.isWebGL2){this.renderer.dispose();this.renderer=undefined;return;}
      this.sim=this.material(simulation,{stateTex:{value:null},texel:{value:new THREE.Vector2()}});
      this.add=this.material(injection,{stateTex:{value:null},center:{value:new THREE.Vector2()},aspect:{value:new THREE.Vector2()},radius:{value:0},strength:{value:0},trail:{value:new THREE.Vector2()}});
      this.display=this.material(surface,{stateTex:{value:null},texel:{value:new THREE.Vector2()},time:{value:0}});
      this.available=true;
    }catch(error){this.available=false;this.lastError=String(error);this.renderer=undefined;}
  }
  resize(width:number,height:number){this.width=width;this.height=height;if(!this.available||!this.renderer)return;
    const next=width>1100?256:width<850?128:192;this.size=next;
    const gw=Math.min(512,Math.round(next*width/height));const gh=next;
    if(gw!==this.gridWidth||gh!==this.gridHeight||!this.targets){this.targets?.forEach(t=>t.dispose());this.gridWidth=gw;this.gridHeight=gh;
      const opts={type:THREE.HalfFloatType,format:THREE.RGBAFormat,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:false,stencilBuffer:false};
      this.targets=[new THREE.WebGLRenderTarget(gw,gh,opts),new THREE.WebGLRenderTarget(gw,gh,opts)];this.read=0;this.clearTargets();}
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.setSize(width,height,false);
    this.sim!.uniforms.texel.value.set(1/gw,1/gh);this.display!.uniforms.texel.value.set(1/gw,1/gh);
    this.add!.uniforms.aspect.value.set(width/height,1);
  }
  private clearTargets(){if(!this.renderer||!this.targets)return;this.targets.forEach(t=>{this.renderer!.setRenderTarget(t);this.renderer!.clear();});this.renderer.setRenderTarget(null);}
  reset(){this.ripple.clear();this.time=0;this.clearTargets();}
  private pass(material:THREE.ShaderMaterial){if(!this.renderer||!this.targets)return;material.uniforms.stateTex.value=this.targets[this.read].texture;this.plane.material=material;
    this.renderer.setRenderTarget(this.targets[1-this.read]);this.renderer.render(this.scene,this.camera);this.read=1-this.read;}
  step(dt:number){if(!this.available||!this.targets)return;this.time+=dt;
    for(const event of this.ripple.drain()){this.add!.uniforms.center.value.set(event.x,1-event.y);this.add!.uniforms.radius.value=event.radius;
      this.add!.uniforms.strength.value=event.strength;
      const direction=(event.direction??0)*Math.PI/180,length=event.type==='wake'?.025:0;
      this.add!.uniforms.trail.value.set(-Math.cos(direction)*length,Math.sin(direction)*length);
      this.pass(this.add!);}
    this.pass(this.sim!);
  }
  draw(){if(!this.available||!this.renderer||!this.targets)return;this.display!.uniforms.stateTex.value=this.targets[this.read].texture;this.display!.uniforms.time.value=this.time;
    this.plane.material=this.display!;this.renderer.setRenderTarget(null);this.renderer.render(this.scene,this.camera);}
  probe(x:number,y:number){if(!this.renderer)return null;this.draw();const gl=this.renderer.getContext();const pixel=new Uint8Array(4);
    gl.readPixels(Math.floor(x*this.canvas.width),Math.floor((1-y)*this.canvas.height),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
    return {pixel:[...pixel],error:gl.getError()};}
  get diagnostics(){return{webgl2:this.available,grid:[this.gridWidth,this.gridHeight],queue:this.ripple.length,error:this.lastError,gpuMemory:this.renderer?.info.memory};}
  private disposeGpu(){this.targets?.forEach(t=>t.dispose());this.targets=undefined;this.sim?.dispose();this.add?.dispose();this.display?.dispose();this.renderer?.dispose();this.renderer=undefined;}
  dispose(){this.disposeGpu();this.plane.geometry.dispose();this.canvas.remove();}
}
