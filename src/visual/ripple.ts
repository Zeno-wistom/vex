export type RippleType = 'fish' | 'surface' | 'wake' | 'impact' | 'dock';
export interface RippleEvent { x:number; y:number; radius:number; strength:number; direction?:number; type:RippleType; sourceId:string }
export class RippleBus {
  private pending:RippleEvent[]=[];
  readonly maxQueue=64;
  emit(event:RippleEvent){
    if(![event.x,event.y,event.radius,event.strength,event.direction??0].every(Number.isFinite))return false;
    if(event.x<0||event.x>1||event.y<0||event.y>1||event.radius<=0)return false;
    if(this.pending.length>=this.maxQueue)return false;
    this.pending.push({...event,radius:Math.max(.004,Math.min(.08,event.radius)),strength:Math.max(-.035,Math.min(.035,event.strength))});
    return true;
  }
  drain(limit=12){return this.pending.splice(0,limit);}
  clear(){this.pending=[];}
  get length(){return this.pending.length;}
}
export function robotMotionRipples(previous:{x:number;y:number;speed:number;direction?:number}|null,current:{x:number;y:number;speed:number},sourceId='robot'):RippleEvent[]{
  if(!previous)return [];
  const distance=Math.hypot(current.x-previous.x,current.y-previous.y);
  if(previous.speed>.025&&current.speed===0)return[{x:current.x,y:current.y,radius:.026,strength:.026,type:'dock',sourceId}];
  if(distance<=.00001||current.speed<=0)return [];
  const acceleration=Math.max(0,current.speed-previous.speed);
  const direction=Math.atan2(current.y-previous.y,current.x-previous.x)*180/Math.PI;
  const events:RippleEvent[]=[{x:current.x,y:current.y,radius:.015,strength:Math.min(.032,.005+current.speed*.17+acceleration*.11),direction,type:'wake',sourceId}];
  if(current.speed>.04){
    const angle=direction*Math.PI/180,back=.022,side=.010;
    events.push({x:Math.max(0,Math.min(1,current.x-Math.cos(angle)*back-Math.sin(angle)*side)),y:Math.max(0,Math.min(1,current.y-Math.sin(angle)*back+Math.cos(angle)*side)),radius:.009,strength:-.008-current.speed*.035,direction,type:'wake',sourceId});
  }
  const turn=previous.direction===undefined?0:Math.abs(Math.atan2(Math.sin((direction-previous.direction)*Math.PI/180),Math.cos((direction-previous.direction)*Math.PI/180)));
  if(acceleration>.045||turn>.45)events.push({x:current.x,y:current.y,radius:.018,strength:.020,type:'impact',sourceId});
  return events;
}
