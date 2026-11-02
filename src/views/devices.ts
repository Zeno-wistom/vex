import type { Device, Snapshot } from '../core/types';
import { sceneLayout } from '../visual/layout';
export function deviceViews(root: HTMLElement, devices: Device[], debug: boolean, toggle: (id:string)=>void) {
  const buttons = devices.map(d => {
    const button = document.createElement('button');
    button.className = 'device light-hit';button.dataset.device=d.id;
    button.setAttribute('aria-label', `${d.name}灯光`);
    button.innerHTML = `<span class="device-base"></span><span class="mount-arm"></span><span class="vertical-board"><img src="/tags/tag-${d.tagId}.png" alt="AprilTag ${d.tagId}"><span class="board-off">TAG ${d.tagId}</span></span><span class="projector-module"><i></i></span><span class="projection-beam"></span><span class="physical-toggle"><i></i></span><span class="hit-label">${d.name} · OFF</span>`;
    button.onclick=()=>toggle(d.id);root.append(button);
    return button;
  });
  const layout=()=>{
    const box=sceneLayout(debug);
    devices.forEach((d,i)=>{
      const nx=Math.cos(d.facing*Math.PI/180),ny=Math.sin(d.facing*Math.PI/180);
      buttons[i].style.left=`${box.x+d.x*box.width-nx*34}px`;
      buttons[i].style.top=`${box.y+d.y*box.height-ny*34}px`;
      buttons[i].style.setProperty('--facing',`${d.facing}deg`);
      const arm=buttons[i].querySelector<HTMLElement>('.mount-arm')!;
      arm.style.width=`${34+Math.hypot((d.switchPose.x-d.x)*box.width,(d.switchPose.y-d.y)*box.height)}px`;
      arm.style.transform=`rotate(${d.facing}deg)`;
      buttons[i].dataset.facing=String(d.facing);
      const lever=buttons[i].querySelector<HTMLElement>('.physical-toggle')!;
      lever.style.left=`${43+nx*34+(d.switchPose.x-d.x)*box.width}px`;
      lever.style.top=`${43+ny*34+(d.switchPose.y-d.y)*box.height}px`;
      buttons[i].querySelector<HTMLElement>('.vertical-board')!.style.transform=`skewY(${nx*12-ny*4}deg)`;
    });
  };
  layout();window.addEventListener('resize',layout);
  return (s:Snapshot)=>s.devices.forEach((d,i)=>{
    const b=buttons[i];b.setAttribute('aria-pressed',String(d.on));b.classList.toggle('lit',d.on);
    b.querySelector('.hit-label')!.textContent=`${d.name} · ${d.on?'ON':'OFF'}`;
  });
}
