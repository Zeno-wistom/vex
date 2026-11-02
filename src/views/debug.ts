import { gsap } from 'gsap';
import type { Engine } from '../core/engine';
import type { MockAdapter } from '../adapters/mock';
import type { Snapshot } from '../core/types';
import type { Lake } from '../visual/lake';
const names:Record<string,string>={PATROL:'沿岸巡游',DETECT:'识别 Tag',LOCK:'锁定目标',ALIGN:'调整朝向',APPROACH:'接近开关',STOP:'停止移动',KICK:'踢击开关',VERIFY_OFF:'确认关闭',RETREAT:'掉头离开',LOOK_BACK:'回头检查',TURN_BACK:'转回路线',RELOCK:'再次锁定',RETURN:'返回起点',RESUME:'恢复巡逻'};
export function debugPanel(root:HTMLElement,engine:Engine,adapter:MockAdapter,lake:Lake,reset:()=>void,fullscreen:()=>void){
  const container=document.createElement('aside');container.className='debug';container.innerHTML=`
    <header><div><span class="eyebrow">VEX AIM / INTERACTIVE STUDY</span><h1>巡湖<span>视觉驱动模拟。</span></h1></div><button class="collapse" aria-label="收起调试面板" aria-expanded="true">−</button></header>
    <div class="panel-content"><p class="mock-badge"><i></i> 浏览器模拟 · 未连接硬件</p>
    <section class="robot-status"><div class="section-label">巡湖机器人 <span id="sim-time">00:00</span></div><div class="state-line"><strong id="state-name"></strong><code id="state-code"></code></div><p id="message"></p>
    <div class="telemetry"><div><span>目标 TAG</span><b id="target">—</b></div><div><span>模拟 bearing</span><b id="bearing">—</b></div><div><span>模拟 width</span><b id="width">—</b></div></div>
    <p id="look-back" role="status"></p><p id="geometry" class="geometry"></p><div class="width-track"><i id="width-fill"></i><span style="left:${engine.config.wSlow/250*100}%" title="W_slow=${engine.config.wSlow}"></span><span style="left:${engine.config.wStop/250*100}%" title="W_stop=${engine.config.wStop}"></span></div><div class="thresholds"><span>减速 ${engine.config.wSlow}</span><span>停止 ${engine.config.wStop} 模拟 px</span></div></section>
    <section><div class="section-label">岸边灯光 <span id="queue-count"></span></div><div id="switches"></div></section>
    <p class="queue">待处理 <span id="queue">无</span></p><button class="demo primary">运行完整交互</button>
    <div class="actions"><button id="pause">暂停</button><button id="reset">重置</button><button id="fullscreen">全屏</button></div>
    <details class="visual-tests"><summary>视觉效果测试</summary><div class="visual-buttons">
      <button data-visual="single">单个强波纹</button><button data-visual="cross">交叉波纹</button><button data-visual="surface">鱼浮出</button>
      <button data-visual="wake">加速尾流</button><button data-visual="stop">停止冲击波</button><button data-visual="light">切换西湾灯光</button></div>
      <form id="visual-parameters"><label>水面质量 <select name="waterQuality"><option value="auto">自动</option><option value="high">高</option><option value="medium">中</option><option value="low">低</option></select></label>
      <label>波纹强度 <input name="rippleStrength" type="range" min="0.4" max="2" step="0.1" value="1"></label>
      <label>焦散光强度 <input name="causticStrength" type="range" min="0" max="2.5" step="0.1" value="1"></label>
      <label>尾流强度 <input name="wakeStrength" type="range" min="0.4" max="2" step="0.1" value="1"></label>
      <label>水花强度 <input name="splashStrength" type="range" min="0.3" max="2" step="0.1" value="1"></label>
      <label>鱼浮出频率 <input name="surfaceRate" type="range" min="0.4" max="2" step="0.1" value="1"></label></form></details>
    <div class="links"><a href="/?view=projector" target="_blank" rel="noopener">打开投影预览 ↗</a><a href="/">纯净展示 ↗</a></div>
    <details class="parameters"><summary>模拟参数</summary><form id="parameters">
      <label>视野角度 <input name="fov" type="number" min="20" max="160" value="${engine.config.fov}" required></label>
      <label>识别距离 <input name="recognitionRange" type="number" min="0.2" max="1.5" step="0.05" value="${engine.config.recognitionRange}" required></label>
      <label>W_slow <input name="wSlow" type="number" min="10" max="199" value="${engine.config.wSlow}" required></label>
      <label>W_stop <input name="wStop" type="number" min="11" max="200" value="${engine.config.wStop}" required></label>
      <button type="submit">应用模拟参数</button><p id="parameter-result" role="status">巡逻时可应用，机械距离仍需标定</p></form></details>
    <details><summary>模拟故障与状态记录</summary><label><input type="checkbox" id="lost"> Tag 暂时丢失</label><label><input type="checkbox" id="failure"> Kicker 踢击失败</label><ol id="history"></ol></details>
    <footer>点击岸边实体拨杆切换开关 · F 全屏<br>width 与 bearing 均为模拟观测数据</footer></div>`;
  root.append(container);
  const query=<T extends HTMLElement>(s:string)=>container.querySelector<T>(s)!;
  for(const d of engine.devices){const button=document.createElement('button');button.className='switch-row';button.dataset.id=d.id;button.setAttribute('aria-label',`${d.name}开关`);button.innerHTML=`<span class="device-number">0${d.tagId+1}</span><span class="device-name">${d.name}<small>TAG ${d.tagId}</small></span><span class="switch-state">OFF</span><span class="toggle"><i></i></span>`;button.onclick=()=>engine.setSwitch(d.id,!engine.devices.find(x=>x.id===d.id)!.on);query('#switches').append(button);}
  query('.demo').onclick=()=>{reset();engine.setSwitch(engine.devices[0].id,true);};
  container.querySelectorAll<HTMLButtonElement>('[data-visual]').forEach(button=>button.onclick=()=>{
    const kind=button.dataset.visual;
    if(kind==='light'){const id=engine.devices[0].id;engine.setSwitch(id,!engine.devices[0].on);}
    else lake.visualTest(kind as 'single'|'cross'|'surface'|'wake'|'stop',engine.adapter.pose);
  });
  query<HTMLFormElement>('#visual-parameters').oninput=e=>{const target=e.target as HTMLInputElement|HTMLSelectElement;
    const value=Number(target.value);
    if(target.name==='waterQuality')lake.water.setQuality(target.value as 'auto'|'low'|'medium'|'high');
    if(target.name==='rippleStrength')lake.water.rippleStrength=value;
    if(target.name==='causticStrength')lake.water.setCausticIntensity(value);
    if(target.name==='wakeStrength')lake.wakeStrength=value;
    if(target.name==='splashStrength')lake.splashStrength=value;
    if(target.name==='surfaceRate')lake.school.surfaceRate=value;
  };
  query('#pause').onclick=()=>{engine.paused=!engine.paused;};query('#reset').onclick=reset;query('#fullscreen').onclick=fullscreen;
  query<HTMLInputElement>('#lost').onchange=e=>{adapter.faults.tagLost=(e.target as HTMLInputElement).checked;};
  query<HTMLInputElement>('#failure').onchange=e=>{adapter.faults.kickFailure=(e.target as HTMLInputElement).checked;};
  let collapsed=false;query('.collapse').onclick=()=>{collapsed=!collapsed;const content=query('.panel-content');content.hidden=collapsed;query('.collapse').textContent=collapsed?'+':'−';query('.collapse').setAttribute('aria-expanded',String(!collapsed));query('.collapse').setAttribute('aria-label',collapsed?'展开调试面板':'收起调试面板');if(!collapsed)gsap.fromTo(content,{opacity:0,y:-5},{opacity:1,y:0,duration:.25});};
  query<HTMLFormElement>('#parameters').onsubmit=e=>{
    e.preventDefault();
    const data=new FormData(query<HTMLFormElement>('#parameters'));
    try {
      engine.updateParameters({fov:Number(data.get('fov')),recognitionRange:Number(data.get('recognitionRange')),wSlow:Number(data.get('wSlow')),wStop:Number(data.get('wStop'))});
      query('#parameter-result').textContent='模拟参数已应用';
      query('.thresholds').textContent=`减速 ${engine.config.wSlow} / 停止 ${engine.config.wStop} 模拟 px`;
      container.querySelectorAll<HTMLElement>('.width-track span').forEach((mark,i)=>{const value=i===0?engine.config.wSlow:engine.config.wStop;mark.style.left=`${value/250*100}%`;mark.title=String(value);});
    } catch(error) { query('#parameter-result').textContent=(error as Error).message; }
  };
  let historyKey='';
  return(s:Snapshot)=>{
    query('#sim-time').textContent=`${Math.floor(s.time/60).toString().padStart(2,'0')}:${Math.floor(s.time%60).toString().padStart(2,'0')}`;
    query('#state-name').textContent=names[s.state];query('#state-code').textContent=s.state;query('#message').textContent=s.message;
    query('#target').textContent=s.targetId?String(s.devices.find(d=>d.id===s.targetId)!.tagId):'—';query('#bearing').textContent=s.observation?`${s.observation.bearing.toFixed(1)}°`:'—';query('#width').textContent=s.observation?s.observation.width.toFixed(1):'—';
    query('#look-back').textContent=`回头检查 · ${s.lookBackResult}`;
    query('#geometry').textContent=`位置 (${s.pose.x.toFixed(3)}, ${s.pose.y.toFixed(3)}) · heading ${s.pose.heading.toFixed(1)}°\n中央椭圆巡逻 · FOV ${s.fov}° / 范围 ${s.recognitionRange}\nTag ${s.observation?.visible?'可见':'未发现'} · 距离 ${s.observation?.distance.toFixed(3)??'—'}\nKicker ${s.kicker>0?`伸出 ${(s.kicker*100).toFixed(0)}%`:'收回'}`;
    query('#width-fill').style.width=`${Math.min(100,(s.observation?.width??0)/250*100)}%`;
    query('#pause').textContent=s.paused?'继续':'暂停';query('#queue-count').textContent=`${s.devices.filter(d=>d.on).length} / ${s.devices.length} 亮起`;
    query('#queue').textContent=s.queue.map(id=>s.devices.find(d=>d.id===id)!.name).join(' → ')||'无';
    for(const d of s.devices){const b=query<HTMLButtonElement>(`[data-id="${d.id}"]`);b.classList.toggle('on',d.on);b.setAttribute('aria-pressed',String(d.on));b.querySelector('.switch-state')!.textContent=d.fault?'故障':d.on?'ON':'OFF';}
    query<HTMLInputElement>('#lost').checked=adapter.faults.tagLost;query<HTMLInputElement>('#failure').checked=adapter.faults.kickFailure;
    const key=s.history.map(h=>`${h.time}:${h.state}`).join();if(key!==historyKey){historyKey=key;query('#history').innerHTML=s.history.slice(-12).reverse().map(h=>`<li><time>${h.time.toFixed(1)}s</time> ${h.state}</li>`).join('');}
  };
}
