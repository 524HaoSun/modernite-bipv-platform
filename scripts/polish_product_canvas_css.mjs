import fs from "node:fs";
const path = "/home/ubuntu/modernite-bipv-platform/client/src/index.css";
let css = fs.readFileSync(path, "utf8");

css += `
/* Material Library 3D Layout Polish */
.product-visual {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.product-visual .building-canvas {
  height: 270px;
}
.product-geometry-window {
  margin: 0;
  border-radius: 12px;
  border: 1px solid rgba(32, 54, 49, 0.12);
  background: #f7f9f6;
  overflow: hidden;
  box-shadow: 0 14px 28px -26px rgba(16, 39, 34, 0.6);
}
.product-geometry-window .product-model-canvas {
  height: 250px;
  border: 0;
  border-radius: 0;
}
.product-geometry-window > span {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #edf2ee;
  color: #3b5550;
  font: 700 10px "JetBrains Mono", monospace;
  letter-spacing: 0.06em;
}
`;

fs.writeFileSync(path, css);
