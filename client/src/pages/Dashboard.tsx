import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { useLocation } from "wouter";
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

  const { data: stats } = trpc.missions.stats.useQuery(undefined, { enabled: isAuthenticated });
  const { data: missions } = trpc.missions.list.useQuery({}, { enabled: isAuthenticated });
  const { data: agents } = trpc.agents.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: pending } = trpc.approvals.pending.useQuery(undefined, { enabled: isAuthenticated });

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
        actions={
          <Button size="sm" onClick={() => navigate("/missions")}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            New Mission
          </Button>
        }
      />
      <PageContent>
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
              <EmptyState
                icon={Zap}
                title="No missions yet"
                description="Create your first mission to get started"
                action={{ label: "Create Mission", onClick: () => navigate("/missions") }}
              />
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
