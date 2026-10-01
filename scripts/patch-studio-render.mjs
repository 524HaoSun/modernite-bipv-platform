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
    replace: "wwr:d.wwr,parametric:true,...(Number.isFinite(d.pitch)?{pitch:d.pitch}:{}),...(d.roofForm?{roofForm:d.roofForm}:{})};}",
  },
  {
    id: "parametric-roof-cache",
    find: "moderniteDimensionCache[Gt.id]={width:d.width,depth:d.depth,floors:d.floors,storeyHeight:d.storeyHeight,wwr:d.wwr};",
    replace: "moderniteDimensionCache[Gt.id]={width:d.width,depth:d.depth,floors:d.floors,storeyHeight:d.storeyHeight,wwr:d.wwr,...(Number.isFinite(d.pitch)?{pitch:Math.min(55,Math.max(5,d.pitch))}:{}),...(['hip','gable','flat','mono'].includes(d.roofForm)?{roofForm:d.roofForm}:{})};",
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
