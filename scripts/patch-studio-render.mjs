#!/usr/bin/env node
// Applies the host's rendering-quality patch to a customer Solar Studio build.
// Usage: node scripts/patch-studio-render.mjs <customer-studio.html> [output=client/public/studio.html]
// Only renderer / camera / post-processing statements, the advisor endpoint check and the
// building-core roof parameters are touched;
// the energy, system, location and shading scripts stay byte-identical (tests/customer-core-parity.test.ts).
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const MARKER = '<meta name="modernite-render-patch" content="v3">';

const FXAA_VERTEX = "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}";
const FXAA_FRAGMENT = [
  "uniform sampler2D tDiffuse;uniform vec2 resolution;varying vec2 vUv;",
  "void main(){vec2 px=resolution;vec4 m=texture2D(tDiffuse,vUv);vec3 luma=vec3(.299,.587,.114);",
  "float nw=dot(texture2D(tDiffuse,vUv+vec2(-1.,-1.)*px).rgb,luma),ne=dot(texture2D(tDiffuse,vUv+vec2(1.,-1.)*px).rgb,luma),",
  "sw=dot(texture2D(tDiffuse,vUv+vec2(-1.,1.)*px).rgb,luma),se=dot(texture2D(tDiffuse,vUv+vec2(1.,1.)*px).rgb,luma),lm=dot(m.rgb,luma);",
  "float lo=min(lm,min(min(nw,ne),min(sw,se))),hi=max(lm,max(max(nw,ne),max(sw,se)));",
  "vec2 dir=vec2(-((nw+ne)-(sw+se)),(nw+sw)-(ne+se));float reduce=max((nw+ne+sw+se)*(.25/8.),1./128.);",
  "dir=clamp(dir/(min(abs(dir.x),abs(dir.y))+reduce),vec2(-8.),vec2(8.))*px;",
  "vec3 a=.5*(texture2D(tDiffuse,vUv+dir*(1./3.-.5)).rgb+texture2D(tDiffuse,vUv+dir*(2./3.-.5)).rgb);",
  "vec3 b=a*.5+.25*(texture2D(tDiffuse,vUv-dir*.5).rgb+texture2D(tDiffuse,vUv+dir*.5).rgb);",
  "float lb=dot(b,luma);gl_FragColor=vec4((lb<lo||lb>hi)?a:b,m.a);}",
].join("");

