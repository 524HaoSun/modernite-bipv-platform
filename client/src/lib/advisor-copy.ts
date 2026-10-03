import type { WorkflowLanguage } from "./workflow-labels";

export type AdvisorStage = "start" | "location" | "studio" | "energy" | "results";
export type AdvisorPreset = { id: string; question: string; answer: string };

type AdvisorCopy = {
  launcher: string;
  title: string;
  stage: (name: string) => string;
  intro: string;
  placeholder: string;
  send: string;
  close: string;
  clear: string;
  thinking: string;
  failed: string;
  instant: string;
  ai: string;
  disclaimer: string;
  presets: Record<AdvisorStage, AdvisorPreset[]>;
};

export const ADVISOR_COPY: Record<WorkflowLanguage, AdvisorCopy> = {
  en: {
    launcher: "Modernité Advisor",
    title: "Modernité Advisor",
    stage: (name) => `Current step · ${name}`,
    intro: "Hello — I’m the Modernité Advisor. The suggested questions are answered instantly; anything else is answered using your current project.",
    placeholder: "Ask about your building, products or results…",
    send: "Send",
    close: "Close advisor",
    clear: "Clear",
    thinking: "Modernité Advisor is thinking…",
    failed: "Modernité Advisor is unavailable right now. Please try again shortly.",
    instant: "Instant answer",
    ai: "Advisor",
    disclaimer: "Advisor answers are for planning guidance; the calculated study is authoritative.",
    presets: {
      start: [
        { id: "what", question: "What is Modernité?", answer: "Modernité designs building-integrated solar: solar roof tiles, solar façades, canopies, pergolas, carports and shading that replace ordinary building materials while generating electricity." },
        { id: "flow", question: "How does the planning flow work?", answer: "1. Choose your market. 2. Place a pin on your building and, if you like, read its size from map data. 3. Configure the building and solar products in the Design Studio. 4. Describe your household energy use. 5. Confirm the calculation — generation, inverter and battery sizing, savings and payback are calculated in one step." },
        { id: "markets", question: "Which markets are supported?", answer: "The United Kingdom, Europe (choose the country on the next step), Canada and Japan. Each market has its own building types, tariffs and climate data." },
      ],
      location: [
        { id: "pin", question: "How do I place the pin accurately?", answer: "Search the address, then zoom in and click the roof of your building. Use the + / − buttons or the mouse wheel to zoom; clicking the map moves the pin, zooming never does." },
        { id: "data", question: "What does building detection read?", answer: "Only after you press “Confirm pin & read building”, the platform reads the footprint from OpenStreetMap, roof planes from Google Solar and ground elevation from Google, then suggests building type, size, storeys, roof and orientation. Nothing is fetched while you are still moving the pin." },
        { id: "missing", question: "My building isn’t detected — what now?", answer: "Choose “Enter manually”, pick the closest building type and type the front width, depth and storeys. You can also trace the site outline on the map; the Design Studio uses whichever values you apply." },
      ],
      studio: [],
      energy: [
        { id: "demand", question: "I don’t know my annual electricity use", answer: "Choose “Not sure” and enter the number of people, daytime occupancy and electric loads such as a heat pump or EV charger. The model estimates demand from these; a figure from your bill is more accurate if you have it." },
        { id: "battery", question: "Should I add a battery?", answer: "A battery stores daytime surplus for the evening, raising self-consumption. It pays off best when you are out during the day and your export rate is low. Select “Add a battery” to compare both options side by side in the results." },
        { id: "sizing", question: "When are the inverter and battery sized?", answer: "When you press “Calculate project results”. The hourly model then sizes the inverter (≤1% clipping) and the battery from your final building, products and demand, so changing the design beforehand costs nothing." },
      ],
      results: [
        { id: "reliable", question: "How reliable are these figures?", answer: "They come from a deterministic hourly model using site weather (PVGIS or NASA POWER), your Studio geometry and Google Solar roof data where available. Treat them as planning estimates — a site survey and installer design confirm the final system." },
        { id: "payback", question: "How is payback calculated?", answer: "Each year’s benefit is the electricity you no longer buy plus export income, minus the system cost spread over the 25-year view with panel degradation. Payback is the first year the cumulative position turns positive." },
        { id: "next", question: "What should I do next?", answer: "Download the PDF report or save the configuration, then share it with Modernité for a site survey and a firm quotation. You can return to the Design Studio or energy inputs at any time and recalculate." },
      ],
    },
  },
  zh: {
    launcher: "Modernité Advisor",
    title: "Modernité Advisor",
    stage: (name) => `当前环节 · ${name}`,
    intro: "你好，我是 Modernité Advisor。下方的常见问题会即时回答；其他问题会结合你当前的方案回答。",
    placeholder: "询问建筑、产品或计算结果…",
    send: "发送",
    close: "关闭顾问",
    clear: "清空",
    thinking: "Modernité Advisor 正在思考…",
    failed: "Modernité Advisor 暂时不可用，请稍后再试。",
    instant: "即时回答",
    ai: "Advisor",
    disclaimer: "Advisor 回答仅供规划参考，以计算结果为准。",
    presets: {
      start: [
        { id: "what", question: "Modernité 是做什么的？", answer: "Modernité 提供建筑一体化光伏：光伏瓦、光伏幕墙、雨棚、凉亭、车棚和遮阳产品，在替代普通建材的同时发电。" },
        { id: "flow", question: "整个规划流程怎么走？", answer: "1. 选择市场；2. 在地图上把图钉放到建筑上，可按需识别建筑尺寸；3. 在设计工作室配置建筑和光伏产品；4. 填写家庭用电情况；5. 确认计算——发电量、逆变器与电池匹配、收益和回本一次算出。" },
        { id: "markets", question: "支持哪些市场？", answer: "英国、欧洲（下一步选择具体国家）、加拿大和日本。每个市场都有各自的房型、电价和气象数据。" },
      ],
      location: [
        { id: "pin", question: "怎么把图钉放准？", answer: "先搜索地址，再放大并点击你家屋顶。用 + / − 按钮或滚轮缩放；点击地图才会移动图钉，缩放不会改变位置。" },
        { id: "data", question: "识别建筑会读取哪些数据？", answer: "只有在你点击“确认位置并识别建筑”后，平台才会读取 OpenStreetMap 轮廓、谷歌 Solar 屋面和谷歌高程，并据此推荐房型、尺寸、层数、屋顶和朝向。移动图钉的过程中不会调用任何接口。" },
        { id: "missing", question: "识别不到我的房子怎么办？", answer: "点击“手动填写”，选择最接近的房型，填写正面宽度、进深和层数即可；也可以在地图上描出场地轮廓。设计工作室会使用你应用的参数。" },
      ],
      studio: [],
      energy: [
        { id: "demand", question: "不知道每年用多少电怎么办？", answer: "选择“不确定”，填写居住人数、白天在家情况，以及热泵、电动车充电桩等用电设备，模型会据此估算；如果有电费账单，填写年用电量会更准确。" },
        { id: "battery", question: "需要配电池吗？", answer: "电池把白天多余的电留到晚上用，提高自用比例。白天常不在家、上网电价低时更划算。选择“增加电池”后，结果页会并排比较两种方案。" },
        { id: "sizing", question: "逆变器和电池什么时候计算？", answer: "在你点击“计算项目结果”时。逐时模型会根据最终的建筑、产品和用电情况匹配逆变器（削峰损失 ≤1%）和电池，所以之前反复调整设计不会产生额外计算。" },
      ],
      results: [
        { id: "reliable", question: "这些数字可靠吗？", answer: "结果来自确定性的逐时模型：使用场地气象（PVGIS 或 NASA POWER）、设计工作室的几何参数，以及可用时的谷歌 Solar 屋面数据。请把它当作规划估算，最终系统以现场勘测和安装方设计为准。" },
        { id: "payback", question: "回本年限是怎么算的？", answer: "每年收益 = 少买的电费 + 上网收入，在 25 年周期内扣除系统投入并计入组件衰减；累计现金流首次转正的年份即为回本年。" },
        { id: "next", question: "接下来做什么？", answer: "下载 PDF 报告或保存配置，发给 Modernité 安排现场勘测和正式报价。你也可以随时回到设计工作室或能耗输入，修改后重新计算。" },
      ],
    },
  },
  "zh-Hant": {
    launcher: "Modernité Advisor",
    title: "Modernité Advisor",
    stage: (name) => `目前環節 · ${name}`,
    intro: "你好，我是 Modernité Advisor。下方的常見問題會即時回答；其他問題會結合你目前的方案回答。",
    placeholder: "詢問建築、產品或計算結果…",
    send: "傳送",
    close: "關閉顧問",
    clear: "清空",
    thinking: "Modernité Advisor 正在思考…",
    failed: "Modernité Advisor 暫時無法使用，請稍後再試。",
    instant: "即時回答",
    ai: "Advisor",
    disclaimer: "Advisor 回答僅供規劃參考，以計算結果為準。",
    presets: {
      start: [
        { id: "what", question: "Modernité 是做什麼的？", answer: "Modernité 提供建築一體化光電：光電瓦、光電帷幕牆、雨棚、涼亭、車棚與遮陽產品，在取代一般建材的同時發電。" },
        { id: "flow", question: "整個規劃流程怎麼走？", answer: "1. 選擇市場；2. 在地圖上把圖釘放到建築上，可依需要識別建築尺寸；3. 在設計工作室配置建築與光電產品；4. 填寫家庭用電情況；5. 確認計算——發電量、逆變器與電池匹配、收益與回本一次算出。" },
        { id: "markets", question: "支援哪些市場？", answer: "英國、歐洲（下一步選擇具體國家）、加拿大與日本。每個市場都有各自的房型、電價與氣象資料。" },
      ],
      location: [
        { id: "pin", question: "怎麼把圖釘放準？", answer: "先搜尋地址，再放大並點擊你家屋頂。用 + / − 按鈕或滾輪縮放；點擊地圖才會移動圖釘，縮放不會改變位置。" },
        { id: "data", question: "識別建築會讀取哪些資料？", answer: "只有在你點擊「確認位置並識別建築」後，平台才會讀取 OpenStreetMap 輪廓、Google Solar 屋面與 Google 高程，並據此建議房型、尺寸、層數、屋頂與朝向。移動圖釘的過程中不會呼叫任何介面。" },
        { id: "missing", question: "識別不到我的房子怎麼辦？", answer: "點擊「手動填寫」，選擇最接近的房型，填寫正面寬度、進深與層數即可；也可以在地圖上描出場地輪廓。設計工作室會使用你套用的參數。" },
      ],
      studio: [],
      energy: [
        { id: "demand", question: "不知道每年用多少電怎麼辦？", answer: "選擇「不確定」，填寫居住人數、白天在家情況，以及熱泵、電動車充電樁等用電設備，模型會據此估算；若有電費帳單，填寫年用電量會更準確。" },
        { id: "battery", question: "需要配電池嗎？", answer: "電池把白天多餘的電留到晚上使用，提高自用比例。白天常不在家、售電價格低時更划算。選擇「增加電池」後，結果頁會並排比較兩種方案。" },
        { id: "sizing", question: "逆變器與電池什麼時候計算？", answer: "在你點擊「計算專案結果」時。逐時模型會依最終的建築、產品與用電情況匹配逆變器（削峰損失 ≤1%）與電池，因此之前反覆調整設計不會產生額外計算。" },
      ],
      results: [
        { id: "reliable", question: "這些數字可靠嗎？", answer: "結果來自確定性的逐時模型：使用場地氣象（PVGIS 或 NASA POWER）、設計工作室的幾何參數，以及可用時的 Google Solar 屋面資料。請視為規劃估算，最終系統以現場勘查與安裝商設計為準。" },
        { id: "payback", question: "回本年限是怎麼算的？", answer: "每年收益 = 少買的電費 + 售電收入，在 25 年週期內扣除系統投入並計入模組衰減；累計現金流首次轉正的年份即為回本年。" },
        { id: "next", question: "接下來做什麼？", answer: "下載 PDF 報告或儲存配置，交給 Modernité 安排現場勘查與正式報價。你也可以隨時回到設計工作室或能耗輸入，修改後重新計算。" },
      ],
    },
  },
  fr: {
    launcher: "Modernité Advisor",
    title: "Modernité Advisor",
    stage: (name) => `Étape actuelle · ${name}`,
    intro: "Bonjour, je suis Modernité Advisor. Les questions suggérées reçoivent une réponse immédiate ; pour le reste, je réponds à partir de votre projet en cours.",
    placeholder: "Posez une question sur le bâtiment, les produits ou les résultats…",
    send: "Envoyer",
    close: "Fermer le conseiller",
    clear: "Effacer",
    thinking: "Modernité Advisor réfléchit…",
    failed: "Modernité Advisor est indisponible pour le moment. Réessayez dans un instant.",
    instant: "Réponse immédiate",
    ai: "Advisor",
    disclaimer: "Les réponses de Modernité Advisor servent d’orientation ; l’étude calculée fait foi.",
    presets: {
      start: [
        { id: "what", question: "Qu’est-ce que Modernité ?", answer: "Modernité conçoit du solaire intégré au bâti : tuiles solaires, façades solaires, auvents, pergolas, carports et brise-soleil qui remplacent les matériaux ordinaires tout en produisant de l’électricité." },
        { id: "flow", question: "Comment se déroule le parcours ?", answer: "1. Choisissez votre marché. 2. Placez l’épingle sur votre bâtiment et lisez, si vous le souhaitez, ses dimensions depuis la carte. 3. Configurez le bâtiment et les produits dans le Studio de conception. 4. Décrivez votre consommation. 5. Confirmez le calcul : production, onduleur, batterie, économies et retour sur investissement sont calculés en une fois." },
        { id: "markets", question: "Quels marchés sont pris en charge ?", answer: "Le Royaume-Uni, l’Europe (choix du pays à l’étape suivante), le Canada et le Japon. Chaque marché a ses propres types de bâtiments, tarifs et données climatiques." },
      ],
      location: [
        { id: "pin", question: "Comment placer l’épingle précisément ?", answer: "Recherchez l’adresse, zoomez puis cliquez sur le toit de votre bâtiment. Zoomez avec + / − ou la molette : seul un clic sur la carte déplace l’épingle, jamais le zoom." },
        { id: "data", question: "Quelles données la détection lit-elle ?", answer: "Uniquement après « Confirmer et lire le bâtiment » : l’emprise OpenStreetMap, les pans de toiture Google Solar et l’altitude Google, pour proposer type, dimensions, niveaux, toiture et orientation. Rien n’est interrogé tant que vous déplacez l’épingle." },
        { id: "missing", question: "Mon bâtiment n’est pas détecté", answer: "Choisissez « Saisir manuellement », sélectionnez le type le plus proche et saisissez largeur, profondeur et niveaux. Vous pouvez aussi tracer le contour du site ; le Studio utilise les valeurs appliquées." },
      ],
      studio: [],
      energy: [
        { id: "demand", question: "Je ne connais pas ma consommation annuelle", answer: "Choisissez « Je ne sais pas » et indiquez le nombre d’occupants, la présence en journée et les usages électriques (pompe à chaleur, borne de recharge…). Le modèle estime alors la demande ; une facture reste plus précise." },
        { id: "battery", question: "Faut-il ajouter une batterie ?", answer: "La batterie stocke le surplus de la journée pour le soir et augmente l’autoconsommation. Elle est plus intéressante si vous êtes absent le jour et si le tarif de revente est bas. Sélectionnez-la pour comparer les deux options dans les résultats." },
        { id: "sizing", question: "Quand l’onduleur et la batterie sont-ils dimensionnés ?", answer: "Lorsque vous cliquez sur « Calculer les résultats ». Le modèle horaire dimensionne alors l’onduleur (écrêtage ≤ 1 %) et la batterie à partir du bâtiment, des produits et de la demande définitifs." },
      ],
      results: [
        { id: "reliable", question: "Ces chiffres sont-ils fiables ?", answer: "Ils proviennent d’un modèle horaire déterministe utilisant la météo du site (PVGIS ou NASA POWER), la géométrie du Studio et, si disponibles, les données de toiture Google Solar. Ce sont des estimations de planification ; une visite technique confirme le système final." },
        { id: "payback", question: "Comment le retour sur investissement est-il calculé ?", answer: "Le gain annuel correspond à l’électricité non achetée plus les revenus d’export, moins le coût du système sur 25 ans avec la dégradation des modules. Le retour est la première année où le cumul devient positif." },
        { id: "next", question: "Quelle est la prochaine étape ?", answer: "Téléchargez le rapport PDF ou enregistrez la configuration, puis transmettez-la à Modernité pour une visite technique et un devis ferme. Vous pouvez revenir au Studio ou aux données d’énergie et recalculer à tout moment." },
      ],
    },
  },
  ja: {
    launcher: "Modernité Advisor",
    title: "Modernité Advisor",
    stage: (name) => `現在のステップ · ${name}`,
    intro: "こんにちは、Modernité Advisor です。下のよくある質問にはすぐにお答えします。その他のご質問は、現在のプランをもとに回答します。",
    placeholder: "建物・製品・結果について質問…",
    send: "送信",
    close: "アドバイザーを閉じる",
    clear: "クリア",
    thinking: "Modernité Advisor が考えています…",
    failed: "Modernité Advisor は現在利用できません。しばらくしてからお試しください。",
    instant: "即時回答",
    ai: "Advisor",
    disclaimer: "Modernité Advisor の回答は計画の参考です。計算結果が正式な値です。",
    presets: {
      start: [
        { id: "what", question: "Modernité とは？", answer: "Modernité は建材一体型太陽光を提供しています。太陽光瓦、太陽光ファサード、キャノピー、パーゴラ、カーポート、日除けが通常の建材の代わりとなり、同時に発電します。" },
        { id: "flow", question: "検討の流れは？", answer: "1. 市場を選択。2. 地図で建物にピンを置き、必要に応じて地図データから寸法を読み取り。3. デザインスタジオで建物と製品を設定。4. ご家庭の電力使用を入力。5. 計算を確定すると、発電量・インバーター・蓄電池・削減額・回収年数をまとめて算出します。" },
        { id: "markets", question: "対応している市場は？", answer: "英国、欧州（次のステップで国を選択）、カナダ、日本です。市場ごとに建物タイプ、電気料金、気象データが異なります。" },
      ],
      location: [
        { id: "pin", question: "ピンを正確に置くには？", answer: "住所を検索してから拡大し、ご自宅の屋根をクリックします。+ / − ボタンやホイールで拡大縮小しても位置は変わらず、地図をクリックしたときだけピンが移動します。" },
        { id: "data", question: "建物の読み取りで使うデータは？", answer: "「位置を確定して建物を読み取る」を押した後にのみ、OpenStreetMap の輪郭、Google Solar の屋根面、Google の標高を取得し、建物タイプ・寸法・階数・屋根・向きを提案します。ピンを動かしている間は通信しません。" },
        { id: "missing", question: "建物が検出されない場合は？", answer: "「手動で入力」を選び、近い建物タイプを選んで間口・奥行・階数を入力してください。地図上で敷地の輪郭を描くこともできます。デザインスタジオは反映した値を使います。" },
      ],
      studio: [],
      energy: [
        { id: "demand", question: "年間使用量がわからない", answer: "「わからない」を選び、人数・日中の在宅状況・ヒートポンプや EV 充電器などを入力すると、モデルが需要を推定します。検針票の値があればより正確です。" },
        { id: "battery", question: "蓄電池は必要？", answer: "蓄電池は日中の余剰電力を夜に使えるようにし、自家消費率を高めます。日中不在が多く売電単価が低い場合に有利です。「蓄電池を追加」を選ぶと結果で両案を比較できます。" },
        { id: "sizing", question: "インバーターと蓄電池はいつ選定される？", answer: "「検討結果を計算」を押したときです。時間別モデルが最終的な建物・製品・需要からインバーター（クリッピング 1% 以下）と蓄電池を選定するため、それまで設計を何度変更しても計算は発生しません。" },
      ],
      results: [
        { id: "reliable", question: "この数値はどの程度信頼できる？", answer: "敷地の気象（PVGIS または NASA POWER）、スタジオの形状、利用可能な場合は Google Solar の屋根データを用いた確定的な時間別モデルの結果です。計画上の推定値であり、最終システムは現地調査と施工設計で確定します。" },
        { id: "payback", question: "回収年数の計算方法は？", answer: "毎年の便益 = 購入しなくて済む電気代 + 売電収入。25 年間でモジュール劣化を考慮しつつシステム費用を差し引き、累積がプラスに転じる最初の年が回収年です。" },
        { id: "next", question: "次に何をすればいい？", answer: "PDF レポートをダウンロードするか構成を保存し、Modernité に送って現地調査と正式見積もりを依頼してください。デザインスタジオやエネルギー入力に戻って再計算することもできます。" },
      ],
    },
  },
  es: {
    launcher: "Modernité Advisor",
    title: "Modernité Advisor",
    stage: (name) => `Paso actual · ${name}`,
    intro: "Hola, soy Modernité Advisor. Las preguntas sugeridas se responden al instante; el resto se responde con tu proyecto actual.",
    placeholder: "Pregunta sobre el edificio, los productos o los resultados…",
    send: "Enviar",
    close: "Cerrar asesor",
    clear: "Borrar",
    thinking: "Modernité Advisor está pensando…",
    failed: "Modernité Advisor no está disponible ahora. Inténtalo de nuevo en breve.",
    instant: "Respuesta inmediata",
    ai: "Advisor",
    disclaimer: "Las respuestas de Modernité Advisor son orientativas; el estudio calculado es la referencia.",
    presets: {
      start: [
        { id: "what", question: "¿Qué es Modernité?", answer: "Modernité diseña solar integrada en edificios: tejas solares, fachadas solares, marquesinas, pérgolas, cocheras y protecciones solares que sustituyen materiales convencionales mientras generan electricidad." },
        { id: "flow", question: "¿Cómo funciona el proceso?", answer: "1. Elige tu mercado. 2. Coloca el pin sobre tu edificio y, si quieres, lee sus medidas del mapa. 3. Configura el edificio y los productos en el Estudio de diseño. 4. Describe tu consumo. 5. Confirma el cálculo: generación, inversor, batería, ahorro y amortización se calculan de una vez." },
        { id: "markets", question: "¿Qué mercados están disponibles?", answer: "Reino Unido, Europa (eliges el país en el siguiente paso), Canadá y Japón. Cada mercado tiene sus tipos de edificio, tarifas y datos climáticos." },
      ],
      location: [
        { id: "pin", question: "¿Cómo coloco el pin con precisión?", answer: "Busca la dirección, acerca el mapa y haz clic en el tejado de tu edificio. Usa + / − o la rueda para el zoom: solo un clic en el mapa mueve el pin, el zoom nunca." },
        { id: "data", question: "¿Qué datos lee la detección?", answer: "Solo después de pulsar «Confirmar y leer el edificio»: la planta de OpenStreetMap, los faldones de Google Solar y la elevación de Google, para proponer tipo, medidas, plantas, cubierta y orientación. Mientras mueves el pin no se consulta nada." },
        { id: "missing", question: "No se detecta mi edificio", answer: "Elige «Introducir a mano», selecciona el tipo más parecido e indica ancho, fondo y plantas. También puedes trazar el contorno del sitio; el Estudio usa los valores que apliques." },
      ],
      studio: [],
      energy: [
        { id: "demand", question: "No sé mi consumo anual", answer: "Elige «No estoy seguro» e indica personas, presencia diurna y cargas eléctricas como bomba de calor o cargador de VE. El modelo estimará la demanda; una factura es más precisa si la tienes." },
        { id: "battery", question: "¿Conviene añadir batería?", answer: "La batería guarda el excedente del día para la noche y aumenta el autoconsumo. Compensa más si pasas el día fuera y la compensación por excedentes es baja. Selecciónala para comparar ambas opciones en los resultados." },
        { id: "sizing", question: "¿Cuándo se dimensionan el inversor y la batería?", answer: "Al pulsar «Calcular resultados». El modelo horario dimensiona entonces el inversor (recorte ≤1 %) y la batería con el edificio, los productos y la demanda definitivos." },
      ],
      results: [
        { id: "reliable", question: "¿Qué fiabilidad tienen estas cifras?", answer: "Proceden de un modelo horario determinista con el clima del sitio (PVGIS o NASA POWER), la geometría del Estudio y, si existen, datos de cubierta de Google Solar. Son estimaciones de planificación; una visita técnica confirma el sistema final." },
        { id: "payback", question: "¿Cómo se calcula la amortización?", answer: "El beneficio anual es la electricidad que dejas de comprar más los ingresos por excedentes, menos el coste del sistema en 25 años con degradación de módulos. La amortización es el primer año en que el acumulado es positivo." },
        { id: "next", question: "¿Qué hago ahora?", answer: "Descarga el informe PDF o guarda la configuración y envíala a Modernité para una visita técnica y un presupuesto firme. Puedes volver al Estudio o a los datos de energía y recalcular cuando quieras." },
      ],
    },
  },
  it: {
    launcher: "Modernité Advisor",
    title: "Modernité Advisor",
    stage: (name) => `Fase attuale · ${name}`,
    intro: "Ciao, sono Modernité Advisor. Le domande suggerite ricevono una risposta immediata; per tutto il resto rispondo in base al tuo progetto.",
    placeholder: "Chiedi dell’edificio, dei prodotti o dei risultati…",
    send: "Invia",
    close: "Chiudi consulente",
    clear: "Cancella",
    thinking: "Modernité Advisor sta pensando…",
    failed: "Modernité Advisor non è disponibile al momento. Riprova tra poco.",
    instant: "Risposta immediata",
    ai: "Advisor",
    disclaimer: "Le risposte di Modernité Advisor sono indicative; lo studio calcolato fa fede.",
    presets: {
      start: [
        { id: "what", question: "Che cos’è Modernité?", answer: "Modernité progetta fotovoltaico integrato negli edifici: tegole solari, facciate solari, pensiline, pergole, carport e frangisole che sostituiscono i materiali tradizionali producendo elettricità." },
        { id: "flow", question: "Come funziona il percorso?", answer: "1. Scegli il mercato. 2. Posiziona il segnaposto sull’edificio e, se vuoi, leggi le misure dalla mappa. 3. Configura edificio e prodotti nello Studio di progettazione. 4. Descrivi i consumi. 5. Conferma il calcolo: produzione, inverter, batteria, risparmi e rientro vengono calcolati in un solo passaggio." },
        { id: "markets", question: "Quali mercati sono supportati?", answer: "Regno Unito, Europa (scegli il paese nel passaggio successivo), Canada e Giappone. Ogni mercato ha tipologie edilizie, tariffe e dati climatici propri." },
      ],
      location: [
        { id: "pin", question: "Come posiziono il segnaposto con precisione?", answer: "Cerca l’indirizzo, ingrandisci e fai clic sul tetto dell’edificio. Usa + / − o la rotella per lo zoom: solo il clic sulla mappa sposta il segnaposto, lo zoom mai." },
        { id: "data", question: "Quali dati legge il rilevamento?", answer: "Solo dopo «Conferma e leggi l’edificio»: l’impronta da OpenStreetMap, le falde da Google Solar e la quota da Google, per proporre tipo, misure, piani, copertura e orientamento. Mentre sposti il segnaposto non viene interrogato nulla." },
        { id: "missing", question: "Il mio edificio non viene rilevato", answer: "Scegli «Inserisci a mano», seleziona il tipo più simile e inserisci larghezza, profondità e piani. Puoi anche tracciare il contorno del sito; lo Studio usa i valori applicati." },
      ],
      studio: [],
      energy: [
        { id: "demand", question: "Non conosco il consumo annuo", answer: "Scegli «Non sono sicuro» e indica persone, presenza diurna e carichi elettrici come pompa di calore o colonnina. Il modello stima la domanda; il valore in bolletta è più preciso, se disponibile." },
        { id: "battery", question: "Conviene aggiungere una batteria?", answer: "La batteria accumula il surplus diurno per la sera e aumenta l’autoconsumo. Conviene di più se di giorno sei fuori casa e la remunerazione dell’energia ceduta è bassa. Selezionala per confrontare le due opzioni nei risultati." },
        { id: "sizing", question: "Quando vengono dimensionati inverter e batteria?", answer: "Quando premi «Calcola i risultati». Il modello orario dimensiona allora l’inverter (clipping ≤1%) e la batteria in base a edificio, prodotti e consumi definitivi." },
      ],
      results: [
        { id: "reliable", question: "Quanto sono affidabili questi numeri?", answer: "Derivano da un modello orario deterministico con il clima del sito (PVGIS o NASA POWER), la geometria dello Studio e, se disponibili, i dati di copertura Google Solar. Sono stime di pianificazione; un sopralluogo conferma l’impianto finale." },
        { id: "payback", question: "Come si calcola il rientro?", answer: "Il beneficio annuo è l’energia non acquistata più i ricavi dell’energia ceduta, meno il costo dell’impianto sui 25 anni con il degrado dei moduli. Il rientro è il primo anno in cui il cumulato diventa positivo." },
        { id: "next", question: "Qual è il prossimo passo?", answer: "Scarica il report PDF o salva la configurazione e inviala a Modernité per un sopralluogo e un preventivo definitivo. Puoi tornare allo Studio o ai dati energetici e ricalcolare in qualsiasi momento." },
      ],
    },
  },
};
