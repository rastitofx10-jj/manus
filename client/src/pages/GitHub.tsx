import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Github, GitBranch, Link2, Trash2, Unlink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageContent, PageHeader } from "../components/AgentOSLayout";
import { EmptyState, LoadingSpinner } from "../components/AgentOSUI";
import { getLoginUrl } from "@/const";

export default function GitHub() {
  const { isAuthenticated } = useAuth();
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");

  const utils = trpc.useUtils();
  const { data: workspace } = trpc.workspaces.getDefault.useQuery(undefined, { enabled: isAuthenticated });
  const { data: connection, isLoading } = trpc.github.getConnection.useQuery(
    { workspaceId: workspace?.id },
    { enabled: isAuthenticated && !!workspace }
  );

  const connectMutation = trpc.github.connect.useMutation({
    onSuccess: () => {
      utils.github.getConnection.invalidate();
      toast.success("Repository connected — approval request created");
    },
    onError: (e) => toast.error(e.message),
  });

  const disconnectMutation = trpc.github.disconnect.useMutation({
    onSuccess: () => {
      utils.github.getConnection.invalidate();
      toast.success("Repository disconnected");
    },
    onError: (e) => toast.error(e.message),
  });

  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Sign in to manage GitHub integration</p>
          <a href={getLoginUrl()}><Button>Sign In</Button></a>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="GitHub Integration"
        description="Connect repositories for agent-driven code operations with approval gates"
      />
      <PageContent>
        {isLoading ? (
          <LoadingSpinner />
        ) : connection ? (
          <div className="max-w-lg">
            <div className="bg-card border border-green-500/20 rounded-xl p-5 mb-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <Github className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {connection.owner}/{connection.repo}
                    </h3>
                    <p className="text-xs text-green-400">Connected</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => disconnectMutation.mutate({ id: connection.id })}
                >
                  <Unlink className="w-3.5 h-3.5 mr-1" />
                  Disconnect
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-0.5">Repository URL</p>
                  <a
                    href={connection.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <Link2 className="w-3 h-3" />
                    {connection.repoUrl}
                  </a>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-0.5">Active Branch</p>
                  <p className="text-xs text-foreground flex items-center gap-1">
                    <GitBranch className="w-3 h-3" />
                    {connection.activeBranch ?? connection.defaultBranch}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Safety Notice</h3>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-yellow-400 mt-0.5">⚠</span>
                  All push and write operations require explicit approval before execution
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-400 mt-0.5">⚠</span>
                  Force push and destructive git operations are blocked by default
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">✓</span>
                  Read operations (status, log, diff, fetch) are always allowed
                </li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="max-w-lg">
            <EmptyState
              icon={Github}
              title="No repository connected"
              description="Connect a GitHub repository to enable agent-driven code operations"
            />
            <div className="bg-card border border-border rounded-xl p-5 mt-4">
              <h3 className="text-sm font-semibold text-foreground mb-4">Connect Repository</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Owner</Label>
                    <Input
                      placeholder="username or org"
                      value={owner}
                      onChange={(e) => setOwner(e.target.value)}
                      className="bg-background border-border text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Repository</Label>
                    <Input
                      placeholder="repo-name"
                      value={repo}
                      onChange={(e) => setRepo(e.target.value)}
                      className="bg-background border-border text-sm"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Repository URL</Label>
                  <Input
                    placeholder="https://github.com/owner/repo"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    className="bg-background border-border text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Default Branch</Label>
                  <Input
                    placeholder="main"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="bg-background border-border text-sm"
                  />
                </div>
                <p className="text-xs text-yellow-400/80">
                  Connecting a repository creates an approval request that you must authorize.
                </p>
                <Button
                  size="sm"
                  disabled={!owner || !repo || !repoUrl || connectMutation.isPending}
                  onClick={() =>
                    connectMutation.mutate({
                      owner,
                      repo,
                      repoUrl,
                      defaultBranch: branch,
                      workspaceId: workspace?.id,
                    })
                  }
                  className="w-full"
                >
                  <Github className="w-3.5 h-3.5 mr-1.5" />
                  Connect Repository
                </Button>
              </div>
            </div>
          </div>
        )}
      </PageContent>
    </>
  );
}