// Lower envelope of roof planes over the building rectangle; must match lib/roof-planes.ts.
// Heights are relative to the wall top; points are [x, height, z] in the building frame.
const ROOF_PLANES = [
  "const ModerniteRoofPlanes=(()=>{",
  "const H=(p,x,z)=>p.a*x+p.b*z+p.k;",
  "function clip(poly,f){const out=[];for(let i=0;i<poly.length;i++){const A=poly[i],B=poly[(i+1)%poly.length],fa=f(A),fb=f(B);if(fa<=0)out.push(A);if(fa<=0!==fb<=0){const t=fa/(fa-fb);out.push([A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t]);}}return out;}",
  "function clean(poly){const out=[];for(const p of poly){const q=out[out.length-1];if(!q||Math.hypot(p[0]-q[0],p[1]-q[1])>1e-6)out.push(p);}if(out.length>1&&Math.hypot(out[0][0]-out[out.length-1][0],out[0][1]-out[out.length-1][1])<=1e-6)out.pop();return out.filter((p,i)=>{const a=out[(i+out.length-1)%out.length],b=out[(i+1)%out.length];return Math.abs((p[0]-a[0])*(b[1]-a[1])-(p[1]-a[1])*(b[0]-a[0]))>1e-7;});}",
  "const area=poly=>poly.reduce((s,p,i)=>{const q=poly[(i+1)%poly.length];return s+p[0]*q[1]-q[0]*p[1];},0)/2;",
  // Faces start at their lowest level edge (the eaves): tiles and skylights are laid in rows along the first edge.
  "function eaves(poly,p){let best=-1,bh=Infinity,bl=0;poly.forEach((A,i)=>{const B=poly[(i+1)%poly.length],ha=H(p,A[0],A[1]),hb=H(p,B[0],B[1]),len=Math.hypot(B[0]-A[0],B[1]-A[1]),mid=(ha+hb)/2;if(Math.abs(ha-hb)<1e-6&&(mid<bh-1e-6||(Math.abs(mid-bh)<=1e-6&&len>bl))){best=i;bh=mid;bl=len;}});return best>0?[...poly.slice(best),...poly.slice(0,best)]:poly;}",
  "function cells(planes,w,d){const rect=[[w/2,d/2],[-w/2,d/2],[-w/2,-d/2],[w/2,-d/2]];return planes.map((p,i)=>{let poly=rect;planes.forEach((q,j)=>{if(j!==i&&poly.length)poly=clip(poly,([x,z])=>H(p,x,z)-H(q,x,z)+(j<i?1e-7:-1e-7));});return {plane:i,poly:eaves(clean(poly),p)};}).filter(c=>c.poly.length>=3&&area(c.poly)>1e-3);}",
  "const z=(planes,x,y)=>Math.min(...planes.map(p=>H(p,x,y)));",
  "function faces(planes,w,d){return cells(planes,w,d).map(c=>c.poly.map(([x,y])=>[x,H(planes[c.plane],x,y),y]));}",
  "function top(planes,w,d){return Math.max(...faces(planes,w,d).flat().map(p=>p[1]));}",
  "function level(planes,w,y){const a=z(planes,-w/2,y),b=z(planes,0,y),c=z(planes,w/2,y);return Math.max(a,b,c)-Math.min(a,b,c)<.05;}",
  // Wall infill under the roof along each side of the wall rectangle, wound to face outwards.
  "function gables(planes,w,d){const out=[];for(const [P,Q,n] of [[[w/2,-d/2],[w/2,d/2],[1,0]],[[-w/2,d/2],[-w/2,-d/2],[-1,0]],[[w/2,d/2],[-w/2,d/2],[0,1]],[[-w/2,-d/2],[w/2,-d/2],[0,-1]]]){const at=s=>[P[0]+(Q[0]-P[0])*s,P[1]+(Q[1]-P[1])*s],lin=p=>{const A=H(p,...P),B=H(p,...Q);return [A,B-A];},ss=new Set([0,1]);for(let i=0;i<planes.length;i++)for(let j=i+1;j<planes.length;j++){const [a0,a1]=lin(planes[i]),[b0,b1]=lin(planes[j]);if(Math.abs(a1-b1)>1e-9){const s=(b0-a0)/(a1-b1);if(s>0&&s<1)ss.add(s);}}",
  "const prof=[...ss].sort((a,b)=>a-b).map(s=>{const [x,y]=at(s);return [x,Math.max(0,z(planes,x,y)),y];});if(Math.max(...prof.map(p=>p[1]))<.05)continue;",
  "let poly=[[P[0],0,P[1]],...prof,[Q[0],0,Q[1]]].filter((p,i,arr)=>i===0||Math.hypot(p[0]-arr[i-1][0],p[1]-arr[i-1][1],p[2]-arr[i-1][2])>1e-6);if(Math.hypot(poly[0][0]-poly[poly.length-1][0],poly[0][1]-poly[poly.length-1][1],poly[0][2]-poly[poly.length-1][2])<=1e-6)poly.pop();",
  "let nx=0,nz=0;for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length];nx+=(p[1]-q[1])*(p[2]+q[2]);nz+=(p[0]-q[0])*(p[1]+q[1]);}if(nx*n[0]+nz*n[1]<0)poly.reverse();if(poly.length>=3)out.push(poly);}return out;}",
  "function valid(planes){return Array.isArray(planes)&&planes.length>=2&&planes.length<=12&&planes.every(p=>p&&[p.a,p.b,p.k].every(Number.isFinite)&&Math.abs(p.a)<=2&&Math.abs(p.b)<=2&&Math.abs(p.k)<=60);}",
  "return {faces,gables,top,level,z,valid};})();",
].join("");

