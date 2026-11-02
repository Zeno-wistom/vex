import { describe,it,expect } from 'vitest';
import { Engine } from '../src/core/engine';
import { MockAdapter } from '../src/adapters/mock';
import { simulation,home } from '../src/config/scene';
function setup(){const adapter=new MockAdapter();return {adapter,engine:new Engine(adapter)};}
function until(e:Engine,p:()=>boolean,seconds=120){for(let i=0;i<seconds*60 && !p();i++)e.tick(1/60);expect(p()).toBe(true);}
describe('机器人模拟',()=>{
it('四个目标依次完成且不饿死队列末项',()=>{const {engine:e}=setup();e.devices.forEach(d=>e.setSwitch(d.id,true));until(e,()=>e.completed===4 && e.state==='PATROL',360);expect(e.queue).toEqual([]);expect(e.devices.every(d=>!d.on)).toBe(true);});
it('依次完成全部状态并回到中央巡逻',()=>{const {engine:e}=setup();e.setSwitch('lamp-1',true);until(e,()=>e.completed===1 && e.state==='PATROL');expect(e.devices[0].on).toBe(false);expect(e.history.map(h=>h.state)).toEqual(['PATROL','DETECT','LOCK','ALIGN','APPROACH','STOP','KICK','VERIFY_OFF','RETREAT','LOOK_BACK','TURN_BACK','RETURN','RESUME','PATROL']);const p=e.adapter.pose,a=simulation.ellipse;expect(((p.x-a.x)/a.rx)**2+((p.y-a.y)/a.ry)**2).toBeLessThan(1);});
it('锁定目标不被新灯抢占且重复 ON 不入队',()=>{const {engine:e}=setup();e.setSwitch('lamp-1',true);until(e,()=>e.state==='APPROACH');e.setSwitch('lamp-2',true);e.setSwitch('lamp-2',true);expect(e.queue).toEqual(['lamp-1','lamp-2']);expect(e.targetId).toBe('lamp-1');until(e,()=>e.completed===2,240);});
it('达到停止阈值才停止，速度为零才踢击',()=>{const {engine:e}=setup();e.setSwitch('lamp-1',true);until(e,()=>e.state==='STOP');expect(e.observation!.width).toBeGreaterThanOrEqual(100);expect(e.adapter.pose.speed).toBe(0);expect(e.attempts).toBe(0);until(e,()=>e.state==='KICK');expect(e.adapter.pose.speed).toBe(0);});
it('减速阈值及参数校验',()=>{const {engine:e}=setup();e.setSwitch('lamp-1',true);until(e,()=>e.state==='APPROACH' && (e.observation?.width??0)>=70);expect(e.adapter.pose.speed).toBe(simulation.slowSpeed);expect(()=>new Engine(new MockAdapter(),{...simulation,wStop:50})).toThrow();});
it('手动关闭取消接近',()=>{const {engine:e}=setup();e.setSwitch('lamp-1',true);until(e,()=>e.state==='APPROACH');e.setSwitch('lamp-1',false);e.tick(1/60);expect(e.state).toBe('RETREAT');expect(e.attempts).toBe(0);});
it('Tag 丢失立即停，超时回程',()=>{const {engine:e,adapter:a}=setup();e.setSwitch('lamp-1',true);until(e,()=>e.state==='APPROACH');a.faults.tagLost=true;e.tick(1/60);expect(a.pose.speed).toBe(0);until(e,()=>e.state==='RETREAT',3);});
it('短暂丢失后重新获得可继续',()=>{const {engine:e,adapter:a}=setup();e.setSwitch('lamp-1',true);until(e,()=>e.state==='APPROACH');a.faults.tagLost=true;for(let i=0;i<30;i++)e.tick(1/60);a.faults.tagLost=false;until(e,()=>e.completed===1);});
it('踢击失败最多两次，隔离故障，重新开灯清除',()=>{const {engine:e,adapter:a}=setup();a.faults.kickFailure=true;e.setSwitch('lamp-1',true);until(e,()=>!!e.devices[0].fault);expect(e.attempts).toBe(2);expect(e.queue).toEqual([]);expect(e.devices[0].on).toBe(true);e.setSwitch('lamp-1',false);e.setSwitch('lamp-1',true);expect(e.devices[0].fault).toBeNull();expect(e.queue).toEqual(['lamp-1']);});
it('重新开灯不接受旧代次踢击结果',()=>{const {engine:e}=setup();e.setSwitch('lamp-1',true);until(e,()=>e.state==='KICK');e.setSwitch('lamp-1',false);e.setSwitch('lamp-1',true);for(let i=0;i<50;i++)e.tick(1/60);expect(e.devices[0].on).toBe(true);expect(e.completed).toBe(0);});
it('暂停及重置清空挂起动作',()=>{const {engine:e}=setup();e.setSwitch('lamp-1',true);until(e,()=>e.state==='KICK');e.paused=true;const before=e.snapshot();for(let i=0;i<120;i++)e.tick(1/60);expect(e.snapshot()).toEqual(before);e.reset();for(let i=0;i<120;i++)e.tick(1/60);expect(e.completed).toBe(0);expect(e.devices.every(d=>!d.on)).toBe(true);expect(e.queue).toEqual([]);});
});
