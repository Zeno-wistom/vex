import { describe,it,expect } from 'vitest';
import { School } from '../src/visual/fish';
import { devices } from '../src/config/scene';
const scene=devices.map(d=>({...d,on:true,generation:1,fault:null}));
const distance=(school:School)=>school.fish.filter(f=>!f.free).reduce((sum,f)=>sum+Math.min(...scene.slice(0,2).map(d=>Math.hypot(f.x-d.x,f.y-d.y))),0)/school.fish.filter(f=>!f.free).length;
describe('鱼群连续模拟',()=>{
it('多光区分别吸引，关灯后分散且不越界',()=>{const school=new School(),before=distance(school);let t=0;const levels=new Map(scene.slice(0,2).map(d=>[d.id,1]));for(let i=0;i<60*30;i++){t+=1/60;school.step(1/60,t,scene,levels);}const gathered=distance(school);expect(gathered).toBeLessThan(before*.65);for(const d of scene.slice(0,2))expect(school.fish.filter(f=>f.target===d.id).length).toBeGreaterThan(10);for(let i=0;i<60*40;i++){t+=1/60;school.step(1/60,t,scene,new Map());}expect(distance(school)).toBeGreaterThan(gathered*1.2);expect(school.fish.every(f=>f.x>=0 && f.x<=1 && f.y>=0 && f.y<=1)).toBe(true);});
it('重置恢复确定的初始鱼群',()=>{const school=new School();const initial=structuredClone(school.fish);school.step(.1,1,scene,new Map());school.reset();expect(school.fish).toEqual(initial);});
});
