import fs from "node:fs";
import path from "node:path";

const root = "/home/ubuntu/modernite-bipv-platform/i18n";
const translations = {
  en: {
    "map.close_button": "Close outline",
    "map.closure_target": "Click the cyan ✓ at the first corner, or use Close outline.",
    "map.close_hint": "The yellow trace is still a draft. Close it to apply the measured roof area.",
    "map.facade": "Select facade",
    "map.facade_help": "Pan to the elevation you want, then click the facade overlay to select it.",
    "map.facade_selected": "Selected facade will open in solar materials.",
    "roof.facade_selected": "Street View facade selected",
    "roof.facade_detail": "will be available in the façade solar materials section.",
  },
  zh: {
    "map.close_button": "闭合轮廓",
    "map.closure_target": "点击第一个角点上的青色 ✓，或点击“闭合轮廓”。",
    "map.close_hint": "黄色线仍是草图。闭合后才会应用测得的屋顶面积。",
    "map.facade": "选择立面",
    "map.facade_help": "先拖动街景至目标立面，再点击立面覆盖层完成选择。",
    "map.facade_selected": "所选立面将带入光伏材料配置。",
    "roof.facade_selected": "已选择街景立面",
    "roof.facade_detail": "将在立面光伏材料区域中可用。",
  },
  ja: {
    "map.close_button": "輪郭を閉じる",
    "map.closure_target": "最初の角にあるシアン色の ✓ をクリックするか、「輪郭を閉じる」を使います。",
    "map.close_hint": "黄色の線はまだ下書きです。閉じると計測した屋根面積が適用されます。",
    "map.facade": "外壁を選択",
    "map.facade_help": "目的の外壁にパンしてから、外壁オーバーレイをクリックして選択します。",
    "map.facade_selected": "選択した外壁は太陽光建材の設定で開きます。",
    "roof.facade_selected": "ストリートビューの外壁を選択済み",
    "roof.facade_detail": "外壁太陽光建材のセクションで利用できます。",
  },
  fr: {
    "map.close_button": "Fermer le contour",
    "map.closure_target": "Cliquez sur le ✓ cyan du premier angle ou utilisez « Fermer le contour ».",
    "map.close_hint": "Le tracé jaune reste un brouillon. Fermez-le pour appliquer la surface mesurée.",
    "map.facade": "Sélectionner la façade",
    "map.facade_help": "Cadrez la façade voulue, puis cliquez sur la surcouche pour la sélectionner.",
    "map.facade_selected": "La façade sélectionnée sera ouverte dans les matériaux solaires.",
    "roof.facade_selected": "Façade Street View sélectionnée",
    "roof.facade_detail": "sera disponible dans les matériaux solaires de façade.",
  },
};

for (const [language, values] of Object.entries(translations)) {
  const file = path.join(root, `${language}.json`);
  const dictionary = JSON.parse(fs.readFileSync(file, "utf8"));
  Object.assign(dictionary, values);
  fs.writeFileSync(file, `${JSON.stringify(dictionary, null, 2)}\n`);
}
