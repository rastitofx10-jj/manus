import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  Bot,
  Brain,
  CheckCircle2,
  Code2,
  Loader2,
  Plus,
  Rocket,
  Shield,
  Terminal,
  Zap,
  Sparkles,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useState } from "react";
import { PageContent, PageHeader } from "../components/AgentOSLayout";
import {
  AgentRoleBadge,
  EmptyState,
  LiveIndicator,
  LoadingSpinner,
  MissionStatusBadge,
  StatCard,
} from "../components/AgentOSUI";

export default function Dashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [goal, setGoal] = useState("");

  const { data: stats } = trpc.missions.stats.useQuery(undefined, { enabled: isAuthenticated });
  const { data: missions } = trpc.missions.list.useQuery({}, { enabled: isAuthenticated });
  const { data: agents } = trpc.agents.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: pending } = trpc.approvals.pending.useQuery(undefined, { enabled: isAuthenticated });

  const utils = trpc.useUtils();
  const createMutation = trpc.missions.create.useMutation({
    onSuccess: (mission) => {
      utils.missions.list.invalidate();
      setGoal("");
      toast.success("Mission created — planning started automatically");
      // Server auto-triggers plan generation, no need to call it here
      navigate(`/missions/${mission.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  if (loading) return <LoadingSpinner />;

  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Code2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Agent OS</h1>
          <p className="text-muted-foreground text-sm mb-6">
            An autonomous AI agent platform. Define goals in plain language and let multi-agent systems plan, execute, and report end-to-end.
          </p>
          <a href={getLoginUrl()}>
            <Button size="lg" className="w-full">
              Sign in to get started
            </Button>
          </a>
        </div>
      </div>
    );
  }

  const recentMissions = (missions ?? []).slice(0, 5);
  const activeAgents = (agents ?? []).filter((a) => a.status === "active");

  return (
    <>
      <PageHeader
        title={`Welcome back${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`}
        description="Your autonomous agent workspace"
      />
      <PageContent>
        {/* Command Center */}
        <div className="mb-6 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Mission Control</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Describe what you want agents to accomplish. We&apos;ll generate a plan and execute it.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <Textarea
              placeholder="Example: Research the top 5 AI frameworks in 2025, compare features, and write a markdown report…"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="min-h-24 bg-background border-border text-sm resize-none"
            />
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                disabled={goal.trim().length < 10 || createMutation.isPending}
                onClick={() => createMutation.mutate({ goal: goal.trim() })}
                className="gap-2"
              >
                <Rocket className="w-3.5 h-3.5" />
                {createMutation.isPending ? "Creating…" : "Create & Plan"}
              </Button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard
            label="Total Missions"
            value={stats?.total ?? 0}
            icon={Zap}
          />
          <StatCard
            label="Completed"
            value={stats?.completed ?? 0}
            icon={CheckCircle2}
          />
          <StatCard
            label="Executing"
            value={stats?.executing ?? 0}
            icon={Loader2}
          />
          <StatCard
            label="Pending Approvals"
            value={pending?.length ?? 0}
            icon={Shield}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Recent Missions */}
          <div className="lg:col-span-2 bg-card border border-border rounded-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Recent Missions</h2>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground h-7"
                onClick={() => navigate("/missions")}
              >
                View all
              </Button>
            </div>
            {recentMissions.length === 0 ? (
              <div>
                <EmptyState
                  icon={Zap}
                  title="No missions yet"
                  description="Create your first mission to get started"
                />
                <div className="px-4 py-4 border-t border-border">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Try an example:</p>
                  <div className="space-y-2">
                    {[
                      "Research the top 5 AI frameworks in 2025 and create a comparison table",
                      "Analyze this GitHub repo and write a technical summary report",
                      "Create a step-by-step tutorial for learning React hooks",
                    ].map((example, idx) => (
                      <button
                        key={idx}
                        onClick={() => setGoal(example)}
                        className="w-full p-2 text-left text-xs bg-muted/40 border border-border/50 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentMissions.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/missions/${m.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {m.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {m.goal}
                      </p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <MissionStatusBadge status={m.status} />
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(m.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Agent Status */}
          <div className="bg-card border border-border rounded-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Agent Status</h2>
              <LiveIndicator active={activeAgents.length > 0} />
            </div>
            <div className="p-3 space-y-2">
              {(agents ?? []).map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        agent.status === "active"
                          ? "bg-green-400 sse-live"
                          : agent.status === "error"
                          ? "bg-red-400"
                          : "bg-muted-foreground"
                      }`}
                    />
                    <AgentRoleBadge role={agent.role} />
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground capitalize">
                      {agent.status}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {agent.tasksCompleted} tasks
                    </p>
                  </div>
                </div>
              ))}
              {(agents ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Agents will be initialized on first mission
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "New Mission", icon: Zap, href: "/missions", color: "text-primary" },
            { label: "Terminal", icon: Terminal, href: "/terminal", color: "text-orange-400" },
            { label: "Memory", icon: Brain, href: "/memory", color: "text-purple-400" },
            { label: "Deployments", icon: Rocket, href: "/deployments", color: "text-green-400" },
          ].map((action) => (
            <button
              key={action.href}
              onClick={() => navigate(action.href)}
              className="flex items-center gap-2.5 p-3 bg-card border border-border rounded-xl hover:bg-accent transition-colors text-left"
            >
              <action.icon className={`w-4 h-4 ${action.color}`} />
              <span className="text-sm font-medium text-foreground">{action.label}</span>
            </button>
          ))}
        </div>
      </PageContent>
    </>
  );
}
