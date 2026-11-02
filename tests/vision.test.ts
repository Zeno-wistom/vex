import { describe, it, expect } from 'vitest';
import { Engine } from '../src/core/engine';
import { MockAdapter } from '../src/adapters/mock';
import { devices, simulation, safeArea } from '../src/config/scene';
import { angle } from '../src/core/math';
function setup(){ const adapter=new MockAdapter();return {adapter,engine:new Engine(adapter)}; }
function runUntil(engine:Engine, condition:()=>boolean, seconds=240){for(let i=0;i<seconds*60&&!condition();i++)engine.tick(1/60);expect(condition()).toBe(true);}
describe('视觉与机械几何回归',()=>{
  it('背后开灯不改变朝向，未进入视野不发现',()=>{
    const {adapter,engine}=setup();adapter.pose={x:.5,y:.5,heading:0,speed:0};
    engine.setSwitch('lamp-1',true);expect(adapter.pose.heading).toBe(0);expect(engine.targetId).toBeNull();
    engine.tick(1/60);expect(engine.state).toBe('PATROL');expect(adapter.observe(engine.devices[0],0).visible).toBe(false);
    runUntil(engine,()=>engine.state==='DETECT');expect(adapter.observe(engine.devices[0],engine.time).visible).toBe(true);
  });
  it('范围、板面背向、遮挡、关闭都禁止识别',()=>{
    const {adapter,engine}=setup();const d=engine.devices[0];engine.setSwitch(d.id,true);
    adapter.pose={x:.96,y:d.y,heading:180,speed:0};expect(adapter.observe(d,0).visible).toBe(false);
    adapter.pose={x:.5,y:d.y,heading:180,speed:0};expect(adapter.observe(d,0).visible).toBe(true);
    adapter.vision.occluders=[{x:.25,y:d.y,radius:.03}];expect(adapter.observe(d,0).visible).toBe(false);
    adapter.vision.occluders=[];d.facing=180;expect(adapter.observe(d,0).visible).toBe(false);
    d.facing=0;engine.setSwitch(d.id,false);expect(adapter.observe(d,0).visible).toBe(false);
  });
  it('自定义视觉参数通过正常 Engine 入口生效',()=>{
    const adapter=new MockAdapter();const engine=new Engine(adapter,{...simulation,recognitionRange:.2,fov:40});
    engine.setSwitch('lamp-1',true);adapter.pose={x:.5,y:.32,heading:180,speed:0};expect(adapter.observe(engine.devices[0],0).visible).toBe(false);
    expect(engine.snapshot().fov).toBe(40);
  });
  it('全向位移与连续朝向分离',()=>{
    const {adapter}=setup();adapter.pose={x:.5,y:.5,heading:0,speed:0};adapter.command({type:'drive',speed:.1,turn:20,direction:90});adapter.step(.1);
    expect(adapter.pose.x).toBeCloseTo(.5);expect(adapter.pose.y).toBeCloseTo(.51);expect(adapter.pose.heading).toBeCloseTo(2);
  });
  it('远处发现后连续接近、width 增大、返回任务前位置',()=>{
    const {adapter,engine}=setup();adapter.pose={x:.1,y:.6,heading:-90,speed:0};engine.setSwitch('lamp-1',true);
    runUntil(engine,()=>engine.state==='DETECT');const origin={...adapter.pose};
    runUntil(engine,()=>engine.state==='APPROACH');const firstWidth=engine.observation!.width;
    for(let frame=0;frame<120*60&&(engine.state==='APPROACH'||engine.state==='ALIGN');frame++){
      const before={...adapter.pose};engine.tick(1/60);
      expect(Math.hypot(adapter.pose.x-before.x,adapter.pose.y-before.y)).toBeLessThanOrEqual(simulation.speed/60+.00001);
      expect(Math.abs(angle(adapter.pose.heading-before.heading))).toBeLessThanOrEqual(simulation.turnSpeed/60+.00001);
    }
    expect(engine.state).toBe('STOP');expect(engine.observation!.width).toBeGreaterThan(firstWidth);
    runUntil(engine,()=>engine.completed===1&&engine.state==='PATROL');expect(Math.hypot(adapter.pose.x-origin.x,adapter.pose.y-origin.y)).toBeLessThan(.012);
  });
  it('首先看到的目标优先于开灯顺序，锁定后不会被打断',()=>{
    const {adapter,engine}=setup();adapter.pose={x:.5,y:.5,heading:0,speed:0};engine.setSwitch('lamp-1',true);engine.setSwitch('lamp-3',true);
    engine.tick(1/60);expect(engine.targetId).toBe('lamp-3');
    runUntil(engine,()=>engine.completed===1);expect(engine.devices[0].on).toBe(true);expect(engine.devices[2].on).toBe(false);
    runUntil(engine,()=>engine.completed===2&&engine.state==='PATROL');
  });
  it('Tag 丢失时当帧不再位移',()=>{
    const {adapter,engine}=setup();engine.setSwitch('lamp-1',true);runUntil(engine,()=>engine.state==='APPROACH');engine.tick(1/60);
    const before={...adapter.pose};adapter.faults.tagLost=true;engine.tick(1/60);expect(adapter.pose.x).toBe(before.x);expect(adapter.pose.y).toBe(before.y);expect(adapter.pose.speed).toBe(0);
  });
  it('Kicker 先伸出、接触后关闭、收回后后退',()=>{
    const {adapter,engine}=setup();engine.setSwitch('lamp-1',true);runUntil(engine,()=>engine.state==='KICK');
    engine.tick(.1);expect(adapter.kicker).toBeGreaterThan(0);expect(engine.devices[0].on).toBe(true);
    runUntil(engine,()=>!engine.devices[0].on,1);expect(adapter.kicker).toBeGreaterThan(.9);
    runUntil(engine,()=>engine.state==='RETREAT',2);expect(adapter.kicker).toBe(0);
  });
  it('触碰点不可达不会假报成功',()=>{
    const adapter=new MockAdapter();const definitions=structuredClone(devices);definitions[0].switchPose={x:-.3,y:.32};const engine=new Engine(adapter,{...simulation},definitions);
    engine.setSwitch('lamp-1',true);runUntil(engine,()=>!!engine.devices[0].fault);expect(engine.completed).toBe(0);expect(engine.devices[0].on).toBe(true);
  });
  it('四装置连续任务始终位于安全区域',()=>{
    const {adapter,engine}=setup();engine.devices.forEach(d=>engine.setSwitch(d.id,true));
    for(let i=0;i<360*60&&engine.completed<4;i++){engine.tick(1/60);expect(adapter.pose.x).toBeGreaterThanOrEqual(safeArea.min);expect(adapter.pose.x).toBeLessThanOrEqual(safeArea.max);expect(adapter.pose.y).toBeGreaterThanOrEqual(safeArea.min);expect(adapter.pose.y).toBeLessThanOrEqual(safeArea.max);}
    expect(engine.completed).toBe(4);
  });
});
