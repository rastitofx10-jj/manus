import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Globe, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageContent, PageHeader } from "../components/AgentOSLayout";
import { EmptyState, LoadingSpinner, MissionStatusBadge, RiskBadge } from "../components/AgentOSUI";
import { getLoginUrl } from "@/const";

export default function BrowserTasks() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [objective, setObjective] = useState("");

  const utils = trpc.useUtils();
  const { data: tasks, isLoading } = trpc.browser.list.useQuery({}, { enabled: isAuthenticated });

  const createMutation = trpc.browser.create.useMutation({
    onSuccess: () => {
      utils.browser.list.invalidate();
      setOpen(false);
      setUrl("");
      setObjective("");
      toast.success("Browser task created — awaiting approval");
    },
    onError: (e) => toast.error(e.message),
  });

  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Sign in to manage browser tasks</p>
          <a href={getLoginUrl()}><Button>Sign In</Button></a>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Browser Automation"
        description="Automated browser tasks with approval checkpoints and takeover support"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                New Task
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-card border-border">
              <DialogHeader>
                <DialogTitle>Create Browser Task</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Target URL</Label>
                  <Input
                    placeholder="https://example.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="bg-background border-border text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Objective</Label>
                  <Textarea
                    placeholder="What should the agent do on this page?"
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    className="min-h-20 bg-background border-border text-sm resize-none"
                  />
                </div>
                <p className="text-xs text-yellow-400/80">
                  Browser tasks require approval before execution. An approval request will be created automatically.
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button
                    size="sm"
                    disabled={!url || !objective || createMutation.isPending}
                    onClick={() => createMutation.mutate({ url, objective })}
                  >
                    Create Task
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        }
      />
      <PageContent>
        {isLoading ? (
          <LoadingSpinner />
        ) : (tasks ?? []).length === 0 ? (
          <EmptyState
            icon={Globe}
            title="No browser tasks"
            description="Create a browser automation task to have agents interact with web pages on your behalf"
            action={{ label: "New Task", onClick: () => setOpen(true) }}
          />
        ) : (
          <div className="space-y-3">
            {(tasks ?? []).map((task) => (
              <div key={task.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{task.objective}</p>
                    <a
                      href={task.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline truncate block"
                    >
                      {task.url}
                    </a>
                  </div>
                  <MissionStatusBadge status={task.status} />
                </div>
                {task.requiresTakeover && (
                  <div className="mt-2 p-2.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <p className="text-xs text-yellow-400 font-medium">Human takeover required</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{task.takeoverReason}</p>
                  </div>
                )}
                {(task.observations ?? []).length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Observations</p>
                    {(task.observations as Array<{ type: string; description: string; timestamp: number }>).slice(-3).map((obs, i) => (
                      <div key={i} className="flex gap-2 text-xs">
                        <span className="text-muted-foreground capitalize">{obs.type}:</span>
                        <span className="text-foreground/80">{obs.description}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground mt-2">
                  {new Date(task.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </PageContent>
    </>
  );
}
