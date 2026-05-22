import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, Loader2, Plus, Terminal as TerminalIcon, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PageContent, PageHeader } from "../components/AgentOSLayout";
import { EmptyState, LoadingSpinner, RiskBadge } from "../components/AgentOSUI";
import { cn } from "@/lib/utils";
import { getLoginUrl } from "@/const";

export default function Terminal() {
  const { isAuthenticated } = useAuth();
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [command, setCommand] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const outputEndRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();
  const { data: workspace } = trpc.workspaces.getDefault.useQuery(undefined, { enabled: isAuthenticated });
  const { data: sessions, isLoading: sessionsLoading } = trpc.terminal.listSessions.useQuery(
    { workspaceId: workspace?.id },
    { enabled: isAuthenticated && !!workspace }
  );
  const { data: commands, isLoading: commandsLoading } = trpc.terminal.listCommands.useQuery(
    { sessionId: selectedSessionId! },
    { enabled: !!selectedSessionId }
  );

  // Realtime risk classification as user types
  const { data: riskData } = trpc.terminal.classifyCommand.useQuery(
    { command },
    { enabled: command.trim().length > 0, staleTime: 500 }
  );

  const createSession = trpc.terminal.createSession.useMutation({
    onSuccess: (session) => {
      utils.terminal.listSessions.invalidate();
      setSelectedSessionId(session.id);
      toast.success("Terminal session created");
    },
    onError: (e) => toast.error(e.message),
  });

  const runCommand = trpc.terminal.runCommand.useMutation({
    onSuccess: (result) => {
      utils.terminal.listCommands.invalidate({ sessionId: selectedSessionId! });
      setCommand("");
      setHistoryIndex(-1);
      if (result.requiresApproval) {
        toast.warning("Command requires approval before execution", {
          description: "An approval request has been created. Visit the Approvals page to review.",
        });
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const closeSession = trpc.terminal.closeSession.useMutation({
    onSuccess: () => {
      utils.terminal.listSessions.invalidate();
      setSelectedSessionId(null);
      toast.success("Session closed");
    },
  });

  // Auto-scroll output
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [commands]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && command.trim() && selectedSessionId) {
      e.preventDefault();
      setCommandHistory((h) => [command, ...h.slice(0, 49)]);
      runCommand.mutate({ sessionId: selectedSessionId, command: command.trim() });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
      setHistoryIndex(newIndex);
      setCommand(commandHistory[newIndex] ?? "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const newIndex = Math.max(historyIndex - 1, -1);
      setHistoryIndex(newIndex);
      setCommand(newIndex === -1 ? "" : (commandHistory[newIndex] ?? ""));
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Sign in to use the terminal</p>
          <a href={getLoginUrl()}><Button>Sign In</Button></a>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Terminal"
        description="Workspace-scoped command execution with risk classification"
        actions={
          <Button
            size="sm"
            disabled={!workspace || createSession.isPending}
            onClick={() =>
              workspace &&
              createSession.mutate({
                name: `Session ${new Date().toLocaleTimeString()}`,
                workspaceId: workspace.id,
              })
            }
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            New Session
          </Button>
        }
      />
      <PageContent className="p-0">
        <div className="flex h-full overflow-hidden">
          {/* Session list */}
          <div className="w-56 border-r border-border bg-card/30 flex flex-col">
            <div className="px-3 py-2.5 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sessions</p>
            </div>
            <ScrollArea className="flex-1">
              {sessionsLoading ? (
                <LoadingSpinner className="py-8" />
              ) : (sessions ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6 px-3">
                  No sessions. Create one to start.
                </p>
              ) : (
                <div className="p-2 space-y-1">
                  {(sessions ?? []).map((s) => (
                    <div
                      key={s.id}
                      onClick={() => setSelectedSessionId(s.id)}
                      className={cn(
                        "flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition-colors group",
                        selectedSessionId === s.id
                          ? "bg-primary/15 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <TerminalIcon className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-xs truncate">{s.name}</span>
                      </div>
                      {s.status === "open" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); closeSession.mutate({ id: s.id }); }}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Terminal output */}
          <div className="flex-1 flex flex-col bg-[oklch(0.08_0.005_264)]">
            {!selectedSessionId ? (
              <div className="flex-1 flex items-center justify-center">
                <EmptyState
                  icon={TerminalIcon}
                  title="No session selected"
                  description="Select a session from the left or create a new one"
                  action={
                    workspace
                      ? {
                          label: "New Session",
                          onClick: () =>
                            createSession.mutate({
                              name: `Session ${new Date().toLocaleTimeString()}`,
                              workspaceId: workspace.id,
                            }),
                        }
                      : undefined
                  }
                />
              </div>
            ) : (
              <>
                <ScrollArea className="flex-1 p-4">
                  <div className="terminal-output space-y-1">
                    <p className="text-muted-foreground text-xs mb-3">
                      Agent OS Terminal — workspace-scoped execution with risk classification
                    </p>
                    {commandsLoading ? (
                      <LoadingSpinner />
                    ) : (
                      (commands ?? []).map((cmd) => (
                        <div key={cmd.id} className="mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-primary">$</span>
                            <span className="text-foreground">{cmd.command}</span>
                            <RiskBadge level={cmd.riskLevel} className="ml-auto text-[10px]" />
                            {cmd.status === "completed" && (
                              <CheckCircle2 className="w-3 h-3 text-green-400" />
                            )}
                            {cmd.status === "pending_approval" && (
                              <AlertTriangle className="w-3 h-3 text-yellow-400" />
                            )}
                          </div>
                          {cmd.output && (
                            <pre className="mt-1 text-xs text-green-300/80 whitespace-pre-wrap pl-4">
                              {cmd.output}
                            </pre>
                          )}
                          {cmd.status === "pending_approval" && (
                            <p className="mt-1 text-xs text-yellow-400/80 pl-4">
                              ⚠ Awaiting approval — visit the Approvals page to review
                            </p>
                          )}
                        </div>
                      ))
                    )}
                    <div ref={outputEndRef} />
                  </div>
                </ScrollArea>

                {/* Command input */}
                <div className="border-t border-border p-3">
                  {riskData && command.trim() && (
                    <div className="flex items-center gap-2 mb-2">
                      <RiskBadge level={riskData.level} />
                      <span className="text-xs text-muted-foreground">{riskData.reason}</span>
                      {riskData.requiresApproval && (
                        <span className="text-xs text-yellow-400 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Requires approval
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-primary font-mono text-sm">$</span>
                    <Input
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Enter command… (↑↓ for history)"
                      className="flex-1 bg-transparent border-none focus-visible:ring-0 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 h-8"
                      disabled={runCommand.isPending}
                      autoFocus
                    />
                    {runCommand.isPending && (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </PageContent>
    </>
  );
}
