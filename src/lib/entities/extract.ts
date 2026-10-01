import { DateTime } from "luxon";

export type TextSource = "subject" | "body" | "headers";
export type Confidence = "high" | "low";

export type DatedValue = {
  iso: string;
  raw: string;
  source: TextSource;
  confidence: Confidence;
};

export type AmountValue = {
  amount: number;
  currency: string | null;
  raw: string;
  source: TextSource;
  confidence: Confidence;
};

export type EntityBundle = {
  phonesRaw: string[];
  phonesNormalized: string[];
  emails: string[];
  urls: string[];
  urlDomains: string[];
  urlDomainMismatch: boolean;
  dates: DatedValue[];
  deadlines: DatedValue[];
  earliestDeadline: string | null;
  amounts: AmountValue[];
  currencies: string[];
  contractNumbers: string[];
  invoiceNumbers: string[];
  actNumbers: string[];
  ticketIds: string[];
  innNumbers: string[];
  kppNumbers: string[];
  ogrnNumbers: string[];
  bankAccountCandidates: string[];
  truncated: boolean;
};

const MONTHS: Record<string, number> = {
  января: 1,
  январях: 1,
  янв: 1,
  февраля: 2,
  фев: 2,
  марта: 3,
  мар: 3,
  апреля: 4,
  апр: 4,
  мая: 5,
  май: 5,
  июня: 6,
  июн: 6,
  июля: 7,
  июл: 7,
  августа: 8,
  авг: 8,
  сентября: 9,
  сен: 9,
  октября: 10,
  окт: 10,
  ноября: 11,
  ноя: 11,
  декабря: 12,
  дек: 12,
};

const WEEKDAYS: Record<string, number> = {
  понедельник: 1,
  вторник: 2,
  среду: 3,
  среда: 3,
  четверг: 4,
  пятницу: 5,
  пятница: 5,
  субботу: 6,
  суббота: 6,
  воскресенье: 7,
};

const DEADLINE_BEFORE =
  /(оплатить\s+до|подписать\s+до|ответить\s+до|просим\s+до|не\s+позднее|крайний\s+срок|срок(?:\s+до)?|дедлайн|deadline|until|оплата\s+до|\bдо\b)/i;

const CURRENCY_MAP: Record<string, string> = {
  "₽": "RUB",
  руб: "RUB",
  "руб.": "RUB",
  рубль: "RUB",
  рубля: "RUB",
  рублей: "RUB",
  "р.": "RUB",
  rub: "RUB",
  rur: "RUB",
  $: "USD",
  usd: "USD",
  "€": "EUR",
  eur: "EUR",
};

