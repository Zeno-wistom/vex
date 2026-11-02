import { subscribe } from './sync';
export function projector(root:HTMLElement){
  root.className='projector';const stage=document.createElement('div');stage.className='tag-stage';const status=document.createElement('p');status.className='connection';status.setAttribute('role','status');root.append(stage,status);
  let key: string | null=null;
  subscribe(s=>{const next=s.devices.filter(d=>d.on).map(d=>`${d.id}:${d.tagId}:${d.x}:${d.y}`).join('|');if(next===key)return;key=next;stage.replaceChildren();for(const d of s.devices){
    const board=document.createElement('div');board.className='projector-board';const label=document.createElement('span');label.textContent=`${d.name} · 竖直板 · ${d.on?'ON':'OFF'}`;board.append(label);stage.append(board);
    if(!d.on){const off=document.createElement('p');off.className='board-empty';off.textContent='光源关闭';board.append(off);continue;}
    const box=document.createElement('div');box.className='tag';box.style.left=`${d.x*100}%`;box.style.top=`${d.y*100}%`;
    const img=document.createElement('img');img.src=`/tags/tag-${d.tagId}.png`;img.alt=`VEX AprilTag ${d.tagId}`;
    img.onerror=()=>{box.textContent=`Tag ${d.tagId} 占位\n非可识别素材`;box.classList.add('placeholder');};box.append(img);board.append(box);
  }},text=>{status.textContent=text;stage.hidden=!!text;});
}