const PATCHES = [
  {
    id: "renderer-power",
    find: "Ie=new Fc({antialias:!0,preserveDrawingBuffer:!0})",
    replace: 'Ie=new Fc({antialias:!0,preserveDrawingBuffer:!0,powerPreference:"high-performance"})',
  },
  {
    id: "desktop-pixel-ratio",
    find: "Ie.setPixelRatio(Math.min(devicePixelRatio,Sl?1.25:1.5));",
    replace: "Ie.setPixelRatio(Math.min(devicePixelRatio,Sl?1.25:2));",
  },
  {
    // EffectComposer targets are not multisampled, so the canvas `antialias` flag has no effect.
    // MSAA on the half-float targets turns sub-pixel HDR highlights into white speckles, so
    // anti-aliasing runs as FXAA on the tone-mapped output instead.
    id: "fxaa",
    find: "br.addPass(new Xc);var un=",
    replace: `br.addPass(new Xc);var mrFxaa=new Gc({uniforms:{tDiffuse:{value:null},resolution:{value:new dt(1/1024,1/1024)}},vertexShader:${JSON.stringify(FXAA_VERTEX)},fragmentShader:${JSON.stringify(FXAA_FRAGMENT)}}),mrSize=new dt;br.addPass(mrFxaa);var un=`,
  },
  {
    // SSAOPass only copies camera near/far/projection at construction and on resize; the Studio
    // changes them on every framing, so AO depth reconstruction drifts and shimmers.
    // AO distances are rescaled to keep the customer's tuning (defined against far = 700).
    id: "ssao-camera-sync",
    find: "Yn.maxDistance=.045;br.addPass(Yn);",
    replace:
      "Yn.maxDistance=.045;br.addPass(Yn);{const mrRender=br.render.bind(br),mrMin=Yn.minDistance,mrMax=Yn.maxDistance,mrSpan=700-.12;br.render=d=>{const u=Yn.ssaoMaterial.uniforms,k=mrSpan/Math.max(1e-3,ln.far-ln.near);u.cameraNear.value=ln.near;u.cameraFar.value=ln.far;u.cameraProjectionMatrix.value.copy(ln.projectionMatrix);u.cameraInverseProjectionMatrix.value.copy(ln.projectionMatrixInverse);Yn.depthRenderMaterial.uniforms.cameraNear.value=ln.near;Yn.depthRenderMaterial.uniforms.cameraFar.value=ln.far;Yn.minDistance=mrMin*k;Yn.maxDistance=mrMax*k;if(mrFxaa){Ie.getDrawingBufferSize(mrSize);mrFxaa.uniforms.resolution.value.set(1/mrSize.x,1/mrSize.y)}mrRender(d)}}",
  },
  {
    id: "resize-order",
    find: "Ie.setSize(i,t,!1),br.setSize(i,t),ln.aspect=i/t,ln.updateProjectionMatrix()",
    replace: "Ie.setSize(i,t,!1),ln.aspect=i/t,ln.updateProjectionMatrix(),br.setSize(i,t)",
  },
  {
    // A fixed 0.12 m near plane leaves ~3 mm depth precision at 80 m, below the model's
    // 2–5 mm layer offsets, which z-fight as the camera orbits.
    id: "adaptive-near-plane",
    find: "var V1=performance.now(),Lf=0;function eA(i){requestAnimationFrame(eA),!(document.hidden||i-Lf<28)&&(Lf=i,Ce.update(),Bf.frame(ln,(i-V1)/1e3),br.render())}",
    replace:
      "var V1=performance.now(),Lf=0;function mrNear(){let n=Math.min(3,Math.max(.05,ln.position.distanceTo(Ce.target)*.015));if(Math.abs(n-ln.near)>ln.near*.02){ln.near=n;ln.updateProjectionMatrix()}}function eA(i){requestAnimationFrame(eA),!(document.hidden||i-Lf<28)&&(Lf=i,Ce.update(),Bf.frame(ln,(i-V1)/1e3),mrNear(),br.render())}",
  },
  {
    // The advisor's online mode only accepts absolute https endpoints. The host serves the advisor
    // on its own origin (also over plain http on the preview IP), so same-origin URLs are allowed too.
    id: "advisor-same-origin",
    find: 'if(R=new URL(Wt("advisor-endpoint").value),R.protocol!=="https:"||R.username',
    replace: 'if(R=new URL(Wt("advisor-endpoint").value,location.href),R.protocol!=="https:"&&R.origin!==location.origin||R.username',
  },
  {
    // Roof form and pitch come from the fixed building type; these three patches let
    // ModerniteEnergyBridge.setDimensions() override them (from the map's roof model or the user).
    id: "parametric-roof-values",
    find: "return {...{width:base.width*units,depth:base.depth,floors:base.floors,storeyHeight:base.storeyHeight||2.95,wwr:.2},...(saved||{})};",
    replace: "return {...{width:base.width*units,depth:base.depth,floors:base.floors,storeyHeight:base.storeyHeight||2.95,wwr:.2,roofForm:base.roofForm,pitch:base.pitch},...(saved||{})};",
  },
  {
    id: "parametric-roof-config",
    find: "wwr:d.wwr,parametric:true};}",
    replace: "wwr:d.wwr,parametric:true,...(Number.isFinite(d.pitch)?{pitch:d.pitch}:{}),...(d.roofForm?{roofForm:d.roofForm}:{}),...(d.roofForm==='custom'?{roofPlanes:d.roofPlanes}:{}),...(d.chimney===false?{chimney:false}:{}),...(['x','z'].includes(d.ridgeAxis)?{ridgeAxis:d.ridgeAxis}:{})};}",
  },
  {
    id: "parametric-roof-cache",
    find: "moderniteDimensionCache[Gt.id]={width:d.width,depth:d.depth,floors:d.floors,storeyHeight:d.storeyHeight,wwr:d.wwr};",
    replace: "moderniteDimensionCache[Gt.id]={width:d.width,depth:d.depth,floors:d.floors,storeyHeight:d.storeyHeight,wwr:d.wwr,...(Number.isFinite(d.pitch)?{pitch:Math.min(55,Math.max(5,d.pitch))}:{}),...(['hip','gable','flat','mono'].includes(d.roofForm)?{roofForm:d.roofForm}:{}),...(d.roofForm==='custom'&&ModerniteRoofPlanes.valid(d.roofPlanes)&&(Gt.units||1)===1&&!(Gt.region==='JP'&&['detached','bungalow'].includes(Gt.kind))?{roofForm:'custom',roofPlanes:d.roofPlanes.map(p=>({a:p.a,b:p.b,k:p.k}))}:{}),...(d.chimney===false?{chimney:false}:{}),...(['x','z'].includes(d.ridgeAxis)?{ridgeAxis:d.ridgeAxis}:{})};",
  },
  {
    // UK pitched houses always get a chimney stack; setDimensions({chimney:false}) removes it for homes without one.
    id: "chimney-optional",
    find: 'if(p==="UK"&&O!=="flat"&&i.kind!=="bungalow"){',
    replace: 'if(p==="UK"&&O!=="flat"&&i.kind!=="bungalow"&&i.chimney!==false){',
  },
  {
    // Measured multi-plane roofs (roofForm 'custom'): faces, wall infill, gutters and chimney follow the planes.
    id: "roof-planes-core",
    find: "root.ModerniteBuildingCore={values,validate,change,metrics,config};",
    replace: `${ROOF_PLANES}root.ModerniteRoofPlanes=ModerniteRoofPlanes;root.ModerniteBuildingCore={values,validate,change,metrics,config};`,
  },
  {
    id: "roof-planes-infill",
    find: 'if(O==="mono"){$(n,"HighMonoWall"',
    replace: 'if(O==="custom")for(let C of ModerniteRoofPlanes.gables(i.roofPlanes,r,a))Sa(n,"Gable",C.map(([x,h,y])=>[x,c+h,y]),d);if(O==="mono"){$(n,"HighMonoWall"',
  },
  {
    id: "roof-planes-faces",
    find: "F=fr({width:r+2*l,depth:z,eave:J,pitch:E,form:O,z:B})",
    replace: 'F=O==="custom"?ModerniteRoofPlanes.faces(i.roofPlanes,r+2*l,z).map((P,K)=>Ap("slope_"+K,P.map(([x,h,y])=>[x,c+h,y+B]))):fr({width:r+2*l,depth:z,eave:J,pitch:E,form:O,z:B})',
  },
  {
    id: "roof-planes-gutters",
    find: 'for(let ot of[-1,1]){let ct=ot>0?C:0,K=O==="mono"&&ot<0?c+(a+l)*W:c-(l+ct)*W;',
    replace: 'for(let ot of[-1,1]){if(O==="custom"&&!ModerniteRoofPlanes.level(i.roofPlanes,r+2*l,ot*(a/2+l)))continue;let ct=ot>0?C:0,K=O==="custom"?c+ModerniteRoofPlanes.z(i.roofPlanes,0,ot*(a/2+l)):O==="mono"&&ot<0?c+(a+l)*W:c-(l+ct)*W;',
  },
  {
    id: "roof-planes-chimney",
    find: "B=c+Math.min(a,r)/2*W+.75",
    replace: 'B=(O==="custom"?c+ModerniteRoofPlanes.top(i.roofPlanes,r,a):O==="mono"?c+a*.66*W:c+Math.min(a,r)/2*W)+.75',
  },
  {
    // The Japanese timber-house builder only draws gable and mono-pitch roofs (hip fell back to gable).
    // Hip is the lower envelope of four planes over the roof rectangle, eaves level with the gable's.
    id: "timber-house-hip",
    find: 'let N;if(i.roofForm==="mono"){N=fr({width:n+2*c,depth:W+2*c,eave:o-c*M,pitch:i.pitch,form:"mono",z:F})',
    replace: 'let N;if(i.roofForm==="hip"){N=ModerniteRoofPlanes.faces([{a:-M,b:0,k:M*n/2},{a:M,b:0,k:M*n/2},{a:0,b:-M,k:M*W/2},{a:0,b:M,k:M*W/2}],n+2*c,W+2*c).map((P,K)=>Ap("slope_"+K,P.map(([x,h,y])=>[x,o+h,y+F])))}else if(i.roofForm==="mono"){N=fr({width:n+2*c,depth:W+2*c,eave:o-c*M,pitch:i.pitch,form:"mono",z:F})',
  },
  {
    // Embedded in the Modernité platform (studio.html?embed=modernite): the host owns the AI advisor and
    // sizes the inverter/battery at the final calculation, so hide the duplicates before first paint.
    id: "embed-host-chrome",
    find: '<meta charset="utf-8">',
    replace: `<meta charset="utf-8"><script>if(new URLSearchParams(location.search).get('embed')==='modernite')document.documentElement.classList.add('embed-modernite');</script><style>html.embed-modernite body #install-help,html.embed-modernite body>.advisor-launcher,html.embed-modernite .stage-actions>.advisor-launcher,html.embed-modernite body #open-advisor,html.embed-modernite body #advisor-top,html.embed-modernite body #advisor-dialog,html.embed-modernite body .en-system-card{display:none!important}html.embed-modernite body.advisor-open>.app{margin:0!important}</style>`,
  },
  {
    // Embedded: automatic re-runs of the hourly shadow/energy model wait until the energy dialog is open.
    id: "embed-deferred-energy",
    find: "function queue(){runId++;",
    replace: "function auto(){if(new URLSearchParams(location.search).get('embed')!=='modernite'||dialog.open)return run();runId++;clearTimeout(timer);window.ModerniteShadows.cancel();shadowProgress=null;dirty=true;result=null;renderResult();}\nfunction queue(){runId++;",
  },
  {
    id: "embed-deferred-orientation",
    find: ";state.p.north=value;syncOrientation();dirty=true;result=null;persist();build();run();}",
    replace: ";state.p.north=value;syncOrientation();dirty=true;result=null;persist();build();auto();}",
  },
  {
    id: "embed-deferred-restore",
    find: "syncOrientation();dirty=true;build();run();window.dispatchEvent(new Event('modernite-energy-site-change'));}},getResult",
    replace: "syncOrientation();dirty=true;build();auto();window.dispatchEvent(new Event('modernite-energy-site-change'));}},getResult",
  },
  {
    id: "embed-deferred-site",
    find: "state.weather=null;dirty=true;result=null;persist();build();run();},",
    replace: "state.weather=null;dirty=true;result=null;persist();build();auto();},",
  },
  {
    id: "embed-deferred-weather",
    find: "state.weather=weather;dirty=true;build();run();},",
    replace: "state.weather=weather;dirty=true;build();auto();},",
  },
  {
    id: "embed-deferred-model",
    find: "dirty=true;result=null;build();if(dialog.open){run();}else{clearTimeout(timer);timer=setTimeout(run,150);}});",
    replace: "dirty=true;result=null;build();if(dialog.open){run();}else{clearTimeout(timer);timer=setTimeout(auto,150);}});",
  },
  {
    id: "embed-deferred-initial",
    find: " syncOrientation();build();run();\n})();",
    replace: " syncOrientation();build();auto();\n})();",
  },
  {
    // The host loads site weather only when the Studio's energy model actually needs it.
    id: "weather-on-demand",
    find: "if(state.site&&!state.weather)throw Error(lang()===0?'此地址的气象尚未就绪",
    replace: "if(state.site&&!state.weather){window.dispatchEvent(new Event('modernite-weather-needed'));throw Error(lang()===0?'此地址的气象尚未就绪",
  },
  {
    id: "weather-on-demand-close",
    find: "'Weather for the confirmed location is not ready. Load it in 01 Building.');const weather=currentWeather()",
    replace: "'Weather for the confirmed location is not ready. Load it in 01 Building.');}const weather=currentWeather()",
  },
  {
    // Lets the platform advisor reuse the Studio's instant answers and configuration summary.
    id: "advisor-core-bridge",
    find: "document.body.append(r);let a=[],s=!1,o=null,c=0;",
    replace: "document.body.append(r);window.ModerniteAdvisorCore={context:()=>dl(hi.snapshot()),answer:(q,intent)=>Wf(q,hi.snapshot(),intent),label:key=>kt(key,$e())};let a=[],s=!1,o=null,c=0;",
  },
  {
    // Coplanar faces z-fight (flicker) as the camera moves. Walls are 0.28 m boxes whose outer face is
    // the facade plane: the room ceiling behind each window started on that plane, and the end walls
    // ran the full depth through the front/rear wall corners. The street top matched the lawn top.
    id: "zfight-room-ceiling",
    find: '$(i,"RoomCeiling",[a,.08,r],[t.u,n+e-.19,-r/2],st("interior","#d8d2c4"))',
    replace: '$(i,"RoomCeiling",[a,.08,r-.3],[t.u,n+e-.19,-r/2-.15],st("interior","#d8d2c4"))',
  },
  {
    id: "zfight-end-walls",
    find: 'Us(n,{id:i.id+"_end_"+C,origin:[C*r/2,0,0],angle:C*Math.PI/2,width:a,',
    replace: 'Us(n,{id:i.id+"_end_"+C,origin:[C*r/2,0,0],angle:C*Math.PI/2,width:a-.56,',
  },
  {
    id: "zfight-door-threshold",
    find: '$(e,"DoorThreshold",[n+.19,.06,.33],[0,.01,.09],st("stone","#b3b2a4"))',
    replace: '$(e,"DoorThreshold",[n+.19,.06,.33],[0,.013,.09],st("stone","#b3b2a4"))',
  },
  {
    id: "zfight-street",
    find: 'Ft(t,"Residential_Street",[n+6,.08,4],[a,-.15,e.max.z+4.2]',
    replace: 'Ft(t,"Residential_Street",[n+6,.08,4],[a,-.145,e.max.z+4.2]',
  },
  {
    // Front-garden railing: the customer only looks for a door within the deck span around the unit
    // centre, so a door near the side of the unit left the entrance gap under a window. Look across the
    // whole unit front (ground floor first, then nearest) and slide the deck so its gap meets the door.
    id: "railing-door-align",
    find: 'let c=i.width,l=i.depth,u=t?.config.baseHeight||.28,p=t?bp(t):0,d=t?t.depth/2+l/2+.06:0;Ft(n,"Terrace_Deck",[c+.3,.16,l+.25],[p,u-.09,d],e.paving);let h=t?al(t,"front"):[],S=h.filter(b=>b.kind==="door"&&Math.abs(b.x-p)<c/2).sort((b,m)=>b.y-m.y)[0],x=1.2,',
    replace: 'let c=i.width,l=i.depth,u=t?.config.baseHeight||.28,p=t?bp(t):0,d=t?t.depth/2+l/2+.06:0;let h=t?al(t,"front"):[],w=t?t.config.width:c,S=h.filter(b=>b.kind==="door"&&Math.abs(b.x-p)<w/2).sort((b,m)=>Math.round(b.y*2)-Math.round(m.y*2)||Math.abs(b.x-p)-Math.abs(m.x-p))[0];S&&w>c&&(p=Pf(S.x,p-w/2+c/2,p+w/2-c/2));Ft(n,"Terrace_Deck",[c+.3,.16,l+.25],[p,u-.09,d],e.paving);let x=1.2,',
  },
];

