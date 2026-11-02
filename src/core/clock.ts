export class Clock {
  private previous=0; private accumulator=0; private request=0;
  constructor(private step:(dt:number)=>void, private draw:()=>void){}
  private onVisibility=()=>{if(document.visibilityState==='visible'){this.previous=0;this.accumulator=0;}};
  start(){document.addEventListener('visibilitychange',this.onVisibility);const loop=(now:number)=>{const delta=this.previous?Math.min(.1,(now-this.previous)/1000):0;this.previous=now;this.accumulator+=delta;while(this.accumulator>=1/60){this.step(1/60);this.accumulator-=1/60;}this.draw();this.request=requestAnimationFrame(loop);};this.request=requestAnimationFrame(loop);}
  stop(){cancelAnimationFrame(this.request);document.removeEventListener('visibilitychange',this.onVisibility);this.previous=0;this.accumulator=0;}
}
