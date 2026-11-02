import { test,expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const out='evidence/visual-v4';
test('V4 实际 Chrome 画面：水面、波纹、鱼、水花、尾流与三尺寸',async({page})=>{
  await mkdir(out,{recursive:true});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('/?debug=1');
  await expect(page.locator('.water-surface')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {lakeDiagnostics:()=>{webgl2:boolean}}).lakeDiagnostics().webgl2)).toBe(true);
  await page.getByText('视觉效果测试',{exact:true}).click();
  await page.waitForTimeout(1000);
  await page.screenshot({path:`${out}/caustics-lights-off.png`});
  await page.getByRole('button',{name:'切换西湾灯光'}).click();
  await page.waitForTimeout(1500);
  await page.screenshot({path:`${out}/caustics-light-on.png`});
  await page.getByRole('button',{name:'切换西湾灯光'}).click();
  await page.getByRole('button',{name:'单个强波纹'}).click();await page.waitForTimeout(380);
  await page.screenshot({path:`${out}/single-ripple.png`});
  await page.getByRole('button',{name:'交叉波纹'}).click();await page.waitForTimeout(700);
  await page.screenshot({path:`${out}/crossing-ripples.png`});
  await page.getByRole('button',{name:'鱼浮出'}).click();await page.waitForTimeout(650);
  const state=await page.evaluate(()=>(window as unknown as {lakeVisualState:()=>{surface:{visual:number;breach:number}[];particles:number}}).lakeVisualState());
  expect(state.surface.some(f=>f.visual>.5&&f.breach>.1)).toBe(true);
  expect(state.particles).toBeGreaterThan(0);
  await page.screenshot({path:`${out}/fish-breach.png`});
  await page.getByRole('button',{name:'加速尾流'}).click();await page.waitForTimeout(330);
  await page.screenshot({path:`${out}/robot-wake.png`});
  await page.getByRole('button',{name:'停止冲击波'}).click();await page.waitForTimeout(320);
  await page.screenshot({path:`${out}/robot-stop.png`});
  await page.goto('/');await page.waitForTimeout(1100);
  for(const [width,height] of [[1920,1080],[2560,1440],[2560,1080]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(500);
    await page.screenshot({path:`${out}/full-scene-${width}x${height}.png`});
    const d=await page.evaluate(()=>(window as unknown as {lakeDiagnostics:()=>{webgl2:boolean;causticGrid:number[];error:string}}).lakeDiagnostics());
    expect(d.webgl2).toBe(true);expect(d.causticGrid[0]).toBeGreaterThan(0);expect(d.error).toBe('');
  }
  const glError=await page.evaluate(()=>(document.querySelector('.water-surface') as HTMLCanvasElement).getContext('webgl2')?.getError());
  expect(glError).toBe(0);expect(errors).toEqual([]);
});
