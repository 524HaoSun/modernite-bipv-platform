import fs from "node:fs";
import path from "node:path";

const root = "/home/ubuntu/modernite-bipv-platform/i18n";
const values = {
  en: "Roof slope is limited to 70°. A 90° solar surface is configured as a façade, not a roof.",
  zh: "屋顶坡度最高为 70°。90° 的光伏表面应作为立面配置，而不是屋顶。",
  ja: "屋根勾配は 70° までです。90° の太陽光面は屋根ではなくファサードとして設定します。",
  fr: "La pente de toiture est limitée à 70°. Une surface solaire à 90° se configure comme façade, et non comme toiture.",
};
for (const [language, message] of Object.entries(values)) {
  const file = path.join(root, `${language}.json`);
  const dictionary = JSON.parse(fs.readFileSync(file, "utf8"));
  dictionary["building.roof_semantics"] = message;
  fs.writeFileSync(file, `${JSON.stringify(dictionary, null, 2)}\n`);
}
