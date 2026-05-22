/**
 * Terminal command risk classifier.
 * Returns a risk level and whether the command requires approval before execution.
 */

export type RiskLevel = "safe" | "moderate" | "destructive";

export interface RiskAssessment {
  level: RiskLevel;
  requiresApproval: boolean;
  reason: string;
}

// Commands that are always blocked regardless of context
const BLOCKED_PATTERNS = [
  /rm\s+-rf\s+\/(?:\s|$)/i,
  /mkfs/i,
  /dd\s+if=/i,
  /:\(\)\s*\{.*\}/i, // fork bomb
  /chmod\s+777\s+\//i,
];

// Destructive patterns that require explicit approval
const DESTRUCTIVE_PATTERNS = [
  /\brm\s+(-[rfRF]+\s+)?[^\s]/i,
  /\bdrop\s+(table|database|schema)/i,
  /\btruncate\s+/i,
  /\bdelete\s+from\s+/i,
  /\bkill\s+(-9\s+)?/i,
  /\bpkill\s+/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bformat\b/i,
  /\bchmod\s+/i,
  /\bchown\s+/i,
  /\bsudo\s+/i,
  /\bsu\s+/i,
  /\bgit\s+push\s+.*--force/i,
  /\bgit\s+reset\s+--hard/i,
  /\bgit\s+clean\s+-[fFdx]+/i,
  /\bnpm\s+publish\b/i,
  /\bpnpm\s+publish\b/i,
  /\bcurl\s+.*\|\s*(bash|sh)/i,
  /\bwget\s+.*\|\s*(bash|sh)/i,
];

// Moderate risk patterns that are logged but allowed
const MODERATE_PATTERNS = [
  /\bgit\s+push\b/i,
  /\bgit\s+commit\b/i,
  /\bgit\s+merge\b/i,
  /\bgit\s+rebase\b/i,
  /\bnpm\s+install\b/i,
  /\bpnpm\s+install\b/i,
  /\bpip\s+install\b/i,
  /\bapt(-get)?\s+install\b/i,
  /\bcurl\b/i,
  /\bwget\b/i,
  /\bssh\b/i,
  /\bscp\b/i,
  /\brsync\b/i,
  /\bdocker\s+run\b/i,
  /\bdocker\s+exec\b/i,
  /\benv\b/i,
  /\bexport\s+/i,
];

// Allowlisted safe commands
const SAFE_PATTERNS = [
  /^ls(\s|$)/i,
  /^pwd(\s|$)/i,
  /^echo\s/i,
  /^cat\s/i,
  /^grep\s/i,
  /^find\s/i,
  /^head\s/i,
  /^tail\s/i,
  /^wc\s/i,
  /^sort\s/i,
  /^uniq\s/i,
  /^diff\s/i,
  /^mkdir\s/i,
  /^touch\s/i,
  /^cp\s/i,
  /^mv\s/i,
  /^node\s/i,
  /^python3?\s/i,
  /^tsc\s/i,
  /^pnpm\s+(run|build|test|check|dev)\b/i,
  /^npm\s+(run|build|test)\b/i,
  /^git\s+(status|log|diff|show|branch|fetch|pull|stash|tag)\b/i,
  /^which\s/i,
  /^type\s/i,
  /^date(\s|$)/i,
  /^whoami(\s|$)/i,
  /^uname\s/i,
  /^df\s/i,
  /^du\s/i,
  /^ps\s/i,
  /^top(\s|$)/i,
];

export function classifyCommand(command: string): RiskAssessment {
  const trimmed = command.trim();

  // Check blocked patterns first
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        level: "destructive",
        requiresApproval: true,
        reason: `Command matches a blocked pattern and cannot be executed: ${pattern.toString()}`,
      };
    }
  }

  // Check destructive patterns
  for (const pattern of DESTRUCTIVE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        level: "destructive",
        requiresApproval: true,
        reason: `Command is classified as destructive and requires explicit approval before execution.`,
      };
    }
  }

  // Check safe allowlist first (before moderate)
  for (const pattern of SAFE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        level: "safe",
        requiresApproval: false,
        reason: "Command is in the safe allowlist.",
      };
    }
  }

  // Check moderate patterns
  for (const pattern of MODERATE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        level: "moderate",
        requiresApproval: false,
        reason: "Command has moderate risk and is logged for audit.",
      };
    }
  }

  // Default: moderate for unknown commands
  return {
    level: "moderate",
    requiresApproval: false,
    reason: "Unknown command — classified as moderate risk by default.",
  };
}
