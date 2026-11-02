import { devices as defaults, home, patrol, simulation, type DeviceConfig, type Point, type SimulationConfig } from '../config/scene';
import { angle } from './math';
import type { HardwareAdapter } from '../adapters/hardware';
import type { Device, KickResult, Observation, RobotState, Snapshot, SwitchInput } from './types';
export class Engine {
  devices: Device[]=[];
  queue: string[]=[];
  state: RobotState='PATROL';
  targetId: string|null=null;
  observation: Observation|null=null;
  time=0; paused=false; completed=0; attempts=0; message='模拟巡逻中';
  history: Snapshot['history']=[];
  lookBackResult = '尚未检查';
  private lookSamples = 0;
  private lastSample = 0;
  private lastVisible: boolean | null = null;
  private relocks = 0;
  private retreatDistance = 0;
  private returnPoint: Point = {...home}; private stable=0; private kickConfirmed=false;
  private elapsed=0; private lost=0; private waypoint=1; private taskId=0; private generation=0;
  constructor(readonly adapter: HardwareAdapter, readonly config: SimulationConfig={...simulation}, private definitions: DeviceConfig[]=defaults) {
    if(!(config.wSlow>0 && config.wStop>config.wSlow)) throw Error('需要 0 < W_slow < W_stop');
    if(new Set(definitions.map(d=>d.id)).size!==definitions.length || new Set(definitions.map(d=>d.tagId)).size!==definitions.length) throw Error('装置 ID 和 Tag ID 必须唯一');
    adapter.configure?.(config);
    adapter.onSwitch=input=>this.input(input);adapter.onKick=result=>this.kickResult(result);this.reset();
  }
  input(input: SwitchInput) {
    const d=this.devices.find(d=>d.id===input.deviceId);if(!d || d.on===input.on)return;
    d.on=input.on;
    if(d.on){d.generation++;d.fault=null;this.queue.push(d.id);}
    else this.queue=this.queue.filter(id=>id!==d.id);
  }
  setSwitch(id:string,on:boolean){this.adapter.setSwitch(id,on,this.time);}
  private kickResult(r:KickResult){
    const d=this.devices.find(d=>d.id===r.deviceId);
    if(!d || r.taskId!==this.taskId || d.generation!==r.generation || !['KICK','VERIFY_OFF'].includes(this.state))return;
    if(r.success){this.kickConfirmed=true;this.setSwitch(d.id,false);}
  }
  private transition(state:RobotState){
    if (state === 'LOOK_BACK') {
      this.lookSamples = 0;
      this.lastSample = this.time;
      this.lastVisible = null;
      this.lookBackResult = '转头观察中';
    }
    if (state === 'RETREAT') this.retreatDistance = 0;
    this.state=state;this.elapsed=0;this.lost=0;this.adapter.command({type:'stop'});
    this.history.push({time:this.time,state,targetId:this.targetId});if(this.history.length>80)this.history.shift();
    if(state==='KICK') { this.kickConfirmed=false;this.attempts++;this.adapter.command({type:'kick',deviceId:this.targetId!,generation:this.generation,taskId:this.taskId,switchPose:this.devices.find(d=>d.id===this.targetId)!.switchPose,reach:this.devices.find(d=>d.id===this.targetId)!.kickerReach}); }
  }
  private goTo(point:Point,speed:number){
    const p=this.adapter.pose;
    const direction=Math.atan2(point.y-p.y,point.x-p.x)*180/Math.PI;
    const distance=Math.hypot(point.x-p.x,point.y-p.y);
    const turn=this.state==='PATROL'?this.config.scanSpeed:Math.max(-this.config.turnSpeed,Math.min(this.config.turnSpeed,angle(direction-p.heading)*4));
    this.adapter.command({type:'drive',speed:Math.min(speed,distance*4),turn,direction});
    return distance<.006;
  }

  private turnToward(point: Point) {
    const pose = this.adapter.pose;
    const bearing = angle(Math.atan2(point.y - pose.y, point.x - pose.x) * 180 / Math.PI - pose.heading);
    const aligned = Math.abs(bearing) <= this.config.bearingTolerance;
    this.adapter.command({ type: 'drive', speed: 0, turn: aligned ? 0 : Math.max(-this.config.turnSpeed, Math.min(this.config.turnSpeed, bearing * 4)) });
    return aligned;
  }

