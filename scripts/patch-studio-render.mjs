#!/usr/bin/env node
// Applies the host's rendering-quality patch to a customer Solar Studio build.
// Usage: node scripts/patch-studio-render.mjs <customer-studio.html> [output=client/public/studio.html]
// Only renderer / camera / post-processing statements and the advisor endpoint check are touched;
// the energy, system, location and shading scripts stay byte-identical (tests/customer-core-parity.test.ts).
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const MARKER = '<meta name="modernite-render-patch" content="v2">';

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
