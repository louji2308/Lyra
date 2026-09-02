export type Intent = "yes" | "no" | "stop" | "change" | "complaint" | "return" | "catalog_query" | "info" | "other";

const BOUNDARY = "[\\s.,!?;:'\"()\\-—–]";

const STOP_TOKENS = [
  "stop", "quit", "end call", "end the call", "hang up", "hangup",
  "podhum", "podhu", "podham", "bye",
  "நிறுத்து", "போதும்", "முடியும்",
];

const CHANGE_TOKENS = [
  "add", "remove", "change", "maatha", "maathu", "correction",
  "update", "sethu", "vendi", "சேர்", "கூட்டு", "குறை", "மாற்று",
];

const YES_TOKENS = [
  "yes", "yep", "yeah", "yup", "ok", "okay", "haan", "haa", "ha",
  "amaa", "ama", "amma", "sari", "sare", "sheri", "correct", "right",
  "confirm", "approve", "seri", "ஆம்", "ஆமா", "ஆமாம்", "சரி", "ஓகே", "ம்ஹ்ம்", "ஹா",
];

const NO_TOKENS = [
  "no", "nope", "nah", "illa", "ille", "illai", "illaiy",
  "vendaam", "vendam", "venam", "venaam", "venda", "avasiyam illa",
  "இல்லை", "இல்ல", "வேண்டாம்", "நோ",
];

const COMPLAINT_TOKENS = [
  "complaint", "problem", "issue", "damaged", "wrong", "late",
  "missing", "broken", "bad", "poor", "price", "complain",
  "prashna", "badhu", "kushtam", "thevai illa",
  "பிரச்சனை", "சேதம்", "தவறு", "புகார்",
];

const RETURN_TOKENS = [
  "return", "refund", "exchange", "replace", "back",
  "edukka", "thirupi", "mattum", "கொடு", "திரும்ப",
];

const CATALOG_QUERY_TOKENS = [
  "enna product", "what product", "what do you have", "catalog", "list products",
  "lifebuoy", "dove", "clinic plus", "lux",
  "surf excel", "wheel", "rin", "pepsodent", "boost", "red label", "brooke bond",
  "soap", "shampoo", "detergent", "tea", "toothpaste", "handwash",
];

const INFO_QUERY_TOKENS = [
  "stock", "credit", "balance", "delivery", "price", "rate",
  "scheme", "offer", "discount", "promotion",
  "enna stock", "stock irukku", "credit irukku", "enna credit",
  "stock illaya", "credit over", "credit limit",
  "delivery status", "delivery eppo", "eppo delivery",
  "price enna", "rate enna", "discount irukka",
  ".scheme", "offer irukka",
  "status", "update", "info", "information", "details",
  "பங்க்", "கடன்", "செய்தி", "தகவல்", "விலை", "டெலிவரி",
];

function buildTokenRegex(tokens: string[]): RegExp {
  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const alternation = escaped.join("|");
  return new RegExp(`(^|${BOUNDARY})(?:${alternation})($|${BOUNDARY})`, "i");
}

const STOP_RE = buildTokenRegex(STOP_TOKENS);
const COMPLAINT_RE = buildTokenRegex(COMPLAINT_TOKENS);
const RETURN_RE = buildTokenRegex(RETURN_TOKENS);
const CHANGE_RE = buildTokenRegex(CHANGE_TOKENS);
const YES_RE = buildTokenRegex(YES_TOKENS);
const NO_RE = buildTokenRegex(NO_TOKENS);
const CATALOG_QUERY_RE = buildTokenRegex(CATALOG_QUERY_TOKENS);
const INFO_RE = buildTokenRegex(INFO_QUERY_TOKENS);

export function detectIntent(raw: string): Intent {
  const text = raw
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:]+$/, "");

  if (!text) return "other";

  if (STOP_RE.test(text)) return "stop";
  if (COMPLAINT_RE.test(text)) return "complaint";
  if (RETURN_RE.test(text)) return "return";
  if (CHANGE_RE.test(text)) return "change";
  if (INFO_RE.test(text)) return "info";
  if (CATALOG_QUERY_RE.test(text)) return "catalog_query";
  if (YES_RE.test(text)) return "yes";
  if (NO_RE.test(text)) return "no";

  return "other";
}
