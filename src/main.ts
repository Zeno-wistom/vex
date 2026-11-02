import { deviceViews } from './views/devices';
import './style.css';
import { Engine } from './core/engine';
import { Clock } from './core/clock';
import { MockAdapter } from './adapters/mock';
import { Lake } from './visual/lake';
import { debugPanel } from './views/debug';
import { projector } from './views/projector';
import { publish } from './views/sync';
const root=document.querySelector<HTMLElement>('#app')!;
const params=new URLSearchParams(location.search);
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{const p=document.createElement('p');p.className='toast';p.textContent='浏览器未允许全屏，请使用浏览器全屏菜单';root.append(p);setTimeout(()=>p.remove(),3500);}}
window.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='f' && !(e.target instanceof HTMLInputElement)){e.preventDefault();void fullscreen();}});
if(params.get('view')==='projector')projector(root);
else {
  const debug=params.get('debug')==='1';root.className=debug?'lake debug-mode':'lake';
  const canvas=document.createElement('canvas');canvas.setAttribute('aria-label','自然日光湖面，四个岸边装置与巡湖机器人');root.append(canvas);
  const adapter=new MockAdapter(),engine=new Engine(adapter),lake=new Lake(canvas,debug);
  const reset=()=>{engine.reset();lake.reset();};
  const update=debug?debugPanel(root,engine,adapter,reset,()=>void fullscreen()):()=>{};
  const updateDevices=deviceViews(root,engine.devices,debug,id=>engine.setSwitch(id,!engine.devices.find(d=>d.id===id)!.on));
  const caption=document.createElement('div');caption.className='scene-caption';caption.innerHTML='<span>VEX AIM · INTERACTIVE ECOSYSTEM</span><h2>一方水域</h2><p>拨动岸边开关，观察光、鱼群与巡湖机器人的相遇。</p>';root.append(caption);
  const controls=document.createElement('div');controls.className='scene-controls';
  controls.innerHTML='<span>浏览器模拟</span><button id="vision-toggle" aria-pressed="false">摄像头视野</button><button id="scene-fullscreen">全屏</button>';
  root.append(controls);controls.querySelector<HTMLButtonElement>('#vision-toggle')!.onclick=e=>{lake.showVision=!lake.showVision;(e.currentTarget as HTMLButtonElement).setAttribute('aria-pressed',String(lake.showVision));};
  controls.querySelector<HTMLButtonElement>('#scene-fullscreen')!.onclick=()=>void fullscreen();
  let snapshot=engine.snapshot(),uiTime=0;
  const clock=new Clock(dt=>{engine.tick(dt);snapshot=engine.snapshot();if(!engine.paused)lake.step(dt,snapshot);uiTime+=dt;
    if(uiTime>.1){uiTime=0;update(snapshot);updateDevices(snapshot);}

  },()=>lake.draw(snapshot));
  // Only one controlling lake tab may own this origin's simulation.
  const start=()=>{publish(()=>engine.snapshot());clock.start();update(snapshot);};
  if(navigator.locks){void navigator.locks.request('vex-aim-lake-controller',{ifAvailable:true},async lock=>{if(!lock){root.innerHTML='<div class="connection">已有湖面控制页开启。请关闭另一控制页后刷新，或打开 <a href="/?view=projector">投影预览</a>。</div>';return;}start();await new Promise<void>(resolve=>window.addEventListener('pagehide',()=>resolve(),{once:true}));});}else start();
}
