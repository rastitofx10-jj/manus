import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Square,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { PageContent, PageHeader } from "../components/AgentOSLayout";
import {
  AgentRoleBadge,
  EmptyState,
  EventTypeIcon,
  LiveIndicator,
  LoadingSpinner,
  MissionStatusBadge,
} from "../components/AgentOSUI";
import { cn } from "@/lib/utils";

interface SSEEvent {
  event: string;
  data: Record<string, unknown>;
  timestamp: number;
}

interface PlanStep {
  id: string;
  order: number;
  title: string;
  description: string;
  agentRole: string;
  estimatedDuration: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  output?: string;
  tools: string[];
}

function StepStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="w-4 h-4 text-green-400" />;
    case "in_progress":
      return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
    case "failed":
      return <AlertTriangle className="w-4 h-4 text-red-400" />;
    default:
      return <Circle className="w-4 h-4 text-muted-foreground" />;
  }
}

export default function MissionDetail() {
  const { id } = useParams<{ id: string }>();
  const missionId = parseInt(id ?? "", 10);
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [liveEvents, setLiveEvents] = useState<SSEEvent[]>([]);
  const [sseConnected, setSseConnected] = useState(false);
  const [streamingTokens, setStreamingTokens] = useState<Record<string, string>>({});
  const eventSourceRef = useRef<EventSource | null>(null);
  const timelineEndRef = useRef<HTMLDivElement>(null);
  const seenEventIds = useRef<Set<string>>(new Set());

  const utils = trpc.useUtils();
  const { data: mission, isLoading } = trpc.missions.get.useQuery(
    { id: missionId },
    { enabled: isAuthenticated && !isNaN(missionId), refetchInterval: 30000 }
  );
  const { data: events } = trpc.missions.getEvents.useQuery(
    { missionId },
    { enabled: isAuthenticated && !isNaN(missionId), refetchInterval: 30000 }
  );

  const generatePlan = trpc.missions.generatePlan.useMutation({
    onSuccess: () => {
      toast.success("Plan generation started");
      utils.missions.get.invalidate({ id: missionId });
    },
    onError: (e) => toast.error(e.message),
  });

  const approvePlan = trpc.missions.approvePlan.useMutation({
    onSuccess: () => {
      toast.success("Mission execution started");
      utils.missions.get.invalidate({ id: missionId });
    },
    onError: (e) => toast.error(e.message),
  });

  const pauseMission = trpc.missions.pause.useMutation({
    onSuccess: () => { toast.success("Mission paused"); utils.missions.get.invalidate({ id: missionId }); },
  });

  const stopMission = trpc.missions.stop.useMutation({
    onSuccess: () => { toast.success("Mission stopped"); utils.missions.get.invalidate({ id: missionId }); },
  });

  const retryMission = trpc.missions.retry.useMutation({
    onSuccess: () => { toast.success("Mission reset to draft"); utils.missions.get.invalidate({ id: missionId }); },
  });

  // SSE connection for realtime events
  useEffect(() => {
    if (!isAuthenticated || isNaN(missionId)) return;
    // Start SSE immediately for all active mission states
    if (!mission) return;

    const es = new EventSource(`/api/sse/mission/${missionId}`);
    eventSourceRef.current = es;

    es.onopen = () => setSseConnected(true);
    es.onerror = () => setSseConnected(false);

    es.addEventListener("message", (e) => {
      try {
        const parsed = JSON.parse(e.data) as SSEEvent;
        // Deduplicate events by timestamp+event combo
        const eventKey = `${parsed.timestamp}-${parsed.event}`;
        if (seenEventIds.current.has(eventKey)) return;
        seenEventIds.current.add(eventKey);
        
        setLiveEvents((prev) => [...prev.slice(-199), parsed]);
        // Refresh mission data on ANY SSE event (not just status_change)
        utils.missions.get.invalidate({ id: missionId });
        utils.missions.getEvents.invalidate({ missionId });
      } catch {}
    });

    return () => {
      es.close();
      setSseConnected(false);
    };
  }, [missionId, isAuthenticated, mission?.id]);

  // Auto-scroll timeline
  useEffect(() => {
    timelineEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveEvents]);

  if (isLoading) return <LoadingSpinner />;
  if (!mission) return (
    <div className="flex-1 flex items-center justify-center">
      <EmptyState icon={Zap} title="Mission not found" action={{ label: "Back to Missions", onClick: () => navigate("/missions") }} />
    </div>
  );

  const plan = (mission.plan ?? []) as PlanStep[];
  const completedSteps = plan.filter((s) => s.status === "completed").length;
  const progress = plan.length > 0 ? Math.round((completedSteps / plan.length) * 100) : 0;

  // Merge DB events with live SSE events, sorted by timestamp
  const dbEvents = events ?? [];

  return (
    <>
      <PageHeader
        title={mission.title}
        description={mission.goal}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/missions")}>
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Back
            </Button>
            {mission.status === "draft" && (
              <Button
                size="sm"
                disabled={generatePlan.isPending}
                onClick={() => generatePlan.mutate({ id: missionId })}
              >
                {generatePlan.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Zap className="w-3.5 h-3.5 mr-1.5" />
                )}
                Generate Plan
              </Button>
            )}
            {mission.status === "awaiting_approval" && (
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                disabled={approvePlan.isPending}
                onClick={() => approvePlan.mutate({ id: missionId })}
              >
                <Play className="w-3.5 h-3.5 mr-1.5" />
                Approve & Execute
              </Button>
            )}
            {mission.status === "executing" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => pauseMission.mutate({ id: missionId })}
                >
                  <Pause className="w-3.5 h-3.5 mr-1" />
                  Pause
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => stopMission.mutate({ id: missionId })}
                >
                  <Square className="w-3.5 h-3.5 mr-1" />
                  Stop
                </Button>
              </>
            )}
            {(mission.status === "failed" || mission.status === "paused") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => retryMission.mutate({ id: missionId })}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                Retry
              </Button>
            )}
          </div>
        }
      />
      <PageContent className="p-0">
        <div className="flex h-full overflow-hidden">
          {/* Left: Plan + Summary */}
          <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
            {/* Status bar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card/50">
              <div className="flex items-center gap-3">
                <MissionStatusBadge status={mission.status} />
                {plan.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {completedSteps}/{plan.length} steps · {progress}%
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {mission.tokensUsed != null && (
                  <span className="text-xs text-muted-foreground">
                    {mission.tokensUsed.toLocaleString()} tokens
                  </span>
                )}
                <LiveIndicator active={sseConnected} />
              </div>
            </div>

            {/* Progress bar */}
            {plan.length > 0 && (
              <div className="h-0.5 bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            <ScrollArea className="flex-1">
              <div className="p-5">
                {/* Executive Summary */}
                {mission.summary && (
                  <div className="mb-5 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      <span className="text-sm font-semibold text-green-400">Executive Summary</span>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{mission.summary}</p>
                  </div>
                )}

                {/* Error state */}
                {mission.status === "failed" && mission.errorMessage && (
                  <div className="mb-5 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <span className="text-sm font-semibold text-red-400">Mission Failed</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{mission.errorMessage}</p>
                  </div>
                )}

                {/* Awaiting approval */}
                {mission.status === "awaiting_approval" && plan.length > 0 && (
                  <div className="mb-5 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-yellow-400" />
                      <span className="text-sm font-semibold text-yellow-400">Plan Ready — Awaiting Your Approval</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Review the {plan.length}-step execution plan below. Click "Approve & Execute" to start.
                    </p>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => approvePlan.mutate({ id: missionId })}
                    >
                      <Play className="w-3.5 h-3.5 mr-1.5" />
                      Approve & Execute
                    </Button>
                  </div>
                )}

                {/* Plan steps */}
                {plan.length > 0 ? (
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Execution Plan
                    </h3>
                    <div className="space-y-2">
                      {plan.map((step, i) => (
                        <div
                          key={step.id}
                          className={cn(
                            "flex gap-3 p-3 rounded-lg border transition-all",
                            step.status === "in_progress"
                              ? "border-primary/40 bg-primary/5"
                              : step.status === "completed"
                              ? "border-green-500/20 bg-green-500/5"
                              : step.status === "failed"
                              ? "border-red-500/20 bg-red-500/5"
                              : "border-border bg-card/50"
                          )}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <StepStatusIcon status={step.status} />
                            {i < plan.length - 1 && (
                              <div className="w-px flex-1 bg-border min-h-4" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs text-muted-foreground">#{step.order}</span>
                              <span className="text-sm font-medium text-foreground">{step.title}</span>
                              <AgentRoleBadge role={step.agentRole} className="ml-auto" />
                            </div>
                            <p className="text-xs text-muted-foreground">{step.description}</p>
                            {step.output && (
                              <p className="text-xs text-foreground/80 mt-1.5 p-2 bg-muted/50 rounded-md">
                                {step.output}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-1.5">
                              <span className="text-[10px] text-muted-foreground">
                                <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                                {step.estimatedDuration}
                              </span>
                              {step.tools.length > 0 && (
                                <span className="text-[10px] text-muted-foreground">
                                  Tools: {step.tools.join(", ")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : mission.status === "draft" ? (
                  <EmptyState
                    icon={Zap}
                    title="No plan yet"
                    description="Click 'Generate Plan' to have the AI create a multi-step execution plan for this mission."
                    action={{ label: "Generate Plan", onClick: () => generatePlan.mutate({ id: missionId }) }}
                  />
                ) : null}
              </div>
            </ScrollArea>
          </div>

          {/* Right: Realtime Event Timeline */}
          <div className="w-80 xl:w-96 flex flex-col bg-card/30">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-xs font-semibold text-foreground">Execution Timeline</h3>
              <LiveIndicator active={sseConnected} />
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-1">
                {dbEvents.length === 0 && liveEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    Events will appear here during execution
                  </p>
                ) : (
                  <>
                    {dbEvents.map((event) => (
                      <div key={event.id} className="flex gap-2 py-1.5">
                        <EventTypeIcon type={event.type} className="mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          {event.agentRole && (
                            <AgentRoleBadge role={event.agentRole} className="mb-0.5" />
                          )}
                          <p className="text-xs text-foreground/80 leading-relaxed">
                            {typeof event.payload === "object" && event.payload !== null
                              ? (event.payload as { message?: string }).message ?? event.type
                              : event.type}
                          </p>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(event.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    ))}
                    {liveEvents.map((event, i) => {
                      const data = event.data as { type?: string; agentRole?: string; message?: string };
                      return (
                        <div key={`live-${i}`} className="flex gap-2 py-1.5 bg-primary/5 rounded-md px-1">
                          <EventTypeIcon type={data.type ?? "action"} className="mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            {data.agentRole && (
                              <AgentRoleBadge role={data.agentRole} className="mb-0.5" />
                            )}
                            <p className="text-xs text-foreground leading-relaxed">
                              {data.message ?? data.type ?? "Event"}
                            </p>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(event.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
                <div ref={timelineEndRef} />
              </div>
            </ScrollArea>
          </div>
        </div>
      </PageContent>
    </>
  );
}
