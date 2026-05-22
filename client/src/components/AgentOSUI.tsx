import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Circle, Clock, Loader2, Pause, XCircle } from "lucide-react";
import type { MissionStatus } from "../../../drizzle/schema";

// ─── Mission Status Badge ─────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  draft: { label: "Draft", className: "status-draft", icon: Circle },
  planning: { label: "Planning", className: "status-planning", icon: Loader2 },
  awaiting_approval: { label: "Awaiting Approval", className: "status-awaiting", icon: Clock },
  executing: { label: "Executing", className: "status-executing", icon: Loader2 },
  paused: { label: "Paused", className: "status-paused", icon: Pause },
  completed: { label: "Completed", className: "status-completed", icon: CheckCircle2 },
  failed: { label: "Failed", className: "status-failed", icon: XCircle },
};

export function MissionStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft!;
  const Icon = config.icon;
  const isAnimated = status === "planning" || status === "executing";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
        config.className,
        className
      )}
    >
      <Icon className={cn("w-3 h-3", isAnimated && "animate-spin")} />
      {config.label}
    </span>
  );
}

// ─── Agent Role Badge ─────────────────────────────────────────────────────────
const ROLE_CONFIG: Record<string, { label: string; className: string }> = {
  planner: { label: "Planner", className: "role-planner" },
  researcher: { label: "Researcher", className: "role-researcher" },
  writer: { label: "Writer", className: "role-writer" },
  coder: { label: "Coder", className: "role-coder" },
  reviewer: { label: "Reviewer", className: "role-reviewer" },
};

export function AgentRoleBadge({ role, className }: { role: string; className?: string }) {
  const config = ROLE_CONFIG[role] ?? { label: role, className: "status-draft" };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}

// ─── Risk Level Badge ─────────────────────────────────────────────────────────
export function RiskBadge({ level, className }: { level: string; className?: string }) {
  const classes: Record<string, string> = {
    safe: "risk-safe",
    moderate: "risk-moderate",
    destructive: "risk-destructive",
    low: "risk-safe",
    medium: "risk-moderate",
    high: "risk-destructive",
    critical: "risk-destructive",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize",
        classes[level] ?? "status-draft",
        className
      )}
    >
      {level}
    </span>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      )}
      {action && (
        <Button size="sm" className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

// ─── Loading Spinner ──────────────────────────────────────────────────────────
export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center py-12", className)}>
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  className,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  trend?: { value: number; label: string };
  className?: string;
}) {
  return (
    <div className={cn("bg-card border border-border rounded-xl p-4", className)}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-primary" />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {trend && (
        <p className="text-xs text-muted-foreground mt-1">
          <span
            className={cn(
              "font-medium",
              trend.value >= 0 ? "text-green-400" : "text-red-400"
            )}
          >
            {trend.value >= 0 ? "+" : ""}
            {trend.value}%
          </span>{" "}
          {trend.label}
        </p>
      )}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
export function SectionHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {actions}
    </div>
  );
}

// ─── Live indicator ───────────────────────────────────────────────────────────
export function LiveIndicator({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
      <span className="w-1.5 h-1.5 rounded-full bg-primary sse-live" />
      LIVE
    </span>
  );
}

// ─── Event type icon ──────────────────────────────────────────────────────────
const EVENT_ICONS: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  thought: { icon: Circle, color: "text-blue-400" },
  action: { icon: CheckCircle2, color: "text-green-400" },
  tool_call: { icon: AlertCircle, color: "text-yellow-400" },
  terminal: { icon: AlertCircle, color: "text-orange-400" },
  file_write: { icon: CheckCircle2, color: "text-purple-400" },
  browser: { icon: Circle, color: "text-cyan-400" },
  approval_request: { icon: Clock, color: "text-yellow-400" },
  approval_decision: { icon: CheckCircle2, color: "text-green-400" },
  status_change: { icon: Circle, color: "text-primary" },
  error: { icon: XCircle, color: "text-red-400" },
  summary: { icon: CheckCircle2, color: "text-emerald-400" },
};

export function EventTypeIcon({ type, className }: { type: string; className?: string }) {
  const config = EVENT_ICONS[type] ?? EVENT_ICONS.action!;
  const Icon = config.icon;
  return <Icon className={cn("w-3.5 h-3.5", config.color, className)} />;
}
