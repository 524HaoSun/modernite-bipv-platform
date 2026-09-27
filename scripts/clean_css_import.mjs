import fs from "node:fs";

const path = "/home/ubuntu/modernite-bipv-platform/client/src/index.css";
let css = fs.readFileSync(path, "utf8");

const redundant = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');`;

if (css.includes(redundant)) {
  css = css.replace(redundant, "");
  fs.writeFileSync(path, css, "utf8");
  console.log("Cleaned redundant font import");
}
