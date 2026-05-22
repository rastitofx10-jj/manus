import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Bot, Brain, Code2, FileText, Search, Star } from "lucide-react";
import { PageContent, PageHeader } from "../components/AgentOSLayout";
import { AgentRoleBadge, EmptyState, LiveIndicator, LoadingSpinner } from "../components/AgentOSUI";
import { cn } from "@/lib/utils";
import { getLoginUrl } from "@/const";

const ROLE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  planner: Star,
  researcher: Search,
  writer: FileText,
  coder: Code2,
  reviewer: Brain,
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  planner: "Decomposes high-level goals into structured execution plans with ordered steps and agent assignments.",
  researcher: "Gathers information, synthesizes findings, and provides factual context for other agents.",
  writer: "Produces clear, structured written content including reports, documentation, and summaries.",
  coder: "Writes, reviews, and debugs code. Handles technical implementation and software engineering tasks.",
  reviewer: "Evaluates work quality, identifies issues, and generates executive summaries of completed missions.",
};

export default function Agents() {
  const { isAuthenticated } = useAuth();
  const { data: agents, isLoading } = trpc.agents.list.useQuery(undefined, { enabled: isAuthenticated });

  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Sign in to view agents</p>
          <a href={getLoginUrl()}><Button>Sign In</Button></a>
        </div>
      </div>
    );
  }

  const activeAgents = (agents ?? []).filter((a) => a.status === "active");

  return (
    <>
      <PageHeader
        title="Agents"
        description="Specialized AI agents that collaborate on your missions"
        actions={<LiveIndicator active={activeAgents.length > 0} />}
      />
      <PageContent>
        {isLoading ? (
          <LoadingSpinner />
        ) : (agents ?? []).length === 0 ? (
          <EmptyState
            icon={Bot}
            title="No agents yet"
            description="Agents are initialized automatically when you create your first mission."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {(agents ?? []).map((agent) => {
              const Icon = ROLE_ICONS[agent.role] ?? Bot;
              const isActive = agent.status === "active";
              const isError = agent.status === "error";

              return (
                <div
                  key={agent.id}
                  className={cn(
                    "bg-card border rounded-xl p-5 transition-all",
                    isActive ? "border-primary/40 mission-glow" : "border-border"
                  )}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          isActive ? "bg-primary/20" : "bg-muted"
                        )}
                      >
                        <Icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-muted-foreground")} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{agent.name}</h3>
                        <AgentRoleBadge role={agent.role} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full",
                          isActive ? "bg-green-400 sse-live" : isError ? "bg-red-400" : "bg-muted-foreground"
                        )}
                      />
                      <span
                        className={cn(
                          "text-xs capitalize",
                          isActive ? "text-green-400" : isError ? "text-red-400" : "text-muted-foreground"
                        )}
                      >
                        {agent.status}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                    {ROLE_DESCRIPTIONS[agent.role]}
                  </p>

                  {agent.currentTask && (
                    <div className="mb-3 p-2.5 bg-primary/10 rounded-lg">
                      <p className="text-xs text-primary font-medium">Current task</p>
                      <p className="text-xs text-foreground/80 mt-0.5 truncate">{agent.currentTask}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                      <p className="text-lg font-bold text-foreground">{agent.tasksCompleted ?? 0}</p>
                      <p className="text-[10px] text-muted-foreground">Tasks Done</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                      <p className="text-lg font-bold text-foreground">
                        {agent.tokensUsed != null
                          ? agent.tokensUsed > 999
                            ? `${(agent.tokensUsed / 1000).toFixed(1)}k`
                            : agent.tokensUsed
                          : 0}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Tokens Used</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PageContent>
    </>
  );
}
