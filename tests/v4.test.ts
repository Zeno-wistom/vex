import { describe,it,expect } from 'vitest';
import { School } from '../src/visual/fish';
import { RippleBus,robotMotionRipples } from '../src/visual/ripple';

describe('V4 可见行为的生产数据',()=>{
  it('鱼完整上浮、破水、下潜，尾鳍随游速累计摆动',()=>{
    const school=new School(),fish=school.triggerSurface();expect(fish).not.toBeNull();
    const initial=fish!.baseDepth,phase=fish!.tailPhase;
    let peak=0,breach=0,pulses=0;
    for(let i=0;i<110;i++){school.step(1/60,i/60,[],new Map());peak=Math.max(peak,fish!.surfaceVisual);breach=Math.max(breach,fish!.breach);if(fish!.surfacePulse)pulses++;}
    expect(peak).toBeGreaterThan(.9);expect(breach).toBeGreaterThan(.9);expect(pulses).toBe(1);
    expect(fish!.depth).toBeCloseTo(initial,6);expect(fish!.tailPhase).toBeGreaterThan(phase);
  });
  it('速度尾流退到机器人后方，急转出现局部冲击，静止不续尾流',()=>{
    const straight=robotMotionRipples({x:.5,y:.5,speed:.06,direction:0},{x:.51,y:.5,speed:.09});
    expect(straight[0].type).toBe('wake');expect(straight[1].x).toBeLessThan(straight[0].x);
    const turn=robotMotionRipples({x:.5,y:.5,speed:.09,direction:0},{x:.5,y:.51,speed:.09});
    expect(turn.some(e=>e.type==='impact')).toBe(true);
    expect(robotMotionRipples({x:.5,y:.51,speed:0},{x:.5,y:.51,speed:0})).toEqual([]);
  });
  it('非法方向被拒绝且事件上限仍生效',()=>{
    const bus=new RippleBus();expect(bus.emit({x:.5,y:.5,radius:.02,strength:.02,direction:Infinity,type:'wake',sourceId:'bad'})).toBe(false);
    for(let i=0;i<64;i++)expect(bus.emit({x:.5,y:.5,radius:.02,strength:.02,type:'fish',sourceId:String(i)})).toBe(true);
    expect(bus.emit({x:.5,y:.5,radius:.02,strength:.02,type:'fish',sourceId:'overflow'})).toBe(false);
  });
});