const [input, output = "client/public/studio.html"] = process.argv.slice(2);
if (!input) {
  console.error("Usage: node scripts/patch-studio-render.mjs <customer-studio.html> [output]");
  process.exit(2);
}

let html = readFileSync(input, "utf8");
const sha = (text) => createHash("sha256").update(text).digest("hex");
if (html.includes(MARKER)) {
  console.error("Input already carries the render patch; pass the customer's original file.");
  process.exit(1);
}
const inputHash = sha(html);
const only = process.env.STUDIO_RENDER_PATCHES?.split(",").filter(Boolean);
for (const patch of PATCHES.filter((candidate) => !only || only.includes(candidate.id))) {
  const count = html.split(patch.find).length - 1;
  if (count !== 1) {
    console.error(`Patch ${patch.id}: expected exactly one match, found ${count}. The customer build changed; update the patch.`);
    process.exit(1);
  }
  html = html.replace(patch.find, () => patch.replace);
}
html = html.replace(/<head>/i, (head) => `${head}\n${MARKER}`);
if (!html.includes(MARKER)) {
  console.error("Could not insert the patch marker into <head>.");
  process.exit(1);
}
writeFileSync(output, html);
console.log(`customer sha256 ${inputHash}`);
console.log(`patched  sha256 ${sha(html)}`);
console.log(`applied: ${PATCHES.filter((candidate) => !only || only.includes(candidate.id)).map((patch) => patch.id).join(", ")}`);
