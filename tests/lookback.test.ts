import { it, expect } from 'vitest';
import { Engine } from '../src/core/engine';
import { MockAdapter } from '../src/adapters/mock';
function setup(){const adapter=new MockAdapter();const engine=new Engine(adapter);engine.setSwitch('lamp-1',true);return {adapter,engine};}
function until(e:Engine,p:()=>boolean,seconds=150){for(let i=0;i<seconds*60&&!p();i++)e.tick(1/60);expect(p()).toBe(true);}
it('离开后回望，连续确认消失，再返回巡逻',()=>{
 const {engine:e}=setup();until(e,()=>e.state==='LOOK_BACK');const position={...e.adapter.pose};
 until(e,()=>e.state==='TURN_BACK');expect(e.lookBackResult).toContain('连续确认 Tag 已消失');expect(e.adapter.pose.x).toBe(position.x);expect(e.adapter.pose.y).toBe(position.y);
 until(e,()=>e.state==='PATROL');expect(e.completed).toBe(1);
});
it('离开期间重新开启，回望后重新锁定并再次关闭',()=>{
 const {engine:e}=setup();until(e,()=>e.state==='RETREAT');e.setSwitch('lamp-1',true);
 until(e,()=>e.state==='RELOCK');expect(e.lookBackResult).toContain('再次出现');expect(e.targetId).toBe('lamp-1');
 until(e,()=>e.completed===2&&e.state==='PATROL');expect(e.devices[0].on).toBe(false);
});
it('回望期间传感器失效不会误判关闭',()=>{
 const {engine:e,adapter}=setup();until(e,()=>e.state==='LOOK_BACK');adapter.faults.tagLost=true;
 until(e,()=>e.state==='TURN_BACK');expect(e.lookBackResult).toContain('未确认');
});
it('一帧缺失不能中断连续可见检查并假报关闭',()=>{
 const {engine:e,adapter}=setup();until(e,()=>e.state==='LOOK_BACK');e.setSwitch('lamp-1',true);
 until(e,()=>e.lookBackResult.includes('连续确认'));adapter.faults.tagLost=true;e.tick(1/60);adapter.faults.tagLost=false;
 expect(e.state).toBe('LOOK_BACK');until(e,()=>e.state==='RELOCK');
});
it('反复重开有上限，故障隔离后仍可回归巡逻',()=>{
 const {engine:e}=setup();
 for(let cycle=0;cycle<3;cycle++){
  until(e,()=>e.state==='RETREAT');e.setSwitch('lamp-1',true);
  until(e,()=>e.state==='RELOCK'||e.state==='TURN_BACK');
  if(cycle<2)expect(e.state).toBe('RELOCK');
 }
 expect(e.devices[0].fault).toContain('上限');until(e,()=>e.state==='PATROL');expect(e.devices[0].on).toBe(true);
});
it('参数合法性与任务中更新保护',()=>{
 const a=new MockAdapter(),e=new Engine(a);e.updateParameters({fov:80,recognitionRange:.7,wSlow:60,wStop:105});expect(a.vision.config.fov).toBe(80);
 expect(()=>e.updateParameters({fov:80,recognitionRange:.7,wSlow:110,wStop:105})).toThrow();e.setSwitch('lamp-1',true);until(e,()=>e.state==='ALIGN');
 expect(()=>e.updateParameters({fov:90,recognitionRange:.7,wSlow:60,wStop:105})).toThrow();
});
it('改变停止 width 后仍能停靠并关闭，Kicker 行程保持固定',()=>{
 const adapter=new MockAdapter(),e=new Engine(adapter);e.updateParameters({fov:100,recognitionRange:.85,wSlow:80,wStop:120});e.setSwitch('lamp-1',true);
 until(e,()=>e.completed===1&&e.state==='PATROL');expect(e.devices[0].kickerReach).toBe(.105);
});
