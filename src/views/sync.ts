import type { Snapshot } from '../core/types';
const channelName='vex-aim-lake-v1';
type Message={type:'hello'}|{type:'snapshot';snapshot:Snapshot}|{type:'goodbye'};
export function publish(getSnapshot:()=>Snapshot){
  const channel=new BroadcastChannel(channelName);
  const send=()=>channel.postMessage({type:'snapshot',snapshot:getSnapshot()} satisfies Message);
  channel.onmessage=event=>{if(event.data?.type==='hello')send();};
  const timer=setInterval(send,200);
  window.addEventListener('pagehide',()=>{channel.postMessage({type:'goodbye'} satisfies Message);clearInterval(timer);channel.close();},{once:true});
}
export function subscribe(render:(snapshot:Snapshot)=>void,status:(text:string)=>void){
  const channel=new BroadcastChannel(channelName);let last=0;
  channel.onmessage=(event:MessageEvent<Message>)=>{const m=event.data;
    if(m.type==='snapshot' && m.snapshot?.source==='mock'){last=Date.now();status('');render(m.snapshot);}
    if(m.type==='goodbye'){last=0;status('控制页面已断开 · 请保持湖面页面开启');}
  };
  channel.postMessage({type:'hello'} satisfies Message);status('等待湖面控制页面连接');
  const timer=setInterval(()=>{if(last && Date.now()-last>2500){last=0;status('控制页面已断开 · 请保持湖面页面开启');}if(!last)channel.postMessage({type:'hello'} satisfies Message);},1000);
  window.addEventListener('pagehide',()=>{clearInterval(timer);channel.close();},{once:true});
}
