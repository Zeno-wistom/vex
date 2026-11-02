export class Clock {
  private previous=0; private accumulator=0; private request=0;
  constructor(private step:(dt:number)=>void, private draw:()=>void){}
  start(){const loop=(now:number)=>{const delta=this.previous?Math.min(.1,(now-this.previous)/1000):0;this.previous=now;this.accumulator+=delta;while(this.accumulator>=1/60){this.step(1/60);this.accumulator-=1/60;}this.draw();this.request=requestAnimationFrame(loop);};this.request=requestAnimationFrame(loop);}
  stop(){cancelAnimationFrame(this.request);}
}
