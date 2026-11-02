import * as THREE from 'three';

// A single seeded floor texture gives refraction something concrete to displace.
// It is uploaded once; no Canvas-to-GPU transfer occurs in the render loop.
export function createLakeBed():THREE.CanvasTexture {
  let seed=26717;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=576;
  const c=canvas.getContext('2d')!,w=canvas.width,h=canvas.height;
  const base=c.createLinearGradient(0,0,w,h);
  base.addColorStop(0,'#a6c8b5');base.addColorStop(.34,'#6fa49d');
  base.addColorStop(.67,'#578c8b');base.addColorStop(1,'#91b6a7');
  c.fillStyle=base;c.fillRect(0,0,w,h);
  for(let i=0;i<95;i++){
    const x=random()*w,y=random()*h,r=35+random()*125;
    const shallow=i%4===0;
    const g=c.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,shallow?'rgba(224,210,162,.20)':'rgba(21,81,83,.17)');
    g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(x-r,y-r,2*r,2*r);
  }
  // Small pebbles and silt remain visible through moving refraction.
  for(let i=0;i<9200;i++){
    const x=random()*w,y=random()*h,r=.25+random()*2.2;
    c.fillStyle=i%3===0?'rgba(245,228,179,.17)':'rgba(24,82,81,.12)';
    c.beginPath();c.ellipse(x,y,r,r*(.35+random()*.5),random()*3.14,0,Math.PI*2);c.fill();
  }
  // Soft, submerged frond shadows are distributed near both long shores.
  for(let i=0;i<55;i++){
    const x=random()*w,y=i%2===0?-12:h+12,sign=i%2===0?1:-1;
    const length=26+random()*82;
    c.strokeStyle='rgba(23,76,61,.12)';c.lineWidth=3+random()*7;
    c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+16,y+sign*length*.65,x+10,y+sign*length);c.stroke();
    for(let j=0;j<5;j++){
      const py=y+sign*length*(.28+j*.14),px=x+5+j;
      c.fillStyle='rgba(23,77,62,.09)';c.beginPath();
      c.ellipse(px+(j%2?9:-9),py,14,4,(j%2?-.5:.5),0,Math.PI*2);c.fill();
    }
  }
  const texture=new THREE.CanvasTexture(canvas);
  texture.wrapS=THREE.ClampToEdgeWrapping;texture.wrapT=THREE.ClampToEdgeWrapping;
  texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;
  return texture;
}
