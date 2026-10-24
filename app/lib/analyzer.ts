export type WarningSign = {
  id: string;
  title: string;
  detail: string;
  matchedText: string;
};

export type AssessmentLabel = "Several warning signs" | "Some warning signs" | "No common warning signs detected";

export type AnalysisResult = {
  label: AssessmentLabel;
  summary: string;
  warningSigns: WarningSign[];
  recommendations: string[];
};

type RuleContent = {
  id: string;
  title: string;
  detail: string;
};

type Rule = RuleContent & (
  | { pattern: RegExp; findMatch?: never }
  | { pattern?: never; findMatch: (message: string) => string | null }
);

type IndexedMatch = { text: string; index: number; end: number };

const amountSource = String.raw`(?<![a-z0-9])(?:₱\s*|php\s*|p\s*)(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?(?![\d,.])`;
const chargePattern = new RegExp(`${amountSource}|\\b(?:fee|payment|deposit)\\b`, "gi");
const paymentActionPattern = /\b(?:pay|send|transfer|deposit|settle|cash in|magbayad|bayaran|magpadala|i-transfer)\b/gi;
const suspiciousPaymentContextPattern = /\b(?:claim|prize|reward|lottery|jackpot|winner|unlock|verification|verify|urgent|immediately|right away|act now|right now|expires? today|final warning|huling pagkakataon|ngayon na|agad|kaagad|ma-block|masususpend|nanalo|premyo|gantimpala)\b/gi;
const credentialRequestPattern = /\b(?:verify|confirm|send|share|provide|enter|reply with|i-verify|beripikahin|ilagay|ibigay|ipadala|isend|i-share|ipasa)\b.{0,45}\b(password|passcode|one[- ]time (?:pin|password|code)|otp|verification code|pin code|login details|account credentials|cvv|card number|password mo|otp mo|code mo)\b/gi;

