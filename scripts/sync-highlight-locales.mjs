import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "_locales");

const translations = {
    de: {
        sectionTabsTitle: "Tab-Auswahl",
        linkHighlightCardDesc: "Dünner Rahmen um den Ergebnisblock.",
        highlightAccentLabel: "Allgemeine Farbe",
        highlightAccentDesc: "Standardfarbe für alle Stile. Wähle ein Preset oder tippe auf das Palettensymbol für eine eigene Farbe.",
        highlightCardWidthLabel: "Rahmenbreite",
        highlightUnderlineWidthLabel: "Linienstärke",
        highlightGlowStrengthLabel: "Leuchtstärke",
        highlightGlowRingLabel: "Ringbreite",
        highlightResetDefault: "Auf Standard zurücksetzen",
        highlightChooseColor: "Farbe wählen"
    },
    fr: {
        sectionTabsTitle: "Sélection d'onglets",
        linkHighlightCardDesc: "Fin cadre autour du bloc de résultat.",
        highlightAccentLabel: "Couleur générale",
        highlightAccentDesc: "Couleur par défaut pour tous les styles. Choisissez un préréglage ou appuyez sur l'icône palette pour une couleur personnalisée.",
        highlightCardWidthLabel: "Épaisseur du cadre",
        highlightUnderlineWidthLabel: "Épaisseur de la ligne",
        highlightGlowStrengthLabel: "Intensité de la lueur",
        highlightGlowRingLabel: "Épaisseur de l'anneau",
        highlightResetDefault: "Réinitialiser",
        highlightChooseColor: "Choisir une couleur"
    },
    es: {
        sectionTabsTitle: "Selección de pestañas",
        linkHighlightCardDesc: "Marco fino alrededor del bloque de resultado.",
        highlightAccentLabel: "Color general",
        highlightAccentDesc: "Color predeterminado para todos los estilos. Elige un preset o toca el icono de paleta para un color personalizado.",
        highlightCardWidthLabel: "Grosor del marco",
        highlightUnderlineWidthLabel: "Grosor de la línea",
        highlightGlowStrengthLabel: "Intensidad del brillo",
        highlightGlowRingLabel: "Grosor del anillo",
        highlightResetDefault: "Restablecer valores",
        highlightChooseColor: "Elegir color"
    },
    it: {
        sectionTabsTitle: "Selezione schede",
        linkHighlightCardDesc: "Sottile cornice intorno al blocco risultato.",
        highlightAccentLabel: "Colore generale",
        highlightAccentDesc: "Colore predefinito per tutti gli stili. Scegli un preset o tocca l'icona palette per un colore personalizzato.",
        highlightCardWidthLabel: "Spessore cornice",
        highlightUnderlineWidthLabel: "Spessore linea",
        highlightGlowStrengthLabel: "Intensità bagliore",
        highlightGlowRingLabel: "Spessore anello",
        highlightResetDefault: "Ripristina predefiniti",
        highlightChooseColor: "Scegli colore"
    },
    pl: {
        sectionTabsTitle: "Zaznaczanie kart",
        linkHighlightCardDesc: "Cienka ramka wokół bloku wyniku.",
        highlightAccentLabel: "Kolor ogólny",
        highlightAccentDesc: "Domyślny kolor dla wszystkich stylów. Wybierz preset lub dotknij ikony palety, aby wybrać własny kolor.",
        highlightCardWidthLabel: "Grubość ramki",
        highlightUnderlineWidthLabel: "Grubość linii",
        highlightGlowStrengthLabel: "Siła poświaty",
        highlightGlowRingLabel: "Grubość pierścienia",
        highlightResetDefault: "Przywróć domyślne",
        highlightChooseColor: "Wybierz kolor"
    },
    pt_BR: {
        sectionTabsTitle: "Seleção de abas",
        linkHighlightCardDesc: "Moldura fina ao redor do bloco de resultado.",
        highlightAccentLabel: "Cor geral",
        highlightAccentDesc: "Cor padrão para todos os estilos. Escolha um preset ou toque no ícone de paleta para uma cor personalizada.",
        highlightCardWidthLabel: "Espessura da moldura",
        highlightUnderlineWidthLabel: "Espessura da linha",
        highlightGlowStrengthLabel: "Intensidade do brilho",
        highlightGlowRingLabel: "Espessura do anel",
        highlightResetDefault: "Restaurar padrão",
        highlightChooseColor: "Escolher cor"
    },
    nl: {
        sectionTabsTitle: "Tabselectie",
        linkHighlightCardDesc: "Dun kader rond het resultaatblok.",
        highlightAccentLabel: "Algemene kleur",
        highlightAccentDesc: "Standaardkleur voor alle stijlen. Kies een preset of tik op het paleticoon voor een eigen kleur.",
        highlightCardWidthLabel: "Kaderdikte",
        highlightUnderlineWidthLabel: "Lijndikte",
        highlightGlowStrengthLabel: "Gloedsterkte",
        highlightGlowRingLabel: "Ringdikte",
        highlightResetDefault: "Standaard herstellen",
        highlightChooseColor: "Kleur kiezen"
    },
    tr: {
        sectionTabsTitle: "Sekme seçimi",
        linkHighlightCardDesc: "Sonuç bloğunun etrafında ince çerçeve.",
        highlightAccentLabel: "Genel renk",
        highlightAccentDesc: "Tüm stiller için varsayılan renk. Hazır renk seçin veya özel renk için palet simgesine dokunun.",
        highlightCardWidthLabel: "Çerçeve kalınlığı",
        highlightUnderlineWidthLabel: "Çizgi kalınlığı",
        highlightGlowStrengthLabel: "Parıltı gücü",
        highlightGlowRingLabel: "Halka kalınlığı",
        highlightResetDefault: "Varsayılana sıfırla",
        highlightChooseColor: "Renk seç"
    },
    ar: {
        sectionTabsTitle: "تحديد علامات التبويب",
        linkHighlightCardDesc: "إطار رفيع حول كتلة النتيجة.",
        highlightAccentLabel: "اللون العام",
        highlightAccentDesc: "اللون الافتراضي لجميع الأنماط. اختر لونًا جاهزًا أو اضغط على أيقونة لوحة الألوان للون مخصص.",
        highlightCardWidthLabel: "سمك الإطار",
        highlightUnderlineWidthLabel: "سمك الخط",
        highlightGlowStrengthLabel: "قوة التوهج",
        highlightGlowRingLabel: "سمك الحلقة",
        highlightResetDefault: "إعادة التعيين",
        highlightChooseColor: "اختيار لون"
    },
    ja: {
        sectionTabsTitle: "タブの選択",
        linkHighlightCardDesc: "結果ブロックの周りに細い枠。",
        highlightAccentLabel: "共通の色",
        highlightAccentDesc: "すべてのスタイルの既定色。プリセットを選ぶか、パレットアイコンをタップして色を選んでください。",
        highlightCardWidthLabel: "枠の太さ",
        highlightUnderlineWidthLabel: "線の太さ",
        highlightGlowStrengthLabel: "グローの強さ",
        highlightGlowRingLabel: "リングの太さ",
        highlightResetDefault: "既定に戻す",
        highlightChooseColor: "色を選ぶ"
    },
    ko: {
        sectionTabsTitle: "탭 선택",
        linkHighlightCardDesc: "결과 블록 주위의 얇은 테두리.",
        highlightAccentLabel: "공통 색상",
        highlightAccentDesc: "모든 스타일의 기본 색상. 프리셋을 선택하거나 팔레트 아이콘을 눌러 색상을 선택하세요.",
        highlightCardWidthLabel: "테두리 두께",
        highlightUnderlineWidthLabel: "선 두께",
        highlightGlowStrengthLabel: "글로우 강도",
        highlightGlowRingLabel: "링 두께",
        highlightResetDefault: "기본값으로 재설정",
        highlightChooseColor: "색상 선택"
    },
    zh_CN: {
        sectionTabsTitle: "标签页选择",
        linkHighlightCardDesc: "结果块周围的细边框。",
        highlightAccentLabel: "通用颜色",
        highlightAccentDesc: "所有样式的默认颜色。选择预设，或点击调色板图标选择自定义颜色。",
        highlightCardWidthLabel: "边框粗细",
        highlightUnderlineWidthLabel: "线条粗细",
        highlightGlowStrengthLabel: "光晕强度",
        highlightGlowRingLabel: "环粗细",
        highlightResetDefault: "恢复默认",
        highlightChooseColor: "选择颜色"
    },
    zh_TW: {
        sectionTabsTitle: "分頁選取",
        linkHighlightCardDesc: "結果區塊周圍的細外框。",
        highlightAccentLabel: "通用顏色",
        highlightAccentDesc: "所有樣式的預設顏色。選擇預設，或點擊調色盤圖示選擇自訂顏色。",
        highlightCardWidthLabel: "外框粗細",
        highlightUnderlineWidthLabel: "線條粗細",
        highlightGlowStrengthLabel: "光暈強度",
        highlightGlowRingLabel: "環粗細",
        highlightResetDefault: "恢復預設",
        highlightChooseColor: "選擇顏色"
    },
    vi: {
        sectionTabsTitle: "Chọn tab",
        linkHighlightCardDesc: "Khung mỏng quanh khối kết quả.",
        highlightAccentLabel: "Màu chung",
        highlightAccentDesc: "Màu mặc định cho mọi kiểu. Chọn preset hoặc chạm biểu tượng bảng màu để chọn màu tùy chỉnh.",
        highlightCardWidthLabel: "Độ dày khung",
        highlightUnderlineWidthLabel: "Độ dày đường",
        highlightGlowStrengthLabel: "Cường độ phát sáng",
        highlightGlowRingLabel: "Độ dày vòng",
        highlightResetDefault: "Đặt lại mặc định",
        highlightChooseColor: "Chọn màu"
    },
    uk: {
        sectionTabsTitle: "Виділення вкладок",
        linkHighlightCardDesc: "Тонка рамка навколо блоку результату.",
        highlightAccentLabel: "Загальний колір",
        highlightAccentDesc: "Колір за замовчуванням для всіх стилів. Оберіть пресет або натисніть значок палітри для свого кольору.",
        highlightCardWidthLabel: "Товщина рамки",
        highlightUnderlineWidthLabel: "Товщина лінії",
        highlightGlowStrengthLabel: "Сила свічення",
        highlightGlowRingLabel: "Товщина кільця",
        highlightResetDefault: "Скинути за замовчуванням",
        highlightChooseColor: "Вибрати колір"
    },
    be: {
        sectionTabsTitle: "Вылучэнне ўкладак",
        linkHighlightCardDesc: "Тонкая рамка вакол блока выніку.",
        highlightAccentLabel: "Агульны колер",
        highlightAccentDesc: "Колер па змаўчанні для ўсіх стыляў. Абярыце прэсет або націсніце значок палітры для свайго колеру.",
        highlightCardWidthLabel: "Таўшчыня рамкі",
        highlightUnderlineWidthLabel: "Таўшчыня лініі",
        highlightGlowStrengthLabel: "Сіла свячэння",
        highlightGlowRingLabel: "Таўшчыня кольца",
        highlightResetDefault: "Скінуць па змаўчанні",
        highlightChooseColor: "Выбраць колер"
    },
    id: {
        sectionTabsTitle: "Pemilihan tab",
        linkHighlightCardDesc: "Bingkai tipis di sekitar blok hasil.",
        highlightAccentLabel: "Warna umum",
        highlightAccentDesc: "Warna default untuk semua gaya. Pilih preset atau ketuk ikon palet untuk warna kustom.",
        highlightCardWidthLabel: "Ketebalan bingkai",
        highlightUnderlineWidthLabel: "Ketebalan garis",
        highlightGlowStrengthLabel: "Kekuatan cahaya",
        highlightGlowRingLabel: "Ketebalan cincin",
        highlightResetDefault: "Atur ulang ke default",
        highlightChooseColor: "Pilih warna"
    }
};

const en = JSON.parse(fs.readFileSync(path.join(root, "en", "messages.json"), "utf8"));
const keys = Object.keys(translations.de);

for (const locale of fs.readdirSync(root)) {
    if (locale === "en" || locale === "ru") continue;
    const filePath = path.join(root, locale, "messages.json");
    if (!fs.existsSync(filePath)) continue;
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const t = translations[locale];
    if (!t) {
        console.warn("skip (no map):", locale);
        continue;
    }
    for (const key of keys) {
        data[key] = { message: t[key] };
    }
    for (const key of Object.keys(en)) {
        if (!data[key]) {
            data[key] = { message: en[key].message };
            if (en[key].description) data[key].description = en[key].description;
        }
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
    console.log("updated", locale);
}

console.log("done");
