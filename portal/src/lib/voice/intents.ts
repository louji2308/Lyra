export type Intent = "yes" | "no" | "stop" | "change" | "other";

const STOP_TOKENS = [
  "stop",
  "quit",
  "end call",
  "end the call",
  "hang up",
  "hangup",
  "podhum",
  "podhu",
  "podham",
  "bye",
  "நிறுத்து",
  "போதும்",
  "முடியும்",
];

const CHANGE_TOKENS = [
  "add",
  "remove",
  "change",
  "maatha",
  "maathu",
  "correction",
  "update",
  "sethu",
  "vendi",
  "சேர்",
  "கூட்டு",
  "குறை",
  "மாற்று",
];

const YES_TOKENS = [
  "yes",
  "yep",
  "yeah",
  "yup",
  "ok",
  "okay",
  "haan",
  "haa",
  "ha",
  "amaa",
  "ama",
  "amma",
  "sari",
  "sare",
  "sheri",
  "correct",
  "right",
  "confirm",
  "approve",
  "seri",
  "ஆம்",
  "ஆமா",
  "ஆமாம்",
  "சரி",
  "சரி",
  "ஓகே",
  "ம்ஹ்ம்",
  "ஹா",
];

const NO_TOKENS = [
  "no",
  "nope",
  "nah",
  "illa",
  "ille",
  "illai",
  "illaiy",
  "vendaam",
  "vendam",
  "venam",
  "venaam",
  "venda",
  "avasiyam illa",
  "இல்லை",
  "இல்ல",
  "வேண்டாம்",
  "நோ",
];

function hasToken(text: string, token: string): boolean {
  const boundary = "[\\s.,!?;:'\"()\\-—–]";
  return new RegExp(`(^|${boundary})${token}($|${boundary})`, "i").test(text);
}

function anyToken(text: string, tokens: string[]): boolean {
  return tokens.some((t) => hasToken(text, t));
}

export function detectIntent(raw: string): Intent {
  const text = raw
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:]+$/, "");

  if (!text) return "other";

  if (anyToken(text, STOP_TOKENS)) return "stop";
  if (anyToken(text, CHANGE_TOKENS)) return "change";
  if (anyToken(text, YES_TOKENS)) return "yes";
  if (anyToken(text, NO_TOKENS)) return "no";

  return "other";
}
