import NepaliDate from "nepali-date-converter";

const NEPAL_TIME_ZONE = "Asia/Kathmandu";

export function formatNepalDate(value: Date | string, lang: "en" | "ne" = "en") {
  const date = typeof value === "string" ? new Date(value) : value;
  return new NepaliDate(date).format("YYYY MMMM DD", lang === "ne" ? "np" : "en");
}

export function formatNepalDateTime(value: Date | string, lang: "en" | "ne" = "en") {
  const date = typeof value === "string" ? new Date(value) : value;
  const dateText = formatNepalDate(date, lang);
  const timeText = new Intl.DateTimeFormat(lang === "ne" ? "ne-NP" : "en-NP", {
    timeZone: NEPAL_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);

  return `${dateText} | ${timeText}`;
}

export function getNepalDateKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: NEPAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isSameNepalDay(a: Date | string, b: Date | string) {
  return getNepalDateKey(a) === getNepalDateKey(b);
}
