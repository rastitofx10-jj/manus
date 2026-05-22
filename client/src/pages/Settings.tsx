import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { Code2, LogOut, Plus, Settings as SettingsIcon, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageContent, PageHeader } from "../components/AgentOSLayout";
import { LoadingSpinner } from "../components/AgentOSUI";
import { getLoginUrl } from "@/const";

export default function SettingsPage() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [workspaceName, setWorkspaceName] = useState("");

  const utils = trpc.useUtils();
  const { data: workspaces, isLoading: wsLoading } = trpc.workspaces.list.useQuery(undefined, { enabled: isAuthenticated });

  const createWorkspace = trpc.workspaces.create.useMutation({
    onSuccess: () => {
      utils.workspaces.list.invalidate();
      setWorkspaceName("");
      toast.success("Workspace created");
    },
    onError: (e) => toast.error(e.message),
  });

  if (loading) return <LoadingSpinner />;

  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Sign in to access settings</p>
          <a href={getLoginUrl()}><Button>Sign In</Button></a>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Settings" description="Account, workspaces, and platform configuration" />
      <PageContent>
        <div className="max-w-lg space-y-6">
          {/* Account */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              Account
            </h3>
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Name</Label>
                <p className="text-sm text-foreground mt-0.5">{user?.name ?? "—"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Email</Label>
                <p className="text-sm text-foreground mt-0.5">{user?.email ?? "—"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Role</Label>
                <p className="text-sm text-foreground mt-0.5 capitalize">{user?.role ?? "user"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Member since</Label>
                <p className="text-sm text-foreground mt-0.5">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
                </p>
              </div>
            </div>
            <Separator className="my-4" />
            <Button
              variant="destructive"
              size="sm"
              onClick={() => logout()}
            >
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
              Sign Out
            </Button>
          </div>

          {/* Workspaces */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Code2 className="w-4 h-4 text-muted-foreground" />
              Workspaces
            </h3>
            {wsLoading ? (
              <LoadingSpinner className="py-4" />
            ) : (
              <div className="space-y-2 mb-4">
                {(workspaces ?? []).map((ws) => (
                  <div key={ws.id} className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-foreground">{ws.name}</p>
                      {ws.isDefault && (
                        <span className="text-[10px] text-primary">Default</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(ws.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="New workspace name"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                className="bg-background border-border text-sm h-8"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && workspaceName.trim()) {
                    createWorkspace.mutate({ name: workspaceName.trim() });
                  }
                }}
              />
              <Button
                size="sm"
                disabled={!workspaceName.trim() || createWorkspace.isPending}
                onClick={() => createWorkspace.mutate({ name: workspaceName.trim() })}
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Platform info */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <SettingsIcon className="w-4 h-4 text-muted-foreground" />
              Platform
            </h3>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Version</span>
                <span className="text-foreground font-mono">1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span>Stack</span>
                <span className="text-foreground font-mono">React 19 + tRPC + MySQL</span>
              </div>
              <div className="flex justify-between">
                <span>Execution Engine</span>
                <span className="text-foreground font-mono">SSE + LLM</span>
              </div>
              <div className="flex justify-between">
                <span>Agent Roles</span>
                <span className="text-foreground font-mono">5 (Planner, Researcher, Writer, Coder, Reviewer)</span>
              </div>
            </div>
          </div>
        </div>
      </PageContent>
    </>
  );
}
