// CI logs are untrusted, attacker-influenceable content that routinely contains
// real secrets (leaked env vars, tokens pasted into error output, connection
// strings). Every code path that persists a log excerpt or hands one to an AI
// provider MUST go through redact() first — see docs/AI_SAFETY.md and
// docs/SECURITY.md. This runs before storage, not just before AI calls, so a
// secret never touches the database in the first place.

interface RedactionRule {
  name: string;
  pattern: RegExp;
}

// Ordered roughly most-specific-first so overlapping matches (e.g. a bearer
// token that also looks like a generic hex secret) get the more informative label.
const RULES: RedactionRule[] = [
  { name: "aws-access-key-id", pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: "aws-secret-key", pattern: /\b(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[:=]\s*["']?([A-Za-z0-9/+=]{40})["']?/g },
  { name: "github-token", pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { name: "slack-token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { name: "openai-key", pattern: /\bsk-[A-Za-z0-9]{20,}\b/g },
  // `[\w]*` on both sides: real secret env vars are routinely wrapped in an
  // identifier joined by `_` (STRIPE_SECRET_KEY, DB_PASSWORD_HASH), and a
  // plain `\bsecret\b` neither matches after a preceding `_` nor tolerates
  // a trailing `_KEY`-style suffix before the `=`.
  { name: "generic-api-key", pattern: /[\w]*(?:api[_-]?key|apikey|secret|token|password|passwd|pwd)[\w]*["']?\s*[:=]\s*["']?[A-Za-z0-9_\-/.+=]{8,}["']?/gi },
  { name: "bearer-token", pattern: /\bBearer\s+[A-Za-z0-9_\-.=]{10,}/g },
  { name: "basic-auth-url", pattern: /\b[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\s/@:]+:[^\s/@]+@/g },
  { name: "private-key-block", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { name: "jwt", pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  { name: "slack-webhook", pattern: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/]+/g },
];

export interface RedactionResult {
  text: string;
  redactionCount: number;
  matchedRules: string[];
}

export function redactSecrets(input: string): RedactionResult {
  let text = input;
  let redactionCount = 0;
  const matchedRules = new Set<string>();

  for (const rule of RULES) {
    text = text.replace(rule.pattern, () => {
      redactionCount += 1;
      matchedRules.add(rule.name);
      return `[REDACTED:${rule.name}]`;
    });
  }

  return { text, redactionCount, matchedRules: [...matchedRules] };
}

/** Convenience wrapper for call sites that only need the redacted text. */
export function redact(input: string): string {
  return redactSecrets(input).text;
}
