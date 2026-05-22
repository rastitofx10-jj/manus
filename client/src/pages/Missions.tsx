import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Plus, Search, Zap } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { PageContent, PageHeader } from "../components/AgentOSLayout";
import { EmptyState, LoadingSpinner, MissionStatusBadge } from "../components/AgentOSUI";
import { getLoginUrl } from "@/const";

const STATUS_FILTERS = ["all", "draft", "planning", "awaiting_approval", "executing", "completed", "failed"] as const;

export default function Missions() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState("");

  const utils = trpc.useUtils();
  const { data: missions, isLoading } = trpc.missions.list.useQuery({}, { enabled: isAuthenticated });

  const createMutation = trpc.missions.create.useMutation({
    onSuccess: (mission) => {
      utils.missions.list.invalidate();
      setOpen(false);
      setGoal("");
      toast.success("Mission created");
      navigate(`/missions/${mission.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Sign in to manage missions</p>
          <a href={getLoginUrl()}><Button>Sign In</Button></a>
        </div>
      </div>
    );
  }

  const filtered = (missions ?? []).filter((m) => {
    const matchesSearch =
      !search ||
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.goal.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <>
      <PageHeader
        title="Missions"
        description="Define goals and let agents execute them autonomously"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                New Mission
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg bg-card border-border">
              <DialogHeader>
                <DialogTitle>Create New Mission</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">
                    Mission Goal
                  </Label>
                  <Textarea
                    placeholder="Describe what you want the agents to accomplish in plain language…"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    className="min-h-28 bg-background border-border text-sm resize-none"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Be specific. Example: "Research the top 5 AI frameworks in 2025, compare their features, and write a markdown report."
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={goal.trim().length < 10 || createMutation.isPending}
                    onClick={() => createMutation.mutate({ goal: goal.trim() })}
                  >
                    {createMutation.isPending ? "Creating…" : "Create Mission"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        }
      />
      <PageContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search missions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card border-border text-sm h-8"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors capitalize ${
                  statusFilter === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {s === "all" ? "All" : s.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Zap}
            title="No missions found"
            description={
              search || statusFilter !== "all"
                ? "Try adjusting your filters"
                : "Create your first mission to get started"
            }
            action={
              !search && statusFilter === "all"
                ? { label: "Create Mission", onClick: () => setOpen(true) }
                : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((mission) => (
              <div
                key={mission.id}
                onClick={() => navigate(`/missions/${mission.id}`)}
                className={`bg-card border border-border rounded-xl p-4 cursor-pointer hover:bg-accent/30 transition-all duration-150 ${
                  mission.status === "executing" ? "mission-glow" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-foreground line-clamp-2 flex-1">
                    {mission.title}
                  </h3>
                  <MissionStatusBadge status={mission.status} className="shrink-0" />
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                  {mission.goal}
                </p>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{new Date(mission.createdAt).toLocaleDateString()}</span>
                  {mission.plan && (
                    <span>
                      {(mission.plan as Array<{ status: string }>).filter((s) => s.status === "completed").length}/
                      {(mission.plan as Array<unknown>).length} steps
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </PageContent>
    </>
  );
}
