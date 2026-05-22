import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, ExternalLink, Loader2, Plus, Rocket, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageContent, PageHeader } from "../components/AgentOSLayout";
import { EmptyState, LoadingSpinner } from "../components/AgentOSUI";
import { cn } from "@/lib/utils";
import { getLoginUrl } from "@/const";

const STATUS_STYLES: Record<string, string> = {
  pending: "status-awaiting",
  building: "status-planning",
  deploying: "status-executing",
  live: "status-completed",
  failed: "status-failed",
  rolled_back: "status-paused",
};

export default function Deployments() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<string>("manus");

  const utils = trpc.useUtils();
  const { data: deployments, isLoading } = trpc.deployments.list.useQuery(undefined, { enabled: isAuthenticated });

  const createMutation = trpc.deployments.create.useMutation({
    onSuccess: () => {
      utils.deployments.list.invalidate();
      setOpen(false);
      setName("");
      toast.success("Deployment queued — awaiting approval");
    },
    onError: (e) => toast.error(e.message),
  });

  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Sign in to manage deployments</p>
          <a href={getLoginUrl()}><Button>Sign In</Button></a>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Deployments"
        description="Deploy mission outputs with approval gates and rollback support"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                New Deployment
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-card border-border">
              <DialogHeader>
                <DialogTitle>Create Deployment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Deployment Name</Label>
                  <Input
                    placeholder="my-app-v1.0"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-background border-border text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Provider</Label>
                  <Select value={provider} onValueChange={setProvider}>
                    <SelectTrigger className="bg-background border-border text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["manus", "vercel", "netlify", "railway", "custom"].map((p) => (
                        <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-yellow-400/80">
                  Deployments require approval before execution.
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button
                    size="sm"
                    disabled={!name || createMutation.isPending}
                    onClick={() => createMutation.mutate({ name, provider: provider as "manus" | "vercel" | "netlify" | "railway" | "custom" })}
                  >
                    {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create"}
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
        ) : (deployments ?? []).length === 0 ? (
          <EmptyState
            icon={Rocket}
            title="No deployments yet"
            description="Create a deployment to publish mission outputs to production"
            action={{ label: "New Deployment", onClick: () => setOpen(true) }}
          />
        ) : (
          <div className="space-y-3">
            {(deployments ?? []).map((dep) => (
              <div key={dep.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{dep.name}</h3>
                    <p className="text-xs text-muted-foreground capitalize">{dep.provider}</p>
                  </div>
                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_STYLES[dep.status] ?? "status-draft")}>
                    {dep.status}
                  </span>
                </div>
                {dep.url && (
                  <a
                    href={dep.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary hover:underline mb-2"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {dep.url}
                  </a>
                )}
                {dep.logs && (dep.logs as Array<{ level: string; message: string; timestamp: number }>).slice(-3).map((log, i) => (
                  <p key={i} className="text-xs text-muted-foreground font-mono">
                    [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
                  </p>
                ))}
                <p className="text-[10px] text-muted-foreground mt-2">
                  {new Date(dep.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </PageContent>
    </>
  );
}
