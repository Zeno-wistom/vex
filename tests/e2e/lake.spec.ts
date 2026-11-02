import { test,expect } from '@playwright/test';
test('默认模式、点击与横屏适配',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await expect(page.locator('canvas')).toBeVisible();await expect(page.locator('.debug')).toHaveCount(0);
  for(const size of [{width:1920,height:1080},{width:2560,height:1440},{width:2560,height:1080}]){await page.setViewportSize(size);await expect(page.locator('canvas')).toHaveCSS('width',`${size.width}px`);expect(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth && document.documentElement.scrollHeight===innerHeight)).toBe(true);}
  await page.getByRole('button',{name:'西湾灯光'}).click();await expect(page.getByRole('button',{name:'西湾灯光'})).toHaveAttribute('aria-pressed','true');await page.screenshot({path:'artifacts/lake-default.png'});expect(errors).toEqual([]);
});
test('完整真实时间流程、暂停、重置及投影同步',async({page,context})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/?debug=1');const projection=await context.newPage();projection.on('pageerror',e=>errors.push(e.message));await projection.goto('/?view=projector');await page.bringToFront();
  await page.getByRole('button',{name:'运行完整交互'}).click();await expect(projection.locator('.tag img')).toHaveCount(1);await expect.poll(()=>projection.locator('.tag img').evaluate(img=>(img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('#state-code')).toHaveText('APPROACH',{timeout:30000});await page.getByRole('button',{name:'暂停',exact:true}).click();const time=await page.locator('#sim-time').textContent();await page.waitForTimeout(600);expect(await page.locator('#sim-time').textContent()).toBe(time);await page.getByRole('button',{name:'继续',exact:true}).click();
  await expect(page.locator('#state-code')).toHaveText('RETURN',{timeout:30000});await expect(projection.locator('.tag')).toHaveCount(0);await expect(page.locator('#state-code')).toHaveText('PATROL',{timeout:30000});
  await page.getByText('模拟故障与状态记录',{exact:true}).click();await expect(page.locator('#history')).toContainText('KICK');await expect(page.locator('#history')).toContainText('VERIFY_OFF');
  await page.getByRole('button',{name:'重置',exact:true}).click();await expect(page.locator('#queue')).toHaveText('无');
  await page.getByRole('button',{name:'西湾开关',exact:true}).click();await page.getByRole('button',{name:'北汀开关',exact:true}).click();await expect(projection.locator('.tag img')).toHaveCount(2);await page.waitForTimeout(1800);await page.screenshot({path:'artifacts/lake-debug.png'});await projection.screenshot({path:'artifacts/projector.png'});
  await page.close();await expect(projection.locator('.connection')).toContainText('断开',{timeout:5000});await expect(projection.locator('.tag-stage')).toBeHidden();expect(errors).toEqual([]);
});
test('投影独立打开等待；拒绝第二控制页',async({page,context})=>{await page.goto('/?view=projector');await expect(page.locator('.connection')).toContainText('等待');const first=await context.newPage();await first.goto('/');await expect(first.locator('canvas')).toBeVisible();const second=await context.newPage();await second.goto('/?debug=1');await expect(second.locator('.connection')).toContainText('已有湖面控制页');});

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
