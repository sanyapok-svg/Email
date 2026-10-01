export type Sentiment = "positive" | "neutral" | "negative" | "mixed";
export type Urgency = "low" | "normal" | "high" | "critical";

export type Analysis = {
  language: "ru" | "en" | "mixed" | "unknown";
  languageConfidence: number;
  sentiment: Sentiment;
  sentimentScore: number;
  urgencyLevel: Urgency;
  urgencyScore: number;
};

const POSITIVE = [
  "спасибо",
  "благодар",
  "отлично",
  "прекрасн",
  "довольн",
  "хорош",
  "рекоменд",
  "thank",
  "thanks",
  "great",
  "excellent",
  "appreciate",
  "glad",
];

const NEGATIVE = [
  "претенз",
  "жалоб",
  "не работает",
  "ошибк",
  "проблем",
  "ужасн",
  "плохо",
  "недопустим",
  "требуем",
  "возмущ",
  "обман",
  "штраф",
  "блокиров",
  "срыв",
  "недоволен",
  "complaint",
  "problem",
  "error",
  "unacceptable",
  "disappointed",
  "broken",
  "fail",
];

const NEGATIONS = new Set(["не", "нет", "ни", "not", "no", "never"]);
const INTENSIFIERS = new Set(["очень", "крайне", "совершенно", "very", "extremely", "absolutely"]);

const URGENCY_PHRASES: Array<[RegExp, number]> = [
  [/срочн/gi, 3],
  [/немедленн/gi, 3],
  [/до конца дня/gi, 2],
  [/до завтра/gi, 2],
  [/просрочен/gi, 3],
  [/последн(?:ий|его)\s+день/gi, 3],
  [/критич/gi, 3],
  [/остановк[аеи]\s+работ/gi, 3],
  [/блокиров/gi, 2],
  [/претенз/gi, 2],
  [/инцидент/gi, 2],
  [/оплат/gi, 1],
  [/\basap\b/gi, 3],
  [/\burgent/gi, 3],
  [/immediately/gi, 3],
];

export function analyzeText(input: {
  subject: string;
  body: string;
  deadlineIso?: string | null;
  receivedAt?: Date;
}): Analysis {
  const text = `${input.subject}\n${input.body}`.slice(0, 20000);
  const language = detectLanguage(text);
  const sentiment = detectSentiment(text);
  const urgency = detectUrgency(text, input.deadlineIso, input.receivedAt);
  return { ...language, ...sentiment, ...urgency };
}

export function detectLanguage(text: string): Pick<Analysis, "language" | "languageConfidence"> {
  let cyr = 0;
  let lat = 0;
  for (const char of text) {
    if (/[А-Яа-яЁё]/.test(char)) cyr += 1;
    else if (/[A-Za-z]/.test(char)) lat += 1;
  }
  const total = cyr + lat;
  if (total < 8) return { language: "unknown", languageConfidence: 0 };
  const cyrRatio = cyr / total;
  const latRatio = lat / total;
  if (cyrRatio >= 0.75) return { language: "ru", languageConfidence: round(cyrRatio) };
  if (latRatio >= 0.75) return { language: "en", languageConfidence: round(latRatio) };
  return { language: "mixed", languageConfidence: round(Math.max(cyrRatio, latRatio)) };
}

export function detectSentiment(text: string): Pick<Analysis, "sentiment" | "sentimentScore"> {
  const tokens = text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  let score = 0;
  let positiveHits = 0;
  let negativeHits = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    const window = tokens.slice(i, i + 3).join(" ");
    const token = tokens[i];
    let weight = 0;
    if (POSITIVE.some((item) => token.startsWith(item) || window.includes(item))) weight = 1;
    if (NEGATIVE.some((item) => token.startsWith(item) || window.includes(item))) weight = weight === 1 ? 0 : -1;
    if (weight === 0) continue;
    const previous = tokens[i - 1];
    if (previous && NEGATIONS.has(previous)) weight *= -1;
    if (previous && INTENSIFIERS.has(previous)) weight *= 1.5;
    score += weight;
    if (weight > 0) positiveHits += 1;
    if (weight < 0) negativeHits += 1;
  }
  const normalized = Math.max(-1, Math.min(1, score / 4));
  let sentiment: Sentiment = "neutral";
  if (positiveHits > 0 && negativeHits > 0 && Math.abs(normalized) < 0.45) sentiment = "mixed";
  else if (normalized >= 0.2) sentiment = "positive";
  else if (normalized <= -0.2) sentiment = "negative";
  return { sentiment, sentimentScore: round(normalized) };
}

export function detectUrgency(
  text: string,
  deadlineIso?: string | null,
  receivedAt?: Date,
): Pick<Analysis, "urgencyLevel" | "urgencyScore"> {
  let score = 0;
  for (const [pattern, weight] of URGENCY_PHRASES) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) score += weight;
  }
  const exclamations = Math.min((text.match(/!/g) || []).length, 5);
  score += exclamations * 0.3;
  if (deadlineIso && receivedAt) {
    const delta = Date.parse(deadlineIso) - receivedAt.getTime();
    if (Number.isFinite(delta)) {
      if (delta < 0) score += 3;
      else if (delta <= 24 * 60 * 60 * 1000) score += 3;
      else if (delta <= 72 * 60 * 60 * 1000) score += 1;
    }
  }
  const urgencyScore = round(score);
  let urgencyLevel: Urgency = "low";
  if (score >= 6) urgencyLevel = "critical";
  else if (score >= 3) urgencyLevel = "high";
  else if (score >= 1) urgencyLevel = "normal";
  return { urgencyLevel, urgencyScore };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