export function extractEntities(input: {
  subject: string;
  body: string;
  fromDomain: string;
  receivedAt: Date;
  timezone: string;
  limit?: number;
}): EntityBundle {
  const limit = input.limit ?? 40;
  const zones = [
    { source: "subject" as const, text: input.subject },
    { source: "body" as const, text: input.body },
  ];
  const phonesRaw: string[] = [];
  const phonesNormalized: string[] = [];
  const emails: string[] = [];
  const urls: string[] = [];
  const dates: DatedValue[] = [];
  const deadlines: DatedValue[] = [];
  const amounts: AmountValue[] = [];
  const contractNumbers: string[] = [];
  const invoiceNumbers: string[] = [];
  const actNumbers: string[] = [];
  const ticketIds: string[] = [];
  const innNumbers: string[] = [];
  const kppNumbers: string[] = [];
  const ogrnNumbers: string[] = [];
  const bankAccountCandidates: string[] = [];
  let truncated = false;

  const ref = DateTime.fromJSDate(input.receivedAt, { zone: "utc" }).setZone(input.timezone);

  for (const zone of zones) {
    pushUnique(phonesRaw, findPhones(zone.text).map((item) => item.raw), limit, () => (truncated = true));
    pushUnique(
      phonesNormalized,
      findPhones(zone.text)
        .map((item) => item.normalized)
        .filter((item): item is string => Boolean(item)),
      limit,
      () => (truncated = true),
    );
    pushUnique(emails, findEmails(zone.text), limit, () => (truncated = true));
    pushUnique(urls, findUrls(zone.text), limit, () => (truncated = true));
    for (const dated of findDates(zone.text, zone.source, ref)) {
      if (dates.length + deadlines.length >= limit * 2) {
        truncated = true;
        break;
      }
      const bucket = dated.deadline ? deadlines : dates;
      if (!bucket.some((item) => item.iso === dated.iso && item.raw === dated.raw)) {
        bucket.push({ iso: dated.iso, raw: dated.raw, source: dated.source, confidence: dated.confidence });
      }
    }
    for (const amount of findAmounts(zone.text, zone.source)) {
      if (amounts.length >= limit) {
        truncated = true;
        break;
      }
      if (!amounts.some((item) => item.raw === amount.raw && item.amount === amount.amount)) amounts.push(amount);
    }
    pushUnique(contractNumbers, findLabeled(zone.text, /договор[а-я]*\s*№\s*([A-Za-zА-Яа-я0-9][A-Za-zА-Яа-я0-9\-\/]{0,40})/gi), limit, () => (truncated = true));
    pushUnique(contractNumbers, findLabeled(zone.text, /\bд\s*[-–—]\s*(\d{1,10}(?:\/\d{2,4})?)\b/gi).map((item) => `Д-${item}`), limit, () => (truncated = true));
    pushUnique(invoiceNumbers, findLabeled(zone.text, /сч[её]т[а-я]*\s*№\s*([A-Za-zА-Яа-я0-9][A-Za-zА-Яа-я0-9\-\/]{0,40})/gi), limit, () => (truncated = true));
    pushUnique(invoiceNumbers, findLabeled(zone.text, /\bсч\s*[-–—]\s*(\d{1,12})\b/gi).map((item) => `СЧ-${item}`), limit, () => (truncated = true));
    pushUnique(actNumbers, findLabeled(zone.text, /акт[а-я]*\s*№\s*([A-Za-zА-Яа-я0-9][A-Za-zА-Яа-я0-9\-\/]{0,40})/gi), limit, () => (truncated = true));
    pushUnique(ticketIds, findLabeled(zone.text, /(?:заявк[аеи]|инцидент[а-я]*)\s*№\s*([A-Za-zА-Яа-я0-9][A-Za-zА-Яа-я0-9\-\/]{0,40})/gi), limit, () => (truncated = true));
    pushUnique(innNumbers, findLabeled(zone.text, /\bинн\s*[:№]?\s*(\d{10}|\d{12})\b/gi), limit, () => (truncated = true));
    pushUnique(kppNumbers, findLabeled(zone.text, /\bкпп\s*[:№]?\s*(\d{9})\b/gi), limit, () => (truncated = true));
    pushUnique(ogrnNumbers, findLabeled(zone.text, /\bогрн(?:ип)?\s*[:№]?\s*(\d{13}|\d{15})\b/gi), limit, () => (truncated = true));
    pushUnique(
      bankAccountCandidates,
      findLabeled(zone.text, /(?:р\/с|расч[её]тн\w*\s+сч[её]т\w*)\s*[:№]?\s*(\d{20})\b/gi),
      limit,
      () => (truncated = true),
    );
  }

  const urlDomains = unique(urls.map(urlDomain).filter((item): item is string => Boolean(item))).slice(0, limit);
  const sender = input.fromDomain.toLowerCase();
  const urlDomainMismatch = urlDomains.some((domain) => !sameOrSubdomain(domain, sender));
  const earliest = earliestDeadline(deadlines);

  return {
    phonesRaw: unique(phonesRaw).slice(0, limit),
    phonesNormalized: unique(phonesNormalized).slice(0, limit),
    emails: unique(emails).slice(0, limit),
    urls: unique(urls).slice(0, limit),
    urlDomains,
    urlDomainMismatch,
    dates,
    deadlines,
    earliestDeadline: earliest,
    amounts,
    currencies: unique(amounts.map((item) => item.currency).filter((item): item is string => Boolean(item))),
    contractNumbers: unique(contractNumbers).slice(0, limit),
    invoiceNumbers: unique(invoiceNumbers).slice(0, limit),
    actNumbers: unique(actNumbers).slice(0, limit),
    ticketIds: unique(ticketIds).slice(0, limit),
    innNumbers: unique(innNumbers).slice(0, limit),
    kppNumbers: unique(kppNumbers).slice(0, limit),
    ogrnNumbers: unique(ogrnNumbers).slice(0, limit),
    bankAccountCandidates: unique(bankAccountCandidates).slice(0, limit),
    truncated,
  };
}