  updateParameters(values: Pick<SimulationConfig, 'fov' | 'recognitionRange' | 'wSlow' | 'wStop'>) {
    if (this.state !== 'PATROL') throw Error('请在巡逻状态调整参数');
    if (!Object.values(values).every(Number.isFinite) || values.fov < 20 || values.fov > 160 || values.recognitionRange < .2 || values.recognitionRange > 1.5 || values.wSlow < 10 || values.wStop <= values.wSlow || values.wStop > 200) throw Error('参数超出范围，且必须满足 W_slow < W_stop');
    Object.assign(this.config, values);
    this.adapter.configure?.(this.config);
  }

  tick(dt:number){
    if(this.paused)return;
    this.time+=dt;this.elapsed+=dt;
    const beforeMove=this.devices.find(d=>d.id===this.targetId);
    if(beforeMove && ['DETECT','LOCK','RELOCK','ALIGN','APPROACH','STOP'].includes(this.state) && !this.adapter.observe(beforeMove,this.time).visible)this.adapter.command({type:'stop'});
    this.adapter.step(dt);
    const target=this.devices.find(d=>d.id===this.targetId);
    this.observation=target?this.adapter.observe(target,this.time):null;
    const active=['DETECT','LOCK','RELOCK','ALIGN','APPROACH','STOP'];
    if(target && active.includes(this.state) && (!target.on || target.generation!==this.generation)) {this.message='目标已关闭或重新开启，安全回程';this.transition('RETREAT');return;}
    if(target && ['DETECT','LOCK','RELOCK','ALIGN','APPROACH','STOP'].includes(this.state) && !this.observation?.visible){
      this.adapter.command({type:'stop'});this.stable=0;this.lost+=dt;if(this.state==='DETECT' || this.state==='STOP')this.elapsed=0;
      if(this.lost>=this.config.lostTimeout){this.message='Tag 丢失，取消本次接近';this.transition('RETREAT');}return;
    }
    this.lost=0;
    switch(this.state){
      case 'PATROL': {
        if(this.goTo(patrol[this.waypoint],this.config.speed*.7))this.waypoint=(this.waypoint+1)%patrol.length;
        const next=this.devices.find(d=>!d.fault && this.adapter.observe(d,this.time).visible);
        if(next && this.adapter.observe(next,this.time).visible){this.relocks=0;this.lookBackResult='尚未检查';this.returnPoint={x:this.adapter.pose.x,y:this.adapter.pose.y};this.stable=0;this.targetId=next.id;this.generation=next.generation;this.taskId++;this.attempts=0;this.message=`发现 ${next.name} · Tag ${next.tagId}`;this.transition('DETECT');}break;
      }
      case 'DETECT': if(this.elapsed>=this.config.detectTime)this.transition('LOCK');break;
      case 'LOCK': if(this.elapsed>=this.config.lockTime)this.transition('ALIGN');break;
      case 'ALIGN': {
        const bearing=this.observation!.bearing;
        if(Math.abs(bearing)<=this.config.bearingTolerance)this.transition('APPROACH');
        else this.adapter.command({type:'drive',speed:0,turn:Math.sign(bearing)*Math.min(this.config.turnSpeed,Math.abs(bearing)*4)});break;
      }
      case 'APPROACH': {
        const obs=this.observation!;
        if(obs.width>=this.config.wStop && Math.abs(obs.bearing)<=this.config.bearingTolerance){this.adapter.command({type:'stop'});this.stable++;if(this.stable>=this.config.stableFrames)this.transition('STOP');}
        else if(Math.abs(obs.bearing)>8)this.transition('ALIGN');
        else {
          this.stable = 0;
          const device = target!;
          const offsetX = device.approachPose.x - device.tagPose.x;
          const offsetY = device.approachPose.y - device.tagPose.y;
          const offsetLength = Math.hypot(offsetX, offsetY);
          const stoppingDistance = this.config.widthScale / this.config.wStop - .001;
          const destination = {
            x: device.tagPose.x + offsetX / offsetLength * stoppingDistance,
            y: device.tagPose.y + offsetY / offsetLength * stoppingDistance,
          };
          const direction = Math.atan2(destination.y-this.adapter.pose.y,destination.x-this.adapter.pose.x)*180/Math.PI;
          this.adapter.command({type:'drive',speed:obs.width>=this.config.wSlow?this.config.slowSpeed:this.config.speed,turn:obs.bearing*3,direction});
        }break;
      }
      case 'STOP': if(this.elapsed>=this.config.stopTime && this.adapter.pose.speed===0)this.transition('KICK');break;
      case 'KICK': if(this.elapsed>=this.config.kickTime)this.transition('VERIFY_OFF');break;
      case 'VERIFY_OFF':
        if(target && target.generation!==this.generation){this.message='目标已重新开启，旧任务终止';this.transition('RETREAT');}
        else if(target && this.kickConfirmed && !target.on && !this.observation?.visible){this.completed++;this.message='开关关闭已确认（模拟）';this.transition('RETREAT');}
        else if(target && !target.on){this.message='拨杆已由外部关闭，返回巡逻';this.transition('RETREAT');}
        else if(this.elapsed>=this.config.verifyTimeout){
          if(this.attempts<2)this.transition('KICK');else{if(target){target.fault='踢击确认失败';this.queue=this.queue.filter(id=>id!==target.id);}this.message='踢击失败，已隔离目标';this.transition('RETREAT');}
        }break;
      case 'RETREAT': {
        // Face the return route first, then leave the device before looking back.
        if (!this.turnToward(this.returnPoint)) break;
        if (this.retreatDistance >= .065 || Math.hypot(this.adapter.pose.x-this.returnPoint.x,this.adapter.pose.y-this.returnPoint.y)<.008) {
          this.transition('LOOK_BACK');
        } else {
          this.goTo(this.returnPoint, this.config.speed * .65);
          this.retreatDistance += this.adapter.pose.speed * dt;
        }
        break;
      }
      case 'LOOK_BACK': {
        if (!target) { this.transition('TURN_BACK'); break; }
        const aligned = this.turnToward(target.tagPose);
        const observation = this.observation!;
        if (aligned && observation.assessable && this.time - this.lastSample >= this.config.lookBackInterval) {
          this.lastSample = this.time;
          this.lookSamples = this.lastVisible === observation.visible ? this.lookSamples + 1 : 1;
          this.lastVisible = observation.visible;
          this.lookBackResult = `连续确认 ${this.lookSamples}/${this.config.lookBackSamples}`;
          if (this.lookSamples >= this.config.lookBackSamples) {
            if (observation.visible && !target.fault && this.relocks < this.config.maxRelocks) {
              this.lookBackResult = 'Tag 再次出现，重新锁定';
              this.relocks++;
              this.generation = target.generation;
              this.taskId++;
              this.attempts = 0;
              this.stable = 0;
              this.transition('RELOCK');
            } else {
              this.lookBackResult = observation.visible ? 'Tag 仍亮，重试上限或装置故障' : '连续确认 Tag 已消失';
              if (observation.visible) { target.fault = '回头检查重试上限'; this.queue = this.queue.filter(id => id !== target.id); }
              this.transition('TURN_BACK');
            }
          }
        } else if (!aligned || !observation.assessable) {
          this.lookSamples = 0;
          this.lastVisible = null;
        }
        if (this.state === 'LOOK_BACK' && this.elapsed >= this.config.lookBackTimeout) {
          this.lookBackResult = '视线受限，未确认关闭；返回巡逻';
          this.transition('TURN_BACK');
        }
        break;
      }
      case 'RELOCK':
        if (this.elapsed >= this.config.lockTime) this.transition('ALIGN');
        break;
      case 'TURN_BACK':
        if (this.turnToward(this.returnPoint)) this.transition('RETURN');
        break;
      case 'RETURN': if(this.goTo(this.returnPoint,this.config.speed*1.25))this.transition('RESUME');break;
      case 'RESUME': if(this.elapsed>=this.config.resumeTime){this.targetId=null;this.observation=null;this.message='模拟巡逻中';this.transition('PATROL');}break;
    }
  }
  reset(){this.lookBackResult='尚未检查';this.relocks=0;this.lookSamples=0;this.retreatDistance=0;this.returnPoint={...home};this.stable=0;this.kickConfirmed=false;this.taskId++;this.adapter.reset();this.devices=this.definitions.map(d=>({...d,on:false,generation:0,fault:null}));this.queue=[];this.targetId=null;this.observation=null;this.time=0;this.paused=false;this.completed=0;this.attempts=0;this.waypoint=1;this.history=[];this.message='模拟巡逻中';this.transition('PATROL');}
  snapshot():Snapshot{return structuredClone({time:this.time,paused:this.paused,state:this.state,targetId:this.targetId,devices:this.devices,queue:this.queue,pose:this.adapter.pose,observation:this.observation,attempts:this.attempts,completed:this.completed,message:this.message,history:this.history,source:'mock',kicker:this.adapter.kicker,patrolWaypoint:this.waypoint,fov:this.config.fov,recognitionRange:this.config.recognitionRange,lookBackResult:this.lookBackResult});}
}
