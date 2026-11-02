import { test,expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
test('10 分钟真实时间持续运行',async({page,browserName})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('/?debug=1');await page.evaluate(()=>{const stats={frames:0,gaps:0,last:performance.now()};Object.assign(window,{lakePerformance:stats});function frame(now:number){stats.frames++;if(now-stats.last>50)stats.gaps++;stats.last=now;requestAnimationFrame(frame);}requestAnimationFrame(frame);});
  const samples:unknown[]=[];const start=Date.now();
  while(Date.now()-start<600000){
    await page.getByRole('button',{name:'运行完整交互'}).click();await page.getByRole('button',{name:'北汀开关',exact:true}).click();
    await page.waitForTimeout(30000);
    samples.push(await page.evaluate(()=>({time:performance.now(),stats:(window as unknown as {lakePerformance:unknown}).lakePerformance,memory:(performance as unknown as {memory?:{usedJSHeapSize:number}}).memory?.usedJSHeapSize,state:document.querySelector('#state-code')?.textContent,canvas:document.querySelector('canvas')?.width})));
  }
  await page.screenshot({path:'artifacts/soak-final.png'});await writeFile('artifacts/soak-report.json',JSON.stringify({browserName,userAgent:await page.evaluate(()=>navigator.userAgent),elapsedMs:Date.now()-start,viewport:page.viewportSize(),errors,samples},null,2));expect(errors).toEqual([]);
});
