// Original shallow-lake optics. The source projects the existing height field
// into a moving caustic map; no ocean mesh, skybox, or second ripple simulation.
export const waterVertex = `varying vec2 uv0; void main(){uv0=uv;gl_Position=vec4(position,1.);}`;

export const causticFragment = `
precision highp float;
varying vec2 uv0;
uniform sampler2D stateTex;
uniform vec2 texel;
uniform float time;
uniform float aspect;
uniform float intensity;
uniform vec4 lights[4];
float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash21(i),hash21(i+vec2(1.,0.)),f.x),mix(hash21(i+vec2(0.,1.)),hash21(i+1.),f.x),f.y);}
float cellRidge(vec2 p){vec2 id=floor(p),f=fract(p);float a=10.,b=10.;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
    vec2 g=vec2(float(x),float(y));vec2 key=id+g;
    vec2 point=g+vec2(hash21(key),hash21(key+23.7));
    point+=.16*sin(vec2(time*.43,time*.31)+key*1.37);
    vec2 d=point-f;float v=dot(d,d);if(v<a){b=a;a=v;}else if(v<b)b=v;
  }
  return 1.-smoothstep(.035,.20,sqrt(b)-sqrt(a));
}
void main(){
  float hL=texture2D(stateTex,uv0-vec2(texel.x,0.)).r;
  float hR=texture2D(stateTex,uv0+vec2(texel.x,0.)).r;
  float hD=texture2D(stateTex,uv0-vec2(0.,texel.y)).r;
  float hU=texture2D(stateTex,uv0+vec2(0.,texel.y)).r;
  vec2 slope=vec2(hR-hL,hU-hD);
  vec2 q=uv0*vec2(aspect,1.);
  vec2 flow=vec2(.025*time,-.018*time);
  vec2 warp=vec2(noise2(q*8.+flow),noise2(q*8.-flow+17.))-0.5;
  vec2 refr=uv0-slope*.50+warp*.0035;
  vec2 p=refr*vec2(aspect,1.)*10.5+warp*1.1+flow;
  float ridge=cellRidge(p)*.78+cellRidge(p*1.63+vec2(9.7,2.4)-flow*.8)*.22;
  vec2 dx=dFdx(refr),dy=dFdy(refr),ux=dFdx(uv0),uy=dFdy(uv0);
  float area=abs(dx.x*dy.y-dx.y*dy.x);
  float flatArea=max(abs(ux.x*uy.y-ux.y*uy.x),1e-8);
  float focus=clamp(flatArea/max(area,flatArea*.42),.65,1.65);
  float lamp=.28;
  for(int i=0;i<4;i++){
    vec4 l=lights[i];float dist=length((uv0-l.xy)*vec2(aspect,1.));
    lamp+=l.z*(1.-smoothstep(l.w*.12,l.w,dist))*1.35;
  }
  float c=clamp((ridge*.73+.12)*focus*lamp*intensity,0.,1.3);
  gl_FragColor=vec4(c,c,c,1.);
}`;

export const surfaceFragment = `
precision highp float;
varying vec2 uv0;
uniform sampler2D stateTex;
uniform sampler2D bottomTex;
uniform sampler2D causticTex;
uniform vec2 texel;
uniform float time;
uniform float aspect;
float ambient(vec2 p){
  vec2 q=p*vec2(aspect,1.);
  return .0025*sin(q.x*24.+q.y*11.+time*.63)*sin(q.y*16.-time*.43)
    +.0014*sin(q.x*51.-q.y*23.-time*.88);
}
float height(vec2 p){return texture2D(stateTex,clamp(p,0.,1.)).r+ambient(p);}
void main(){
  float h=height(uv0);
  vec2 slope=vec2(height(uv0+vec2(texel.x,0.))-height(uv0-vec2(texel.x,0.)),
                   height(uv0+vec2(0.,texel.y))-height(uv0-vec2(0.,texel.y)));
  vec2 refr=clamp(uv0-slope*.58,vec2(.002),vec2(.998));
  vec3 floorColor=texture2D(bottomTex,refr).rgb;
  float depth=.30+.35*smoothstep(.25,.78,refr.y)+.12*sin(refr.x*5.1+refr.y*2.7);
  vec3 water=mix(floorColor,vec3(.17,.46,.47),clamp(depth*.30,0.,.38));
  float caustic=texture2D(causticTex,refr).r;
  water+=vec3(.47,.55,.34)*caustic*.51;
  vec3 normal=normalize(vec3(-slope*24.,1.));
  vec3 sun=normalize(vec3(-.40,.32,1.));
  float spec=pow(max(dot(normal,sun),0.),55.);
  float broad=pow(max(dot(normal,normalize(vec3(-.22,.20,1.))),0.),8.);
  float rippleSheen=clamp(length(slope)*11.,0.,.26);
  // A broad directional light responds to the *computed* height-field slope.
  // This exposes the advancing bright/dark wavefront at exhibition scale.
  float waveLight=clamp(dot(slope,normalize(vec2(-.58,.82)))*34.,-.26,.35);
  float fresnel=.025+.075*pow(1.-normal.z,2.);
  water=mix(water,vec3(.66,.84,.77),fresnel);
  water+=vec3(.41,.47,.35)*(spec*.17+broad*.055+rippleSheen*.40);
  water+=vec3(.51,.61,.52)*waveLight;
  // Open-water ambient streaks are low contrast, while the simulated height
  // field creates the sharp moving refraction and glints at interaction sites.
  water+=vec3(.02,.047,.045)*sin(uv0.x*43.+uv0.y*27.+time*.51)*sin(uv0.y*19.-time*.34);
  gl_FragColor=vec4(clamp(water,0.,1.),1.);
}`;
