import { describe,it,expect } from 'vitest';
import { RippleBus,robotMotionRipples } from '../src/visual/ripple';
import { School } from '../src/visual/fish';
import { Engine } from '../src/core/engine';
import { MockAdapter } from '../src/adapters/mock';
import { devices,simulation } from '../src/config/scene';

describe('V3 水面事件与生态',()=>{
  it('事件验证、限幅、排队与清空',()=>{const bus=new RippleBus();expect(bus.emit({x:.5,y:.5,radius:.5,strength:1,type:'impact',sourceId:'test'})).toBe(true);
    expect(bus.emit({x:Infinity,y:.5,radius:.01,strength:1,type:'impact',sourceId:'test'})).toBe(false);
    for(let i=0;i<63;i++)expect(bus.emit({x:.5,y:.5,radius:.01,strength:.01,type:'fish',sourceId:String(i)})).toBe(true);
    expect(bus.emit({x:.5,y:.5,radius:.01,strength:.01,type:'fish',sourceId:'overflow'})).toBe(false);
    const events=bus.drain(12);expect(events).toHaveLength(12);expect(events[0].radius).toBe(.08);expect(events[0].strength).toBe(.035);
    bus.clear();expect(bus.length).toBe(0);});
  it('速度尾流有方向，冲刺触发短冲击，停下仅产生一次停靠波纹',()=>{
    const moving=robotMotionRipples({x:.5,y:.5,speed:.02},{x:.51,y:.5,speed:.09});expect(moving.map(e=>e.type)).toEqual(['wake','impact']);expect(moving[0].direction).toBe(0);
    const stopped=robotMotionRipples({x:.51,y:.5,speed:.09},{x:.51,y:.5,speed:0});expect(stopped.map(e=>e.type)).toEqual(['dock']);
    expect(robotMotionRipples({x:.51,y:.5,speed:0},{x:.51,y:.5,speed:0})).toEqual([]);
  });
  it('90 条鱼的浮出低频、异步且同时不超过两条',()=>{const school=new School();expect(school.fish).toHaveLength(90);let pulses=0,max=0;
    for(let i=0;i<60*90;i++){school.step(1/60,i/60,[],new Map());pulses+=school.fish.filter(f=>f.surfacePulse).length;max=Math.max(max,school.fish.filter(f=>f.surfaceTimer>0).length);}
    expect(pulses).toBeGreaterThan(0);expect(pulses).toBeLessThan(300);expect(max).toBeLessThanOrEqual(2);
    const clone=new School();for(let i=0;i<60*90;i++)clone.step(1/60,i/60,[],new Map());expect(clone.fish).toEqual(school.fish);});
  it('双光区目标保留到关灯，不在亮区间逐帧抖动',()=>{const school=new School(),scene=devices.slice(0,2).map(d=>({...d,on:true,generation:1,fault:null}));
    const levels=new Map(scene.map(d=>[d.id,1]));for(let i=0;i<600;i++)school.step(1/60,i/60,scene,levels);
    const targets=school.fish.map(f=>f.target);for(let i=600;i<1200;i++)school.step(1/60,i/60,scene,levels);
    expect(school.fish.map(f=>f.target)).toEqual(targets);
    for(let i=1200;i<1300;i++)school.step(1/60,i/60,scene,new Map());expect(school.fish.every(f=>f.target===null)).toBe(true);});
});

describe('V3 巡逻与任务',()=>{
  it('长期无灯巡逻留在中央椭圆附近，并不按矩形路点行驶',()=>{const e=new Engine(new MockAdapter()),a=simulation.ellipse;let max=0;
    for(let i=0;i<60*180;i++){e.tick(1/60);const p=e.adapter.pose;max=Math.max(max,((p.x-a.x)/a.rx)**2+((p.y-a.y)/a.ry)**2);}
    expect(e.state).toBe('PATROL');expect(max).toBeLessThan(1.08);expect(e.adapter.pose.x).not.toBe(.1);});
  it('同时首见多个 Tag 时选择视野中心较近者',()=>{const defs=devices.slice(0,2).map((d,i)=>({...d,id:`test-${i}`,tagId:i,x:.8,y:i===0?.48:.6,tagPose:{x:.8,y:i===0?.48:.6,z:.07},switchPose:{x:.77,y:i===0?.48:.6},approachPose:{x:.73,y:i===0?.48:.6},facing:180}));
    const adapter=new MockAdapter(),e=new Engine(adapter,{...simulation},defs);adapter.pose.heading=0;e.setSwitch('test-1',true);e.setSwitch('test-0',true);e.tick(1/60);expect(e.targetId).toBe('test-0');expect(e.state).toBe('DETECT');});
  it('短 Kicker 的停止中心距满足前端加行程触碰',()=>{const e=new Engine(new MockAdapter());e.setSwitch('lamp-1',true);
    for(let i=0;i<60*120&&e.state!=='STOP';i++)e.tick(1/60);expect(e.state).toBe('STOP');
    const d=e.devices[0],p=e.adapter.pose,dist=Math.hypot(p.x-d.switchPose.x,p.y-d.switchPose.y);
    expect(dist).toBeGreaterThan(.028);expect(dist).toBeLessThan(d.kickerReach);expect(d.kickerReach).toBe(.054);});
});
