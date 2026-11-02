import { test,expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
test('10 分钟真实时间持续运行',async({page,browserName})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('/?debug=1');await page.evaluate(()=>{const stats={frames:0,gaps:0,last:performance.now(),deltas:[] as number[]};Object.assign(window,{lakePerformance:stats});function frame(now:number){const delta=now-stats.last;stats.frames++;if(delta>50)stats.gaps++;if(delta>0&&delta<1000)stats.deltas.push(delta);stats.last=now;requestAnimationFrame(frame);}requestAnimationFrame(frame);});
  const samples:unknown[]=[];const start=Date.now();
  while(Date.now()-start<600000){
    await page.getByRole('button',{name:'运行完整交互'}).click();await page.getByRole('button',{name:'北汀开关',exact:true}).click();
    await page.waitForTimeout(30000);
    samples.push(await page.evaluate(()=>{const stats=(window as unknown as {lakePerformance:{frames:number;gaps:number;deltas:number[]}}).lakePerformance;
      const deltas=stats.deltas.splice(0).sort((a,b)=>a-b),sum=deltas.reduce((a,b)=>a+b,0),gl=(document.querySelector('.water-surface') as HTMLCanvasElement).getContext('webgl2');
      return{time:performance.now(),fps:deltas.length*1000/sum,p50Ms:deltas[Math.floor(deltas.length*.5)],p95Ms:deltas[Math.floor(deltas.length*.95)],maxMs:deltas.at(-1),longFrames:stats.gaps,frames:stats.frames,memory:(performance as unknown as {memory?:{usedJSHeapSize:number}}).memory?.usedJSHeapSize,state:document.querySelector('#state-code')?.textContent,water:(window as unknown as {lakeDiagnostics:()=>unknown}).lakeDiagnostics(),webglError:gl?.getError()};}));
  }
  await page.screenshot({path:'artifacts/soak-final.png'});await writeFile('artifacts/soak-report.json',JSON.stringify({browserName,userAgent:await page.evaluate(()=>navigator.userAgent),elapsedMs:Date.now()-start,viewport:page.viewportSize(),errors,samples},null,2));expect(errors).toEqual([]);
});
