import type { Device } from '../core/types';
import { visual } from '../config/scene';
export function randomSeed(seed:number){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
export interface Fish { x:number;y:number;vx:number;vy:number;size:number;phase:number;depth:number;target:string|null;free:boolean;surfaceTimer:number;surfaceCooldown:number;surfacePulse:boolean;ripplePulse:boolean;wakeTimer:number;restTimer:number;preference:number }
export class School {
  fish:Fish[]=[];
  reset(){const r=randomSeed(visual.seed);this.fish=Array.from({length:visual.fishCount},(_,i)=>{const a=r()*Math.PI*2;return{x:.07+r()*.86,y:.08+r()*.84,vx:Math.cos(a)*.025,vy:Math.sin(a)*.025,size:.7+r()*.9,phase:r()*6.28,depth:r(),target:null,free:i%7===0,surfaceTimer:0,surfaceCooldown:8+r()*38,surfacePulse:false,ripplePulse:false,wakeTimer:r()*2,restTimer:0,preference:r()};});}
  constructor(){this.reset();}
  step(dt:number,time:number,devices:Device[],levels:Map<string,number>){
    const lit=devices.filter(d=>(levels.get(d.id)??0)>.08);
    let active=this.fish.filter(f=>f.surfaceTimer>0).length;
    for(const f of this.fish){
      f.surfacePulse=false;f.ripplePulse=false;f.surfaceCooldown-=dt;f.surfaceTimer=Math.max(0,f.surfaceTimer-dt);f.wakeTimer-=dt;f.restTimer=Math.max(0,f.restTimer-dt);
      if(f.surfaceTimer===0&&f.surfaceCooldown<=0&&active<2){f.surfaceTimer=.35;f.surfaceCooldown=20+f.preference*30;f.surfacePulse=true;active++;}
      if(f.wakeTimer<=0){f.ripplePulse=true;f.wakeTimer=1.2+f.preference*1.5;}
      if(f.restTimer===0&&Math.sin(time*.37+f.phase*7)>.998)f.restTimer=.45+f.preference*.5;
    }
    const next=this.fish.map((f,i)=>{
      let ax=Math.cos(time*.27+f.phase*5)*.008,ay=Math.sin(time*.31+f.phase*7)*.008;
      let sx=0,sy=0,cx=0,cy=0,avx=0,avy=0,n=0;
      for(const o of this.fish){if(o===f)continue;const dx=f.x-o.x,dy=f.y-o.y,d2=dx*dx+dy*dy;
        if(d2<.001 && d2>.000001){sx+=dx/d2;sy+=dy/d2;}
        if(d2<.009){cx+=o.x;cy+=o.y;avx+=o.vx;avy+=o.vy;n++;}
      }
      ax+=sx*.00004;ay+=sy*.00004;
      if(n){ax+=(cx/n-f.x)*.05+(avx/n-f.vx)*.12;ay+=(cy/n-f.y)*.05+(avy/n-f.vy)*.12;}
      let target=lit.find(d=>d.id===f.target);
      if(!target && lit.length && !f.free){target=[...lit].sort((a,b)=>Math.hypot(a.x-f.x,a.y-f.y)*(1+((i+a.tagId)%3)*.4)-Math.hypot(b.x-f.x,b.y-f.y)*(1+((i+b.tagId)%3)*.4))[0];f.target=target.id;}
      if(!target)f.target=null;
      if(target){const orbit=time*.18+f.phase,rad=.025+(i%5)*.012;const tx=target.x+Math.cos(orbit)*rad,ty=target.y+Math.sin(orbit)*rad;const strength=(levels.get(target.id)??0)*.16;ax+=(tx-f.x)*strength;ay+=(ty-f.y)*strength;}
      if(f.x<.04)ax+=(.04-f.x)*.8;if(f.x>.96)ax-=(f.x-.96)*.8;if(f.y<.05)ay+=(.05-f.y)*.8;if(f.y>.95)ay-=(f.y-.95)*.8;
      let vx=f.vx+ax*dt,vy=f.vy+ay*dt;const speed=Math.hypot(vx,vy);const max=(target?.on ? .045:.035)*(.72+f.size*.28)*(f.restTimer>0?.28:1)*(1+.12*Math.sin(time*.8+f.phase));
      if(speed>max){vx=vx/speed*max;vy=vy/speed*max;}if(speed<.006&&f.restTimer===0){vx=vx/Math.max(speed,.0001)*.006;vy=vy/Math.max(speed,.0001)*.006;}
      // Limit heading change so schooling never produces instantaneous turns.
      const old=Math.atan2(f.vy,f.vx),desired=Math.atan2(vy,vx),delta=Math.atan2(Math.sin(desired-old),Math.cos(desired-old));const heading=old+Math.max(-1.2*dt,Math.min(1.2*dt,delta));const s=Math.hypot(vx,vy);
      return{vx:Math.cos(heading)*s,vy:Math.sin(heading)*s};
    });
    this.fish.forEach((f,i)=>{f.vx=next[i].vx;f.vy=next[i].vy;f.x=Math.max(.005,Math.min(.995,f.x+f.vx*dt));f.y=Math.max(.005,Math.min(.995,f.y+f.vy*dt));});
  }
}
