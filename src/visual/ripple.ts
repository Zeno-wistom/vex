export type RippleType = 'fish' | 'surface' | 'wake' | 'impact' | 'dock';
export interface RippleEvent { x:number; y:number; radius:number; strength:number; direction?:number; type:RippleType; sourceId:string }
export class RippleBus {
  private pending:RippleEvent[]=[];
  readonly maxQueue=64;
  emit(event:RippleEvent){
    if(![event.x,event.y,event.radius,event.strength].every(Number.isFinite))return false;
    if(event.x<0||event.x>1||event.y<0||event.y>1||event.radius<=0)return false;
    if(this.pending.length>=this.maxQueue)return false;
    this.pending.push({...event,radius:Math.max(.004,Math.min(.08,event.radius)),strength:Math.max(-.035,Math.min(.035,event.strength))});
    return true;
  }
  drain(limit=12){return this.pending.splice(0,limit);}
  clear(){this.pending=[];}
  get length(){return this.pending.length;}
}
export function robotMotionRipples(previous:{x:number;y:number;speed:number}|null,current:{x:number;y:number;speed:number},sourceId='robot'):RippleEvent[]{
  if(!previous)return [];
  const distance=Math.hypot(current.x-previous.x,current.y-previous.y);
  if(previous.speed>.025&&current.speed===0)return[{x:current.x,y:current.y,radius:.016,strength:.007,type:'dock',sourceId}];
  if(distance<=.00001||current.speed<=0)return [];
  const acceleration=Math.max(0,current.speed-previous.speed);
  const direction=Math.atan2(current.y-previous.y,current.x-previous.x)*180/Math.PI;
  const events:RippleEvent[]=[{x:current.x,y:current.y,radius:.013,strength:Math.min(.015,.003+current.speed*.035+acceleration*.07),direction,type:'wake',sourceId}];
  if(acceleration>.045)events.push({x:current.x,y:current.y,radius:.018,strength:.016,type:'impact',sourceId});
  return events;
}