function getMatches(pattern: RegExp, text: string): IndexedMatch[] {
  return Array.from(text.matchAll(pattern), (match) => ({
    text: match[0],
    index: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
}

function getSentenceSegments(message: string): Array<{ text: string; index: number }> {
  const segments: Array<{ text: string; index: number }> = [];
  let start = 0;

  for (let index = 0; index < message.length; index += 1) {
    const character = message[index];
    const previous = message[index - 1] ?? "";
    const next = message[index + 1] ?? "";
    const isDecimalPoint = character === "." && /\d/.test(previous) && /\d/.test(next);

    if ((character === "\n" || /[.!?]/.test(character)) && !isDecimalPoint) {
      const text = message.slice(start, index);
      if (text.trim()) segments.push({ text, index: start });
      start = index + 1;
    }
  }

  const lastText = message.slice(start);
  if (lastText.trim()) segments.push({ text: lastText, index: start });
  return segments;
}

function findSuspiciousPayment(message: string): string | null {
  // Require a payment action, an amount or fee, and nearby scam-like context
  // in one sentence. Routine delivery charges alone are not warning signs.
  for (const segment of getSentenceSegments(message)) {
    const actions = getMatches(paymentActionPattern, segment.text);
    const charges = getMatches(chargePattern, segment.text);
    const contexts = getMatches(suspiciousPaymentContextPattern, segment.text);
    if (contexts.length === 0 || actions.length === 0 || charges.length === 0) continue;

    for (const action of actions) {
      for (const charge of charges) {
        if (Math.abs(action.index - charge.index) > 80) continue;
        for (const context of contexts) {
          const distance = Math.min(Math.abs(context.index - action.end), Math.abs(context.index - charge.end));
          if (distance > 80) continue;
          const start = Math.min(action.index, charge.index, context.index);
          const end = Math.max(action.end, charge.end, context.end);
          if (end - start <= 180) {
            return message.slice(segment.index + start, segment.index + end).trim();
          }
        }
      }
    }
  }
  return null;
}
function findCredentialRequest(message: string): string | null {
  for (const match of message.matchAll(credentialRequestPattern)) {
    const actionIndex = match.index ?? 0;
    const prefix = message.slice(Math.max(0, actionIndex - 28), actionIndex);
    if (/(?:do not|don’t|don't|never|not|huwag|wag)\s+(?:please\s+)?$/i.test(prefix)) continue;
    return match[0];
  }
  return null;
}
const domainSuffixSource = "com|org|net|edu|gov|ph|co|io|app|dev|info|biz|xyz|site|online|link|click|top|ly|me";
const hostNameSource = String.raw`(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:${domainSuffixSource})(?:\.ph)?`;
const domainSource = String.raw`(?<![@\w.-])${hostNameSource}(?![a-z0-9-])`;
const urlSuffixSource = String.raw`(?::\d{1,5})?(?:[/?#][^\s<>"']*)?`;
const urlPattern = new RegExp(
  String.raw`(?:https?|hxxps?):\/\/(?:${hostNameSource}|(?:\d{1,3}\.){3}\d{1,3})${urlSuffixSource}|hxxps?:\/\/[a-z0-9-]+\s*\[\.\]\s*(?:${domainSuffixSource})(?:\.ph)?${urlSuffixSource}|\bwww\.${hostNameSource}${urlSuffixSource}|${domainSource}(?::\d{1,5})?(?:[/?#][^\s<>"']*)?|\b[a-z0-9-]+\s*\[\.\]\s*(?:${domainSuffixSource})(?:\.ph)?(?:[/?#][^\s<>"']*)?`,
  "i",
);
// This phrase set covers a few reviewed English, Filipino, and Taglish examples,
// not every regional expression or spelling variation. Prize and credential
// rules require surrounding context or an explicit request to reduce false hits.
const rules: Rule[] = [
  {
    id: "urgency",
    title: "Creates pressure to act quickly",
    detail: "Pressure to act before you can verify is a common warning sign.",
    pattern: /\b(?:urgent|immediately|right away|act now|last chance|expires? today|within \d+ hours?|final warning|asap|ngayon na|huling pagkakataon|(?:pay|magbayad|i-verify|ilagay|ibigay) agad|(?:account|profile|access).{0,20}(?:ma-block|masususpend)|(?:ma-block|masususpend).{0,20}(?:account|profile|access))\b/i,
  },
  {
    id: "payment",
    title: "Requests a payment in a suspicious context",
    detail: "An unexpected payment tied to a prize, account restriction, or urgent claim deserves independent verification.",
    findMatch: findSuspiciousPayment,
  },
  {
    id: "prize",
    title: "Promises an unexpected prize or reward",
    detail: "Unexpected winnings can be used to make a fee request or link seem convincing.",
    pattern: /\b(?:you (?:have )?won.{0,35}(?:prize|reward|lottery|jackpot|₱\s*\d|php\s*\d)|you are (?:a )?winner.{0,25}(?:prize|reward|lottery|jackpot)|winner of (?:a )?(?:prize|reward|lottery|jackpot)|claim your (?:prize|reward)|(?:prize|reward|lottery|jackpot).{0,35}(?:claim|won|winner)|congratulations.{0,40}(?:prize|reward|you won)|nanalo ka(?: ng (?:premyo|gantimpala|prize|reward|cash|pera))|nanalo kayo(?: ng (?:premyo|gantimpala|prize|reward|cash|pera))|nanalo po kayo(?: ng (?:premyo|gantimpala|prize|reward|cash|pera))|premyo.{0,30}(?:claim|makuha|nanalo)|gantimpala.{0,30}(?:claim|makuha|nanalo))\b/i,
  },
  {
    id: "credentials",
    title: "Requests sensitive account details",
    detail: "Do not share passwords, PINs, or one-time codes in response to a message.",
    findMatch: findCredentialRequest,
  },
  {
    id: "url",
    title: "Includes a link or web address",
    detail: "Unexpected links can lead to lookalike sign-in or payment pages. Check them independently.",
    pattern: urlPattern,
  },
];

function cleanEvidence(match: string): string {
  return match.replace(/[.,!?;:)\]}*'"”’]+$/, "");
}

function getAssessmentLabel(count: number): AssessmentLabel {
  if (count === 0) return "No common warning signs detected";
  if (count >= 3) return "Several warning signs";
  return "Some warning signs";
}

export function analyzeMessage(message: string): AnalysisResult {
  const warningSigns = rules.flatMap((rule) => {
    const matchedText = rule.findMatch
      ? rule.findMatch(message)
      : message.match(rule.pattern)?.[0] ?? null;
    return matchedText
      ? [{
          id: rule.id,
          title: rule.title,
          detail: rule.detail,
          matchedText: cleanEvidence(matchedText),
        }]
      : [];
  });

  const label = getAssessmentLabel(warningSigns.length);
  const summary = warningSigns.length >= 3
    ? "Several common warning patterns appeared. Verify the request independently before taking action."
    : warningSigns.length > 0
      ? "One or more common warning patterns appeared. Check the sender and context before responding."
      : "These checks did not find common warning patterns. That does not confirm the message is safe.";

  const recommendations = [
    "Don’t click unexpected links or share passwords, PINs, or one-time codes.",
    "Verify requests through the organization’s official app, website, or phone number, opened separately.",
    "If money or an account is involved, contact your bank or provider using its official contact details.",
  ];

  return { label, summary, warningSigns, recommendations };
}
