import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, Clock, Shield, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageContent, PageHeader } from "../components/AgentOSLayout";
import { EmptyState, LoadingSpinner, RiskBadge } from "../components/AgentOSUI";
import { getLoginUrl } from "@/const";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<string, string> = {
  terminal_command: "Terminal Command",
  file_delete: "File Deletion",
  external_submission: "External Submission",
  deployment: "Deployment",
  github_write: "GitHub Write",
  browser_action: "Browser Action",
  plan_approval: "Plan Approval",
};

function ApprovalCard({ approval, onDecide }: {
  approval: { id: number; type: string; title: string; description: string; riskLevel?: string | null; status: string; payload: unknown; createdAt: Date; decidedAt?: Date | null; decisionReason?: string | null };
  onDecide?: (id: number, decision: "approved" | "rejected", reason?: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [showReason, setShowReason] = useState(false);

  const isPending = approval.status === "pending";

  return (
    <div className={cn(
      "bg-card border rounded-xl p-4",
      isPending ? "border-yellow-500/30" : approval.status === "approved" ? "border-green-500/20" : "border-red-500/20"
    )}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {TYPE_LABELS[approval.type] ?? approval.type}
            </span>
            {approval.riskLevel && <RiskBadge level={approval.riskLevel} />}
          </div>
          <h3 className="text-sm font-semibold text-foreground">{approval.title}</h3>
        </div>
        <div className="shrink-0">
          {isPending ? (
            <Clock className="w-4 h-4 text-yellow-400" />
          ) : approval.status === "approved" ? (
            <CheckCircle2 className="w-4 h-4 text-green-400" />
          ) : (
            <XCircle className="w-4 h-4 text-red-400" />
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed mb-3 whitespace-pre-wrap">
        {approval.description}
      </p>

      {approval.decisionReason && (
        <p className="text-xs text-muted-foreground italic mb-2">
          Reason: {approval.decisionReason}
        </p>
      )}

      <p className="text-[10px] text-muted-foreground mb-3">
        Created {new Date(approval.createdAt).toLocaleString()}
        {approval.decidedAt && ` · Decided ${new Date(approval.decidedAt).toLocaleString()}`}
      </p>

      {isPending && onDecide && (
        <div className="space-y-2">
          {showReason && (
            <Textarea
              placeholder="Optional reason for your decision…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="text-xs bg-background border-border resize-none min-h-16"
            />
          )}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-xs"
              onClick={() => onDecide(approval.id, "approved", reason || undefined)}
            >
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="text-xs"
              onClick={() => onDecide(approval.id, "rejected", reason || undefined)}
            >
              <XCircle className="w-3 h-3 mr-1" />
              Reject
            </Button>
            <button
              onClick={() => setShowReason((s) => !s)}
              className="text-xs text-muted-foreground hover:text-foreground ml-auto"
            >
              {showReason ? "Hide reason" : "Add reason"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Approvals() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const { data: pending, isLoading: pendingLoading } = trpc.approvals.list.useQuery(
    { status: "pending" },
    { enabled: isAuthenticated, refetchInterval: 15_000 }
  );
  const { data: decided, isLoading: decidedLoading } = trpc.approvals.list.useQuery(
    { status: "approved" },
    { enabled: isAuthenticated }
  );
  const { data: rejected } = trpc.approvals.list.useQuery(
    { status: "rejected" },
    { enabled: isAuthenticated }
  );

  const decideMutation = trpc.approvals.decide.useMutation({
    onSuccess: (_, vars) => {
      utils.approvals.list.invalidate();
      utils.approvals.pending.invalidate();
      toast.success(`Request ${vars.decision}`);
    },
    onError: (e) => toast.error(e.message),
  });

  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Sign in to manage approvals</p>
          <a href={getLoginUrl()}><Button>Sign In</Button></a>
        </div>
      </div>
    );
  }

  const decidedAll = [...(decided ?? []), ...(rejected ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Review and approve or reject agent actions that require human oversight"
        actions={
          pending && pending.length > 0 ? (
            <span className="text-xs text-yellow-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              {pending.length} pending
            </span>
          ) : null
        }
      />
      <PageContent>
        <Tabs defaultValue="pending">
          <TabsList className="bg-card border border-border mb-5">
            <TabsTrigger value="pending" className="text-xs">
              Pending
              {(pending?.length ?? 0) > 0 && (
                <span className="ml-1.5 bg-yellow-500/20 text-yellow-400 text-[10px] px-1.5 py-0.5 rounded-full">
                  {pending!.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            {pendingLoading ? (
              <LoadingSpinner />
            ) : (pending ?? []).length === 0 ? (
              <EmptyState
                icon={Shield}
                title="No pending approvals"
                description="Approval requests will appear here when agents need your authorization"
              />
            ) : (
              <div className="space-y-3">
                {(pending ?? []).map((a) => (
                  <ApprovalCard
                    key={a.id}
                    approval={a as Parameters<typeof ApprovalCard>[0]["approval"]}
                    onDecide={(id, decision, reason) =>
                      decideMutation.mutate({ id, decision, reason })
                    }
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            {decidedLoading ? (
              <LoadingSpinner />
            ) : decidedAll.length === 0 ? (
              <EmptyState
                icon={Shield}
                title="No decision history"
                description="Approved and rejected requests will appear here"
              />
            ) : (
              <div className="space-y-3">
                {decidedAll.map((a) => (
                  <ApprovalCard
                    key={a.id}
                    approval={a as Parameters<typeof ApprovalCard>[0]["approval"]}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </PageContent>
    </>
  );
}
