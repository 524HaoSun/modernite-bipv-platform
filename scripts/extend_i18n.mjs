import fs from "node:fs";

const root = "/home/ubuntu/modernite-bipv-platform/i18n";
const additions = {
  en: {
    "workflow.roof": "Roof study", "workflow.structures": "Additions", "workflow.review": "Review",
    "map.select_location": "Select your project location", "map.select_location_lead": "Choose a service territory, then move directly to satellite imagery to outline an existing roof, a building footprint, or open ground for a new proposal.",
    "map.coverage_note": "Highlighted countries are configured for this planning tool. In Europe, choose an individual country first; the Europe solar and building profile is then applied.",
    "map.continue_satellite": "Continue to satellite map", "map.define_site": "Define your site", "map.site_lead": "Locate a property with an address, your current position, or a precise map pin.",
    "map.awaiting": "Awaiting location", "map.no_property": "No property selected", "map.located": "Located property", "map.located_help": "The map and all following geometry now use this project location.",
    "map.address_step": "Search an address", "map.address_help": "Search within the selected country, or use your current position.", "map.place_pin": "Place a pin on the map", "map.study_mode": "Then choose what to measure",
    "map.trace_roof": "Trace a roof", "map.trace_roof_detail": "Click the roof corners to measure an existing roof or building footprint.", "map.trace_ground": "Trace open ground", "map.trace_ground_detail": "Outline a new-build or ground-mount proposal area.", "map.inspect_facade": "Inspect façade", "map.inspect_facade_detail": "Open a nearby outdoor road view and mark elevation zones.",
    "map.area": "Measured area", "map.corners": "Boundary corners", "map.direction": "Project direction", "map.choose_building": "Choose building type", "map.back_to_location": "Back to location", "map.locate_me": "Use my location",
    "building.library": "03 / ARCHITECTURE LIBRARY", "building.base_forms": "Base forms", "building.library_lead": "Select the closest starting point, then adjust its geometry in the live 3D model.", "building.manual": "MANUAL PARAMETERS", "building.make_yours": "Make it yours", "building.width": "Width", "building.depth": "Depth", "building.live_3d": "LIVE 3D ARCHITECTURE", "building.orbit_hint": "Drag to orbit · scroll to inspect", "building.sun_study": "Sun and shadow study", "building.time": "Time of day", "building.spring": "Spring", "building.summer": "Summer", "building.autumn": "Autumn", "building.winter": "Winter", "building.sun_spring": "Balanced spring sunlight", "building.sun_summer": "High summer solar gain", "building.sun_autumn": "Low-angle autumn light", "building.sun_winter": "Long winter shadows", "building.footprint": "Footprint", "common.language": "Interface language"
  },
  zh: {
    "workflow.roof": "屋顶研究", "workflow.structures": "附加结构", "workflow.review": "审查",
    "map.select_location": "选择项目位置", "map.select_location_lead": "选择服务区域后，进入卫星地图勾画现有屋顶、建筑轮廓或新建项目的开放地面。",
    "map.coverage_note": "高亮国家已配置本规划工具。欧洲可先选择具体国家，随后将应用欧洲光伏与建筑配置。",
    "map.continue_satellite": "继续到卫星地图", "map.define_site": "定义项目地点", "map.site_lead": "可通过地址、当前位置或精确地图标记定位房产。",
    "map.awaiting": "等待定位", "map.no_property": "尚未选择房产", "map.located": "已定位房产", "map.located_help": "地图与后续几何计算现在采用该项目地点。",
    "map.address_step": "搜索地址", "map.address_help": "在选定国家内搜索，或使用当前位置。", "map.place_pin": "在地图上放置标记", "map.study_mode": "然后选择测量内容",
    "map.trace_roof": "勾画屋顶", "map.trace_roof_detail": "点击屋顶角点，测量现有屋顶或建筑轮廓。", "map.trace_ground": "勾画开放地面", "map.trace_ground_detail": "勾画新建或地面安装方案的区域。", "map.inspect_facade": "检查立面", "map.inspect_facade_detail": "打开附近的室外街景并标记立面区域。",
    "map.area": "测得面积", "map.corners": "边界角点", "map.direction": "项目朝向", "map.choose_building": "选择建筑类型", "map.back_to_location": "返回位置选择", "map.locate_me": "使用我的位置",
    "building.library": "03 / 建筑资料库", "building.base_forms": "基础形式", "building.library_lead": "选择最接近的起点，然后在实时三维模型中调整其几何形状。", "building.manual": "手动参数", "building.make_yours": "按需调整", "building.width": "宽度", "building.depth": "深度", "building.live_3d": "实时三维建筑", "building.orbit_hint": "拖动旋转 · 滚动查看", "building.sun_study": "日照与阴影研究", "building.time": "一天中的时间", "building.spring": "春季", "building.summer": "夏季", "building.autumn": "秋季", "building.winter": "冬季", "building.sun_spring": "均衡的春季日照", "building.sun_summer": "盛夏太阳得热", "building.sun_autumn": "低角度秋季光线", "building.sun_winter": "漫长的冬季阴影", "building.footprint": "占地面积", "common.language": "界面语言"
  },
  ja: {
    "workflow.roof": "屋根調査", "workflow.structures": "付属構造", "workflow.review": "確認",
    "map.select_location": "プロジェクトの場所を選択", "map.select_location_lead": "サービス対象地域を選択し、衛星画像で既存屋根、建物輪郭、または新築計画の敷地を描画します。",
    "map.coverage_note": "ハイライトされた国は本計画ツールに設定済みです。欧州では国を選択すると、欧州用の太陽光・建築プロファイルが適用されます。",
    "map.continue_satellite": "衛星マップへ進む", "map.define_site": "敷地を設定", "map.site_lead": "住所、現在地、または正確な地図ピンで物件を特定します。",
    "map.awaiting": "位置を待機中", "map.no_property": "物件が未選択です", "map.located": "物件を特定しました", "map.located_help": "以降の地図と形状計算はこのプロジェクト地点を使用します。",
    "map.address_step": "住所を検索", "map.address_help": "選択した国の範囲で検索するか、現在地を使います。", "map.place_pin": "地図にピンを置く", "map.study_mode": "次に測定対象を選択",
    "map.trace_roof": "屋根をトレース", "map.trace_roof_detail": "屋根の角をクリックして、既存の屋根または建物輪郭を測定します。", "map.trace_ground": "敷地をトレース", "map.trace_ground_detail": "新築または地上設置案のエリアを描画します。", "map.inspect_facade": "立面を確認", "map.inspect_facade_detail": "近くの屋外ストリートビューを開き、立面ゾーンを記録します。",
    "map.area": "測定面積", "map.corners": "境界の角", "map.direction": "プロジェクト方向", "map.choose_building": "建物タイプを選択", "map.back_to_location": "場所選択に戻る", "map.locate_me": "現在地を使う",
    "building.library": "03 / 建築ライブラリ", "building.base_forms": "基本形", "building.library_lead": "最も近い出発形を選び、ライブ3Dモデルで形状を調整します。", "building.manual": "手動パラメータ", "building.make_yours": "自分用に調整", "building.width": "幅", "building.depth": "奥行き", "building.live_3d": "ライブ3D建築", "building.orbit_hint": "ドラッグで回転 · スクロールで確認", "building.sun_study": "日照と影の検討", "building.time": "時刻", "building.spring": "春", "building.summer": "夏", "building.autumn": "秋", "building.winter": "冬", "building.sun_spring": "春のバランスのよい日照", "building.sun_summer": "真夏の日射取得", "building.sun_autumn": "低い角度の秋の光", "building.sun_winter": "長い冬の影", "building.footprint": "建築面積", "common.language": "表示言語"
  },
  fr: {
    "workflow.roof": "Étude du toit", "workflow.structures": "Extensions", "workflow.review": "Vérifier",
    "map.select_location": "Choisissez le lieu du projet", "map.select_location_lead": "Choisissez une zone desservie, puis passez à l’imagerie satellite pour tracer un toit existant, une emprise bâtie ou un terrain pour une nouvelle proposition.",
    "map.coverage_note": "Les pays en surbrillance sont configurés pour cet outil de planification. En Europe, sélectionnez d’abord un pays ; le profil solaire et bâti européen est ensuite appliqué.",
    "map.continue_satellite": "Continuer vers la carte satellite", "map.define_site": "Définissez votre site", "map.site_lead": "Localisez un bien avec une adresse, votre position actuelle ou une épingle précise.",
    "map.awaiting": "En attente de localisation", "map.no_property": "Aucun bien sélectionné", "map.located": "Bien localisé", "map.located_help": "La carte et toute la géométrie suivante utilisent désormais ce lieu de projet.",
    "map.address_step": "Rechercher une adresse", "map.address_help": "Recherchez dans le pays sélectionné ou utilisez votre position actuelle.", "map.place_pin": "Placer une épingle sur la carte", "map.study_mode": "Choisissez ensuite ce que vous mesurez",
    "map.trace_roof": "Tracer un toit", "map.trace_roof_detail": "Cliquez les angles du toit pour mesurer un toit existant ou l’emprise du bâtiment.", "map.trace_ground": "Tracer un terrain", "map.trace_ground_detail": "Délimitez une zone de construction neuve ou d’installation au sol.", "map.inspect_facade": "Inspecter la façade", "map.inspect_facade_detail": "Ouvrez une vue de rue extérieure proche et marquez les zones de façade.",
    "map.area": "Surface mesurée", "map.corners": "Angles de limite", "map.direction": "Direction du projet", "map.choose_building": "Choisir le type de bâtiment", "map.back_to_location": "Retour au choix du lieu", "map.locate_me": "Utiliser ma position",
    "building.library": "03 / BIBLIOTHÈQUE ARCHITECTURALE", "building.base_forms": "Formes de base", "building.library_lead": "Choisissez le point de départ le plus proche, puis ajustez sa géométrie dans le modèle 3D en direct.", "building.manual": "PARAMÈTRES MANUELS", "building.make_yours": "Personnalisez-le", "building.width": "Largeur", "building.depth": "Profondeur", "building.live_3d": "ARCHITECTURE 3D EN DIRECT", "building.orbit_hint": "Glissez pour tourner · faites défiler pour inspecter", "building.sun_study": "Étude du soleil et des ombres", "building.time": "Heure", "building.spring": "Printemps", "building.summer": "Été", "building.autumn": "Automne", "building.winter": "Hiver", "building.sun_spring": "Ensoleillement printanier équilibré", "building.sun_summer": "Apports solaires estivaux", "building.sun_autumn": "Lumière automnale à faible angle", "building.sun_winter": "Longues ombres hivernales", "building.footprint": "Emprise", "common.language": "Langue de l’interface"
  }
};
for (const [language, values] of Object.entries(additions)) {
  const path = `${root}/${language}.json`;
  const dictionary = JSON.parse(fs.readFileSync(path, "utf8"));
  Object.assign(dictionary, values);
  fs.writeFileSync(path, `${JSON.stringify(dictionary, null, 2)}\n`);
}
