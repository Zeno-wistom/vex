import { test,expect } from '@playwright/test';
test('GPU 波纹传播、衰减、重置与 context 恢复',async({page})=>{
  await page.goto('/?debug=1');await page.getByRole('button',{name:'暂停',exact:true}).click();
  const water=page.locator('.water-surface');await expect(water).toBeVisible();
  const diagnostics=await page.evaluate(()=>(window as unknown as {lakeDiagnostics:()=>{webgl2:boolean;grid:number[]}}).lakeDiagnostics());
  expect(diagnostics.webgl2).toBe(true);expect(diagnostics.grid[1]).toBeGreaterThanOrEqual(128);
  await page.evaluate(()=>{const w=(window as unknown as {lakeTestWater:{reset:()=>void;draw:()=>void}}).lakeTestWater;w.reset();w.draw();});
  await page.evaluate(()=>{const w=(window as unknown as {lakeTestWater:{step:(dt:number)=>void}}).lakeTestWater;for(let i=0;i<6;i++)w.step(1/60);});
  const flatSix=await page.evaluate(()=>(window as unknown as {lakeTestWater:{probe:(x:number,y:number)=>unknown}}).lakeTestWater.probe(.5,.72));
  await page.evaluate(()=>{const w=(window as unknown as {lakeTestWater:{reset:()=>void;draw:()=>void}}).lakeTestWater;w.reset();w.draw();});
  const flat=await water.screenshot({path:'artifacts/gpu-flat.png'});
  await page.evaluate(()=>{const w=(window as unknown as {lakeTestWater:{ripple:{emit:(e:unknown)=>boolean};step:(dt:number)=>void;draw:()=>void}}).lakeTestWater;
    w.ripple.emit({x:.5,y:.72,radius:.025,strength:.035,type:'impact',sourceId:'e2e'});for(let i=0;i<6;i++)w.step(1/60);w.draw();});
  const changedPixel=await page.evaluate(()=>(window as unknown as {lakeTestWater:{probe:(x:number,y:number)=>unknown}}).lakeTestWater.probe(.5,.72));
  const injected=await water.screenshot({path:'artifacts/gpu-ripple.png'});expect(injected.equals(flat),JSON.stringify({flatSix,changedPixel})).toBe(false);
  await page.evaluate(()=>{const w=(window as unknown as {lakeTestWater:{step:(dt:number)=>void;draw:()=>void}}).lakeTestWater;for(let i=0;i<36;i++)w.step(1/60);w.draw();});
  const propagated=await water.screenshot();expect(propagated.equals(injected)).toBe(false);
  await page.evaluate(()=>{const w=(window as unknown as {lakeTestWater:{step:(dt:number)=>void;draw:()=>void}}).lakeTestWater;for(let i=0;i<600;i++)w.step(1/60);w.draw();});
  const settledPixel=await page.evaluate(()=>(window as unknown as {lakeTestWater:{probe:(x:number,y:number)=>{pixel:number[]}}}).lakeTestWater.probe(.5,.72));
  await page.evaluate(()=>{const w=(window as unknown as {lakeTestWater:{reset:()=>void;step:(dt:number)=>void}}).lakeTestWater;w.reset();for(let i=0;i<642;i++)w.step(1/60);});
  const flatLater=await page.evaluate(()=>(window as unknown as {lakeTestWater:{probe:(x:number,y:number)=>{pixel:number[]}}}).lakeTestWater.probe(.5,.72));
  const pixelDistance=(a:{pixel:number[]},b:{pixel:number[]})=>a.pixel.slice(0,3).reduce((sum,value,i)=>sum+Math.abs(value-b.pixel[i]),0);
  expect(pixelDistance(settledPixel,flatLater)).toBeLessThan(pixelDistance(changedPixel as {pixel:number[]},flatSix as {pixel:number[]}));
  await page.evaluate(()=>{const w=(window as unknown as {lakeTestWater:{reset:()=>void;draw:()=>void}}).lakeTestWater;w.reset();w.draw();});
  const reset=await water.screenshot();expect(reset.equals(flat)).toBe(true);
  await page.evaluate(()=>{const gl=(document.querySelector('.water-surface') as HTMLCanvasElement).getContext('webgl2');const ext=gl?.getExtension('WEBGL_lose_context');Object.assign(window,{lakeLoseContext:ext});ext?.loseContext();});
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {lakeDiagnostics:()=>{webgl2:boolean}}).lakeDiagnostics().webgl2)).toBe(false);
  await page.evaluate(()=>(window as unknown as {lakeLoseContext:WEBGL_lose_context}).lakeLoseContext.restoreContext());
  await page.waitForTimeout(1000);const restored=await page.evaluate(()=>(window as unknown as {lakeDiagnostics:()=>{webgl2:boolean;error:string}}).lakeDiagnostics());expect(restored.webgl2,JSON.stringify(restored)).toBe(true);
});
test('WebGL2 不可用时湖面仍可交互',async({page})=>{
  await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type,...args){if(type==='webgl2')return null;return original.call(this,type,...args);} as typeof original;});
  await page.goto('/');await expect(page.getByLabel('自然日光湖面，四个岸边装置与巡湖机器人')).toBeVisible();
  expect(await page.evaluate(()=>(window as unknown as {lakeDiagnostics:()=>{webgl2:boolean}}).lakeDiagnostics().webgl2)).toBe(false);
  await page.getByRole('button',{name:'西湾灯光'}).click();await expect(page.getByRole('button',{name:'西湾灯光'})).toHaveAttribute('aria-pressed','true');
  await page.screenshot({path:'artifacts/webgl2-fallback.png'});
});
test('鱼浮出、短 Kicker 与机器人回程画面',async({page})=>{
  await page.goto('/?debug=1');
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {lakeFishSurface:()=>number}).lakeFishSurface()),{timeout:30000,intervals:[100]}).toBeGreaterThan(0);
  await page.screenshot({path:'artifacts/fish-surface.png'});
  await page.getByRole('button',{name:'运行完整交互'}).click();
  await expect(page.locator('#state-code')).toHaveText('KICK',{timeout:45000});
  await page.screenshot({path:'artifacts/kicker-short.png'});
  await expect(page.locator('#state-code')).toHaveText('RETURN',{timeout:30000});
  await page.screenshot({path:'artifacts/robot-return.png'});
});
test('默认模式、点击与横屏适配',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await expect(page.getByLabel('自然日光湖面，四个岸边装置与巡湖机器人')).toBeVisible();await expect(page.locator('.water-surface')).toBeVisible();await expect(page.locator('.debug')).toHaveCount(0);
  for(const size of [{width:1920,height:1080},{width:2560,height:1440},{width:2560,height:1080}]){await page.setViewportSize(size);await expect(page.getByLabel('自然日光湖面，四个岸边装置与巡湖机器人')).toHaveCSS('width',`${size.width}px`);expect(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth && document.documentElement.scrollHeight===innerHeight)).toBe(true);}
  await page.getByRole('button',{name:'西湾灯光'}).click();await expect(page.getByRole('button',{name:'西湾灯光'})).toHaveAttribute('aria-pressed','true');await page.screenshot({path:'artifacts/lake-default.png'});expect(errors).toEqual([]);
});
test('完整真实时间流程、暂停、重置及投影同步',async({page,context})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/?debug=1');const projection=await context.newPage();projection.on('pageerror',e=>errors.push(e.message));await projection.goto('/?view=projector');await page.bringToFront();
  await page.getByRole('button',{name:'运行完整交互'}).click();await expect(projection.locator('.tag img')).toHaveCount(1);await expect.poll(()=>projection.locator('.tag img').evaluate(img=>(img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('#state-code')).toHaveText('APPROACH',{timeout:30000});await page.getByRole('button',{name:'暂停',exact:true}).click();await page.waitForTimeout(200);const time=await page.locator('#sim-time').textContent();await page.waitForTimeout(600);expect(await page.locator('#sim-time').textContent()).toBe(time);await page.getByRole('button',{name:'继续',exact:true}).click();
  await expect(page.locator('#state-code')).toHaveText('RETURN',{timeout:30000});await expect(projection.locator('.tag')).toHaveCount(0);await expect(page.locator('#state-code')).toHaveText('PATROL',{timeout:30000});
  await page.getByText('模拟故障与状态记录',{exact:true}).click();await expect(page.locator('#history')).toContainText('KICK');await expect(page.locator('#history')).toContainText('VERIFY_OFF');
  await page.getByRole('button',{name:'重置',exact:true}).click();await expect(page.locator('#queue')).toHaveText('无');
  await page.getByRole('button',{name:'西湾开关',exact:true}).click();await page.getByRole('button',{name:'北汀开关',exact:true}).click();await expect(projection.locator('.tag img')).toHaveCount(2);await page.waitForTimeout(1800);await page.screenshot({path:'artifacts/lake-debug.png'});await projection.screenshot({path:'artifacts/projector.png'});
  await page.close();await expect(projection.locator('.connection')).toContainText('断开',{timeout:5000});await expect(projection.locator('.tag-stage')).toBeHidden();expect(errors).toEqual([]);
});
test('投影独立打开等待；拒绝第二控制页',async({page,context})=>{await page.goto('/?view=projector');await expect(page.locator('.connection')).toContainText('等待');const first=await context.newPage();await first.goto('/');await expect(first.getByLabel('自然日光湖面，四个岸边装置与巡湖机器人')).toBeVisible();const second=await context.newPage();await second.goto('/?debug=1');await expect(second.locator('.connection')).toContainText('已有湖面控制页');});

test('双目标实际完成、视野开关与全屏',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('/?debug=1');
  await page.getByRole('button',{name:'摄像头视野',exact:true}).click();
  await expect(page.locator('#vision-toggle')).toHaveAttribute('aria-pressed','true');
  await page.locator('#scene-fullscreen').click();
  await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(true);
  await page.locator('#scene-fullscreen').click();
  await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(false);
  await page.getByRole('button',{name:'西湾开关',exact:true}).click();
  await expect(page.locator('#state-code')).toHaveText('APPROACH',{timeout:30000});
  await page.getByRole('button',{name:'北汀开关',exact:true}).click();
  await expect(page.locator('#target')).toHaveText('0');
  await page.waitForTimeout(1500);
  await page.screenshot({path:'artifacts/lake-two-lights.png'});
  await expect(page.getByRole('button',{name:'西湾开关',exact:true})).toHaveAttribute('aria-pressed','false',{timeout:40000});
  await expect(page.getByRole('button',{name:'北汀开关',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('button',{name:'北汀开关',exact:true})).toHaveAttribute('aria-pressed','false',{timeout:60000});
  await expect(page.locator('#state-code')).toHaveText('PATROL',{timeout:30000});
  await expect(page.locator('#queue')).toHaveText('无');
  expect(errors).toEqual([]);
});

test('V2 回头时重新开灯，再次锁定关闭；参数应用',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/?debug=1');
 await page.getByText('模拟参数',{exact:true}).click();
 await page.locator('input[name="fov"]').fill('110');
 await page.getByRole('button',{name:'应用模拟参数'}).click();
 await expect(page.locator('#parameter-result')).toHaveText('模拟参数已应用');
 await expect(page.locator('#geometry')).toContainText('FOV 110');
 await page.getByText('模拟参数',{exact:true}).click();
 await page.getByRole('button',{name:'运行完整交互'}).click();
 await expect(page.locator('#state-code')).toHaveText('LOOK_BACK',{timeout:45000});
 await page.getByRole('button',{name:'西湾开关',exact:true}).click();
 await expect(page.locator('#look-back')).toContainText('重新锁定',{timeout:10000});
 await expect(page.getByRole('button',{name:'西湾开关',exact:true})).toHaveAttribute('aria-pressed','false',{timeout:30000});
 await expect(page.locator('#look-back')).toContainText('连续确认 Tag 已消失',{timeout:20000});
 await expect(page.locator('#state-code')).toHaveText('PATROL',{timeout:30000});
 await page.screenshot({path:'artifacts/v2-lookback.png'});
 expect(errors).toEqual([]);
});
