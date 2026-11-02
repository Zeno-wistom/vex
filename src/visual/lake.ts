import { sceneLayout } from './layout';
import { gsap } from 'gsap';
import { visual } from '../config/scene';
import type { Snapshot } from '../core/types';
import { School,randomSeed } from './fish';
import { WaterSurface } from './water';
import { robotMotionRipples, type RippleEvent } from './ripple';
interface Light { id:string;value:number;on:boolean;tween?:gsap.core.Tween;elapsed:number }
export class Lake {
  readonly school=new School();
  readonly water:WaterSurface;
  private ctx:CanvasRenderingContext2D;
  private width=1;private height=1;private dpr=1;
  private lights:Light[]=[];
  private texture=document.createElement('canvas');
  private glints:{x:number;y:number;length:number;phase:number}[]=[];
  private reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  private time=0;
  private lastRobot:{x:number;y:number;speed:number}|null=null;
  private robotWakeTime=0;
  private particles:{x:number;y:number;age:number;life:number}[]=[];
  showVision=false;
  constructor(readonly canvas:HTMLCanvasElement,private debug:boolean){
    this.ctx=canvas.getContext('2d',{alpha:true})!;
    this.water=new WaterSurface(canvas.parentElement!,canvas);
    const r=randomSeed(18);this.glints=Array.from({length:420},()=>({x:r(),y:r(),length:2+r()*16,phase:r()*Math.PI*2}));
    this.texture.width=512;this.texture.height=512;const c=this.texture.getContext('2d')!,im=c.createImageData(512,512);
    for(let i=0;i<im.data.length;i+=4){const n=r()*255;im.data[i]=n;im.data[i+1]=n;im.data[i+2]=n;im.data[i+3]=9;}c.putImageData(im,0,0);
    this.resize();window.addEventListener('resize',this.resize);
  }
  private resize=()=>{const layout=sceneLayout(this.debug);this.width=layout.width;this.height=layout.height;this.dpr=Math.min(devicePixelRatio,visual.maxDpr);this.canvas.width=Math.round(innerWidth*this.dpr);this.canvas.height=Math.round(innerHeight*this.dpr);
    Object.assign(this.water.canvas.style,{left:`${layout.x}px`,top:`${layout.y}px`,width:`${layout.width}px`,height:`${layout.height}px`});this.water.resize(layout.width,layout.height);};
  reset(){this.lights.forEach(l=>l.tween?.kill());this.lights=[];this.school.reset();this.water.reset();this.lastRobot=null;this.robotWakeTime=0;this.particles=[];this.time=0;}
  dispose(){window.removeEventListener('resize',this.resize);this.lights.forEach(l=>l.tween?.kill());this.water.dispose();}
  private emit(event:RippleEvent){if(this.water.ripple.emit(event)&&(event.type==='surface'||event.type==='impact')){
    for(let i=0;i<3;i++)this.particles.push({x:event.x+(i-1)*.004,y:event.y,age:0,life:.35+i*.1});
    if(this.particles.length>90)this.particles.splice(0,this.particles.length-90);
  }}
  step(dt:number,s:Snapshot){
    this.time+=dt;
    for(const d of s.devices){let l=this.lights.find(l=>l.id===d.id);if(!l){l={id:d.id,value:0,on:false,elapsed:0};this.lights.push(l);}
      if(d.on!==l.on){l.on=d.on;l.tween?.kill();l.elapsed=0;l.tween=gsap.to(l,{value:d.on?1:0,duration:d.on?visual.fadeIn:visual.fadeOut,ease:'sine.inOut',paused:true});}
      if(l.tween){l.elapsed+=dt;l.tween.totalTime(l.elapsed,false);}
    }
    this.school.step(dt,this.time,s.devices,new Map(this.lights.map(l=>[l.id,l.value])));
    for(const f of this.school.fish){
      if(f.surfacePulse){this.emit({x:f.x,y:f.y,radius:.012,strength:.018,type:'surface',sourceId:`fish-${f.phase}`});}
      else if(f.ripplePulse)this.emit({x:f.x,y:f.y,radius:.007,strength:.0025,type:'fish',sourceId:`fish-${f.phase}`});
    }
    const p=s.pose,prev=this.lastRobot;
    this.robotWakeTime+=dt;
    if(prev&&(this.robotWakeTime>=.09||p.speed===0)){
      if(p.speed>0)this.robotWakeTime=0;
      for(const event of robotMotionRipples(prev,p))this.emit(event);
    }
    this.lastRobot={x:p.x,y:p.y,speed:p.speed};this.water.step(dt);
    this.particles=this.particles.filter(p=>(p.age+=dt)<p.life);
  }
  draw(s:Snapshot){
    const c=this.ctx,w=this.width,h=this.height,t=this.time*(this.reduced?.25:1),m=Math.min(w,h);
    c.setTransform(this.dpr,0,0,this.dpr,0,0);
    c.fillStyle='#e8e5d8';c.fillRect(0,0,innerWidth,innerHeight);
    const layout=sceneLayout(this.debug);
    if(this.water.available)c.clearRect(layout.x,layout.y,w,h);
    this.water.draw();
    c.translate(layout.x,layout.y);
    c.shadowColor='#284b4938';c.shadowBlur=28;c.shadowOffsetY=18;
    c.fillStyle='#364e4a';c.fillRect(-12,-12,w+24,h+34);c.shadowBlur=0;c.shadowOffsetY=0;
    c.fillStyle='#82938b';c.fillRect(-8,h+8,w+16,10);
    if(this.water.available)c.clearRect(0,0,w,h);
    c.save();c.beginPath();c.rect(0,0,w,h);c.clip();
    if(!this.water.available){const bg=c.createLinearGradient(0,0,w,h);bg.addColorStop(0,'#92bca4');bg.addColorStop(.42,'#438f90');bg.addColorStop(1,'#a6b68b');c.fillStyle=bg;c.fillRect(0,0,w,h);}
    // Broad, slow reflections make a body of water rather than a flat backdrop.
    const moon=c.createRadialGradient(w*.52,h*.22,0,w*.52,h*.22,w*.68);moon.addColorStop(0,'rgba(241,243,194,.40)');moon.addColorStop(.5,'rgba(160,214,184,.18)');moon.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=moon;c.fillRect(0,0,w,h);
    if(!this.water.available){c.save();c.globalCompositeOperation='screen';
    for(let layer=0;layer<3;layer++){
      c.lineWidth=layer===0?.7:1.1;
      for(let row=0;row<36;row++){
        c.beginPath();const y0=(row/35)*h;
        for(let x=-40;x<w+50;x+=18){const y=y0+Math.sin(x/w*9+row*.7+t*.11+layer*1.7)*h*.025+Math.sin(x/w*22+row*.42-t*.09)*h*.008;if(x===-40)c.moveTo(x,y);else c.lineTo(x,y);}
        c.strokeStyle=`rgba(111,163,174,${.10+layer*.018})`;c.stroke();
      }
    }
    c.restore();}
    for(const d of s.devices){const level=this.lights.find(l=>l.id===d.id)?.value??0;if(level<.001)continue;
      const x=d.x*w,y=d.y*h,r=d.radius*w;
      c.save();c.globalCompositeOperation='screen';c.translate(x,y);c.scale(1,.76);
      const g=c.createRadialGradient(0,0,0,0,0,r);g.addColorStop(0,`rgba(242,222,169,${level*.55})`);g.addColorStop(.25,`rgba(200,192,134,${level*.35})`);g.addColorStop(.6,`rgba(115,153,124,${level*.17})`);g.addColorStop(1,'rgba(60,110,100,0)');c.fillStyle=g;c.fillRect(-r,-r,r*2,r*2);
      c.restore();
      // Interrupted caustic strands inside each light pool.
      c.save();c.globalCompositeOperation='screen';
      for(let k=0;k<19;k++){
        const yy=y+(k-9)*r*.062,span=Math.sqrt(Math.max(0,1-((k-9)/10)**2))*r*.76;
        c.beginPath();for(let xx=-span;xx<span;xx+=9){const py=yy+Math.sin(xx*.028+k*.8+t*.7)*3+Math.sin(xx*.052-t*.4)*1.7;if(xx===-span)c.moveTo(x+xx,py);else c.lineTo(x+xx,py);}
        c.strokeStyle=`rgba(225,225,179,${level*.045*(.5+.5*Math.sin(k*1.9+t*.3)**2)})`;c.lineWidth=.8;c.stroke();
      }c.restore();
    }
    // Sunlit refraction, broken into soft organic cells beneath the fish.
    if(!this.water.available){c.save();c.globalCompositeOperation='screen';
    for(let row=0;row<13;row++)for(let col=0;col<20;col++){
      const x=(col+.5+Math.sin(row*2.4+t*.14)*.12)*w/20;
      const y=(row+.5+Math.cos(col*1.7+t*.12)*.12)*h/13;
      c.strokeStyle=`rgba(213,243,193,${.035+.025*Math.sin(row+col+t*.3)**2})`;c.lineWidth=1.2;
      c.beginPath();c.ellipse(x,y,w/43,h/30,Math.sin(col+row)*.25,.2+Math.sin(t*.2+col),4.5);c.stroke();
    }c.restore();}
    // Submerged fish: dark displaced shadows, translucent fins, pale dorsal highlight.
    for(const f of [...this.school.fish].sort((a,b)=>b.depth-a.depth)){
      let illumination=.68;for(const d of s.devices){const l=this.lights.find(l=>l.id===d.id)?.value??0;illumination+=l*Math.max(0,1-Math.hypot((f.x-d.x),(f.y-d.y)*.7)/d.radius)*.70;}
      const size=m*.015*f.size,heading=Math.atan2(f.vy*h,f.vx*w),wag=Math.sin(this.time*(5+f.size)+f.phase)*.25;
      c.save();c.translate(f.x*w+4,f.y*h+7);c.rotate(heading);c.fillStyle=`rgba(0,8,13,${.10+illumination*.2})`;c.beginPath();c.ellipse(0,0,size*1.2,size*.24,0,0,Math.PI*2);c.fill();c.restore();
      c.save();c.translate(f.x*w,f.y*h);c.rotate(heading);c.scale(1,.8+f.phase*.07);c.globalAlpha=(.25+illumination*.75)*(1-f.depth*.25);
      c.fillStyle='rgba(165,186,179,.30)';c.beginPath();c.moveTo(size*.05,0);c.quadraticCurveTo(-size*.3,size*.75,-size*.55,size*.3);c.lineTo(-size*.4,0);c.fill();
      c.beginPath();c.moveTo(size*.05,0);c.quadraticCurveTo(-size*.3,-size*.65,-size*.55,-size*.3);c.lineTo(-size*.4,0);c.fill();
      c.save();c.translate(-size*.65,0);c.rotate(wag);c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(-size*.3,-size*.08,-size*.7,-size*.38);c.quadraticCurveTo(-size*.58,0,-size*.7,size*.38);c.quadraticCurveTo(-size*.3,size*.08,0,0);c.fillStyle='rgba(173,193,178,.55)';c.fill();c.restore();
      const body=c.createLinearGradient(0,-size*.26,0,size*.26);body.addColorStop(0,'#708d89');body.addColorStop(.35,f.phase>4?'#d5b576':'#c2d1bc');body.addColorStop(.53,'#8fa79b');body.addColorStop(1,'#344f50');c.fillStyle=body;
      c.beginPath();c.moveTo(size*.85,0);c.bezierCurveTo(size*.5,-size*.3,-size*.12,-size*.36,-size*.78,0);c.bezierCurveTo(-size*.12,size*.31,size*.5,size*.27,size*.85,0);c.fill();
      c.strokeStyle='rgba(225,225,200,.4)';c.lineWidth=.6;c.beginPath();c.moveTo(size*.58,-size*.02);c.quadraticCurveTo(0,-size*.09,-size*.55,0);c.stroke();
      c.fillStyle='#142b2f';c.beginPath();c.arc(size*.52,-size*.09,Math.max(.65,size*.034),0,6.28);c.fill();c.restore();
    }
    for(const p of this.particles){const k=1-p.age/p.life;c.strokeStyle=`rgba(235,249,224,${k*.55})`;c.lineWidth=.8;c.beginPath();c.arc(p.x*w,(p.y-p.age*.02)*h,Math.max(1,k*3),0,Math.PI*2);c.stroke();}
    c.save();c.globalCompositeOperation='screen';
    for(const g of this.glints){const x=g.x*w+Math.sin(t*.15+g.phase)*8,y=g.y*h+Math.cos(t*.17+g.phase)*3;let a=.20;for(const d of s.devices){const l=this.lights.find(l=>l.id===d.id)?.value??0;a+=l*Math.max(0,1-Math.hypot(g.x-d.x,g.y-d.y)/d.radius)*.16;}
      c.strokeStyle=`rgba(204,225,215,${a*(.35+.65*Math.sin(t*.4+g.phase)**2)})`;c.lineWidth=.7;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+g.length*.5,y-1.6,x+g.length,y);c.stroke();
    }c.restore();
    // Quiet shoreline, deliberately peripheral so the lake remains the subject.
    c.save();const r=randomSeed(123);c.fillStyle='rgba(27,91,69,.55)';for(let i=0;i<55;i++){
      const left=i%2===0,x=left?-5:w+5,y=r()*h,reach=(15+r()*30)*m/900;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+(left?1:-1)*reach*.5,y-24,x+(left?1:-1)*reach,y-8);c.quadraticCurveTo(x+(left?1:-1)*reach*.35,y-9,x,y+7);c.fill();}c.restore();
    const vignette=c.createRadialGradient(w*.5,h*.48,m*.15,w*.5,h*.5,w*.65);vignette.addColorStop(0,'rgba(0,5,10,0)');vignette.addColorStop(1,'rgba(9,65,62,.14)');c.fillStyle=vignette;c.fillRect(0,0,w,h);
    c.fillStyle=c.createPattern(this.texture,'repeat')!;c.fillRect(0,0,w,h);
    // Small drifting leaves and rising bubbles add quiet, independent motion.
    for(let i=0;i<14;i++){
      const x=(.12+((i*.137+t*.0008)% .76))*w;
      const y=(.06+((i*.191)% .88))*h+Math.sin(t*.25+i)*4;
      c.save();c.translate(x,y);c.rotate(Math.sin(i+t*.08)*.6);
      if(i%3===0){c.fillStyle='#b4ac6380';c.beginPath();c.ellipse(0,0,5,2,0,0,Math.PI*2);c.fill();}
      else {const phase=(t*.22+i*.31)%1;c.strokeStyle=`rgba(229,244,214,${(1-phase)*.35})`;c.lineWidth=.8;c.beginPath();c.ellipse(0,-phase*9,1+phase*4,1+phase*2,0,0,Math.PI*2);c.stroke();}
      c.restore();
    }
    this.drawPlants(t);
    this.drawRobot(s);
    c.restore();
  }
  private drawPlants(t:number) {
    const c=this.ctx,w=this.width,h=this.height,r=randomSeed(452);
    // Submerged fronds stay in the perimeter strip, outside the patrol rectangle.
    for(let i=0;i<46;i++){
      const x=r()*w,y=i%2===0?h+5:-5,sign=i%2===0?-1:1;
      c.strokeStyle=i%3===0?'#306f5580':'#4a8e6380';c.lineWidth=2;
      for(let j=0;j<4;j++){const length=12+r()*30;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+j*3+Math.sin(t*.5+i)*4,y+sign*length*.5,x+(j-2)*8,y+sign*length);c.stroke();}
    }
    for(let i=0;i<17;i++){
      const left=i<9,x=(left?.025:.975)*w+(r()-.5)*w*.035,y=(.08+r()*.84)*h;
      const radius=8+r()*13;
      c.fillStyle='#245b4930';c.beginPath();c.ellipse(x+3,y+5,radius,radius*.62,0,0,Math.PI*2);c.fill();
      c.fillStyle=i%3===0?'#91ad69':'#689c67';c.beginPath();c.moveTo(x,y);c.ellipse(x,y,radius,radius*.65,-.2,.25,Math.PI*2);c.closePath();c.fill();
      c.strokeStyle='#b4c98b99';c.lineWidth=.7;c.beginPath();c.moveTo(x,y);c.lineTo(x-radius*.7,y+radius*.2);c.stroke();
      if(i%5===0){c.fillStyle='#f1e7cf';for(let petal=0;petal<6;petal++){c.beginPath();const a=petal*Math.PI/3;c.ellipse(x+Math.cos(a)*4,y+Math.sin(a)*3,5,2.5,a,0,Math.PI*2);c.fill();}c.fillStyle='#d8ba65';c.beginPath();c.arc(x,y,2,0,Math.PI*2);c.fill();}
    }
  }
  private drawRobot(s:Snapshot){
    const c=this.ctx,w=this.width,h=this.height,p=s.pose;
    c.save();
    if(this.debug){const e={x:.5,y:.5,rx:.28,ry:.30};c.strokeStyle='rgba(237,249,220,.4)';c.setLineDash([3,7]);c.beginPath();c.ellipse(e.x*w,e.y*h,e.rx*w,e.ry*h,0,0,Math.PI*2);c.stroke();c.setLineDash([]);}
    c.translate(p.x*w,p.y*h);
    // Scale normalized geometry before rotating so the drawn cone matches the sensor.
    c.scale(w,h);c.rotate(p.heading*Math.PI/180);
    if(this.showVision){const half=s.fov*Math.PI/360;c.beginPath();c.moveTo(0,0);c.arc(0,0,s.recognitionRange,-half,half);c.closePath();c.fillStyle='#f7efae20';c.fill();c.strokeStyle='#fff5bb65';c.lineWidth=.001;c.stroke();}
    const radius=.028;
    c.shadowColor='#133f4450';c.shadowBlur=8;c.shadowOffsetY=5;
    c.fillStyle='#f1eee0';c.strokeStyle='#294c48';c.lineWidth=.002;c.beginPath();c.arc(0,0,radius,0,Math.PI*2);c.fill();c.stroke();c.shadowBlur=0;c.shadowOffsetY=0;
    c.fillStyle='#203f3b';c.fillRect(-.012,-.014,.019,.028);
    c.fillStyle='#7fae9b';c.fillRect(.006,-.007,.008,.014);
    c.fillStyle='#d8a851';const target=s.devices.find(d=>d.id===s.targetId);const reach=target?.kickerReach??.054;
    c.fillRect(.023,-.004,.005+s.kicker*(reach-.028),.008);
    c.fillStyle='#294e49';c.beginPath();c.arc(.014,0,.004,0,Math.PI*2);c.fill();
    c.restore();
  }
}
