export function blessingArt({
  title,
  subtitle,
  accentA,
  accentB,
  symbol,
}: {
  title: string;
  subtitle: string;
  accentA: string;
  accentB: string;
  symbol: string;
}) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${accentA}" />
        <stop offset="100%" stop-color="${accentB}" />
      </linearGradient>
      <radialGradient id="halo" cx="50%" cy="40%" r="45%">
        <stop offset="0%" stop-color="rgba(255,248,220,0.95)" />
        <stop offset="100%" stop-color="rgba(255,248,220,0)" />
      </radialGradient>
    </defs>
    <rect width="640" height="480" rx="40" fill="url(#bg)"/>
    <circle cx="320" cy="170" r="128" fill="url(#halo)"/>
    <circle cx="320" cy="165" r="86" fill="rgba(255,255,255,0.18)"/>
    <circle cx="320" cy="165" r="66" fill="rgba(255,255,255,0.22)"/>
    <text x="320" y="188" text-anchor="middle" fill="#fff9ea" font-size="74" font-weight="700" font-family="Noto Serif Devanagari, Lora, serif">${symbol}</text>
    <text x="320" y="336" text-anchor="middle" fill="#fffdf7" font-size="36" font-weight="700" font-family="DM Sans, Arial, sans-serif">${title}</text>
    <text x="320" y="374" text-anchor="middle" fill="rgba(255,253,247,0.92)" font-size="20" font-family="DM Sans, Arial, sans-serif">${subtitle}</text>
    <path d="M110 420c44-34 90-52 138-52 62 0 110 22 144 52" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="5" stroke-linecap="round"/>
    <path d="M252 96c18-20 40-30 68-30 27 0 49 10 67 30" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="4" stroke-linecap="round"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function getDevotionalCards(lang: "en" | "ne") {
  return [
    {
      title: lang === "ne" ? "श्री गणेश" : "Shree Ganesh",
      subtitle: lang === "ne" ? "शुभारम्भ र बुद्धिको आशीर्वाद" : "Blessings for wisdom and new beginnings",
      image: blessingArt({ title: lang === "ne" ? "श्री गणेश" : "Shree Ganesh", subtitle: lang === "ne" ? "मंगलमय आरम्भ" : "Auspicious beginnings", accentA: "#f59e0b", accentB: "#b45309", symbol: "ॐ" }),
    },
    {
      title: lang === "ne" ? "कालिका माता" : "Kalika Mata",
      subtitle: lang === "ne" ? "शक्ति, रक्षा र साहस" : "Strength, protection, and courage",
      image: blessingArt({ title: lang === "ne" ? "कालिका माता" : "Kalika Mata", subtitle: lang === "ne" ? "शक्ति र रक्षा" : "Strength and protection", accentA: "#7f1d1d", accentB: "#be123c", symbol: "✹" }),
    },
    {
      title: lang === "ne" ? "नाग देवता" : "Naag Devata",
      subtitle: lang === "ne" ? "भूमि, पानी र संरक्षणको स्मरण" : "A symbol of earth, water, and protection",
      image: blessingArt({ title: lang === "ne" ? "नाग देवता" : "Naag Devata", subtitle: lang === "ne" ? "संरक्षण र समृद्धि" : "Protection and prosperity", accentA: "#14532d", accentB: "#0f766e", symbol: "🕉" }),
    },
    {
      title: lang === "ne" ? "गौतम बुद्ध" : "Gautam Buddha",
      subtitle: lang === "ne" ? "करुणा, ध्यान र शान्तिको प्रेरणा" : "Compassion, mindfulness, and peace",
      image: blessingArt({ title: lang === "ne" ? "गौतम बुद्ध" : "Gautam Buddha", subtitle: lang === "ne" ? "शान्ति र करुणा" : "Peace and compassion", accentA: "#a16207", accentB: "#78350f", symbol: "☸" }),
    },
  ];
}