export function findPhones(text: string): Array<{ raw: string; normalized: string | null }> {
  const pattern = /(?:\+\s*7|8|7)[\s\-.(]*\d{3}[\s\-.)]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}|\+\d{1,3}[\s\-.(]*\d{2,4}(?:[\s\-.)]*\d{2,4}){2,4}/g;
  const result: Array<{ raw: string; normalized: string | null }> = [];
  for (const match of text.matchAll(pattern)) {
    const raw = match[0].trim();
    const digits = raw.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) continue;
    result.push({ raw, normalized: normalizePhone(digits) });
  }
  return result;
}

export function normalizePhone(digits: string): string | null {
  if (digits.length === 11 && digits.startsWith("8")) return `+7${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith("7")) return `+${digits}`;
  if (digits.length === 10) return `+7${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return null;
}

export function findEmails(text: string): string[] {
  return [...text.matchAll(/\b[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}\b/gi)].map((match) => match[0].toLowerCase());
}

export function findUrls(text: string): string[] {
  const found = [
    ...text.matchAll(/\bhttps?:\/\/[^\s<>"')\]]+/gi),
    ...text.matchAll(/\bwww\.[^\s<>"')\]]+/gi),
  ].map((match) => match[0].replace(/[.,;:!?)]+$/g, ""));
  return found.map((url) => (url.toLowerCase().startsWith("www.") ? `https://${url}` : url));
}

function urlDomain(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

function sameOrSubdomain(domain: string, sender: string): boolean {
  if (!sender) return false;
  return domain === sender || domain.endsWith(`.${sender}`);
}

type FoundDate = DatedValue & { deadline: boolean };

function findDates(text: string, source: TextSource, ref: DateTime): FoundDate[] {
  if (!ref.isValid) return [];
  const found: FoundDate[] = [];
  const patterns: Array<{ regex: RegExp; parse: (match: RegExpMatchArray) => DateTime | null; confidence: Confidence }> = [
    {
      regex: /\b(\d{4})-(\d{2})-(\d{2})\b/g,
      confidence: "high",
      parse: (match) => DateTime.fromObject({ year: Number(match[1]), month: Number(match[2]), day: Number(match[3]), hour: 12 }, { zone: ref.zone }),
    },
    {
      regex: /\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/g,
      confidence: "high",
      parse: (match) => DateTime.fromObject({ day: Number(match[1]), month: Number(match[2]), year: Number(match[3]), hour: 12 }, { zone: ref.zone }),
    },
    {
      regex: /\b(\d{1,2})[./](\d{1,2})[./](\d{2})\b/g,
      confidence: "high",
      parse: (match) => {
        const yy = Number(match[3]);
        const year = yy < 70 ? 2000 + yy : 1900 + yy;
        return DateTime.fromObject({ day: Number(match[1]), month: Number(match[2]), year, hour: 12 }, { zone: ref.zone });
      },
    },
    {
      regex: /\b(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря|янв|фев|мар|апр|июн|июл|авг|сен|окт|ноя|дек)\.?(?:\s+(\d{4}))?/gi,
      confidence: "high",
      parse: (match) => {
        const month = MONTHS[match[2].toLowerCase().replace(".", "")];
        const year = match[3] ? Number(match[3]) : ref.year;
        const confidenceYear = Boolean(match[3]);
        const parsed = DateTime.fromObject({ day: Number(match[1]), month, year, hour: 12 }, { zone: ref.zone });
        return parsed.isValid ? parsed : null;
        void confidenceYear;
      },
    },
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern.regex)) {
      const parsed = pattern.parse(match);
      if (!parsed || !parsed.isValid) continue;
      const yearOmitted = pattern.regex.source.includes("декабря") && !match[3];
      const start = match.index ?? 0;
      const before = text.slice(Math.max(0, start - 48), start);
      const deadline = DEADLINE_BEFORE.test(before);
      found.push({
        iso: parsed.toUTC().toISO() ?? parsed.toISO() ?? "",
        raw: match[0],
        source,
        confidence: yearOmitted ? "low" : pattern.confidence,
        deadline,
      });
    }
  }

  const relative: Array<{ regex: RegExp; deadline: boolean; build: (match: RegExpMatchArray) => DateTime }> = [
    {
      regex: /до конца дня/gi,
      deadline: true,
      build: () => ref.set({ hour: 23, minute: 59, second: 0, millisecond: 0 }),
    },
    {
      regex: /до конца недели/gi,
      deadline: true,
      build: () => ref.set({ weekday: 7 }).set({ hour: 23, minute: 59, second: 0, millisecond: 0 }),
    },
    {
      regex: /послезавтра/gi,
      deadline: false,
      build: () => ref.plus({ days: 2 }).set({ hour: 12, minute: 0, second: 0, millisecond: 0 }),
    },
    {
      regex: /завтра/gi,
      deadline: false,
      build: () => ref.plus({ days: 1 }).set({ hour: 12, minute: 0, second: 0, millisecond: 0 }),
    },
    {
      regex: /сегодня/gi,
      deadline: false,
      build: () => ref.set({ hour: 12, minute: 0, second: 0, millisecond: 0 }),
    },
    {
      regex: /через\s+(\d{1,2})\s+дн/gi,
      deadline: true,
      build: (match) => ref.plus({ days: Number(match[1]) }).set({ hour: 18, minute: 0, second: 0, millisecond: 0 }),
    },
    {
      regex: /в\s+(понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье)/gi,
      deadline: false,
      build: (match) => {
        const target = WEEKDAYS[match[1].toLowerCase()];
        const delta = (target - ref.weekday + 7) % 7;
        return ref.plus({ days: delta }).set({ hour: 18, minute: 0, second: 0, millisecond: 0 });
      },
    },
  ];

  const occupied: Array<[number, number]> = [];
  for (const item of relative) {
    for (const match of text.matchAll(item.regex)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      if (occupied.some(([from, to]) => start < to && end > from)) continue;
      if (match[0].toLowerCase() === "завтра" && text.slice(Math.max(0, start - 6), start).toLowerCase().includes("после")) continue;
      const parsed = item.build(match);
      if (!parsed.isValid) continue;
      occupied.push([start, end]);
      const before = text.slice(Math.max(0, start - 24), start);
      found.push({
        iso: parsed.toUTC().toISO() ?? "",
        raw: match[0],
        source,
        confidence: "high",
        deadline: item.deadline || DEADLINE_BEFORE.test(before),
      });
    }
  }

  return found.filter((item) => item.iso);
}

function findAmounts(text: string, source: TextSource): AmountValue[] {
  const result: AmountValue[] = [];
  const currencyPattern = "(₽|руб(?:лей|ля|ль)?\\.?|р\\.|RUB|RUR|USD|\\$|EUR|€)";
  const numberPattern = "(\\d{1,3}(?:[ \\u00A0]\\d{3})+|\\d+)(?:[.,](\\d{2}))?";
  const direct = new RegExp(`${numberPattern}\\s*${currencyPattern}`, "gi");
  const reversed = new RegExp(`${currencyPattern}\\s*${numberPattern}`, "gi");
  for (const match of text.matchAll(direct)) {
    const amount = parseAmount(match[1], match[2]);
    if (amount == null) continue;
    result.push({ amount, currency: currencyCode(match[3]), raw: match[0], source, confidence: "high" });
  }
  for (const match of text.matchAll(reversed)) {
    const amount = parseAmount(match[2], match[3]);
    if (amount == null) continue;
    result.push({ amount, currency: currencyCode(match[1]), raw: match[0], source, confidence: "high" });
  }
  const labeled = new RegExp(`(?:сумм[аеуы]|итого|к\\s+оплате|стоимость)\\s*[:\\-]?\\s*${numberPattern}`, "gi");
  for (const match of text.matchAll(labeled)) {
    const amount = parseAmount(match[1], match[2]);
    if (amount == null) continue;
    result.push({ amount, currency: null, raw: match[0], source, confidence: "low" });
  }
  return result;
}

function parseAmount(whole: string, fraction?: string): number | null {
  const normalized = `${whole.replace(/[ \u00A0]/g, "")}${fraction ? `.${fraction}` : ""}`;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return value;
}

function currencyCode(token: string): string | null {
  const key = token.toLowerCase().replace(/\.$/, (ending) => (token.includes("руб") || token === "р." ? "." : ending));
  return CURRENCY_MAP[token] || CURRENCY_MAP[token.toLowerCase()] || CURRENCY_MAP[key] || null;
}

function findLabeled(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(pattern)].map((match) => match[1].replace(/[.,;:]+$/g, ""));
}

function earliestDeadline(values: DatedValue[]): string | null {
  const sorted = [...values].sort((a, b) => Date.parse(a.iso) - Date.parse(b.iso));
  return sorted[0]?.iso ?? null;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function pushUnique(target: string[], values: string[], limit: number, onTruncate: () => void) {
  for (const value of values) {
    if (target.includes(value)) continue;
    if (target.length >= limit) {
      onTruncate();
      return;
    }
    target.push(value);
  }
}
