import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Brain, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageContent, PageHeader } from "../components/AgentOSLayout";
import { EmptyState, LoadingSpinner } from "../components/AgentOSUI";
import { cn } from "@/lib/utils";
import { getLoginUrl } from "@/const";

const MEMORY_TYPES = ["learning", "preference", "fact", "instruction", "artifact_summary"] as const;
const TYPE_COLORS: Record<string, string> = {
  learning: "text-blue-400 bg-blue-400/10",
  preference: "text-purple-400 bg-purple-400/10",
  fact: "text-green-400 bg-green-400/10",
  instruction: "text-yellow-400 bg-yellow-400/10",
  artifact_summary: "text-orange-400 bg-orange-400/10",
};

export default function Memory() {
  const { isAuthenticated } = useAuth();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [type, setType] = useState<typeof MEMORY_TYPES[number]>("fact");

  const utils = trpc.useUtils();
  const { data: entries, isLoading } = trpc.memory.list.useQuery(
    { search: search || undefined },
    { enabled: isAuthenticated }
  );

  const upsertMutation = trpc.memory.upsert.useMutation({
    onSuccess: () => {
      utils.memory.list.invalidate();
      setOpen(false);
      setKey("");
      setValue("");
      toast.success("Memory entry saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.memory.delete.useMutation({
    onSuccess: () => { utils.memory.list.invalidate(); toast.success("Entry deleted"); },
  });

  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Sign in to view memory</p>
          <a href={getLoginUrl()}><Button>Sign In</Button></a>
        </div>
      </div>
    );
  }

  const filtered = (entries ?? []).filter(
    (e) => typeFilter === "all" || e.type === typeFilter
  );

  return (
    <>
      <PageHeader
        title="Memory & Context"
        description="Persistent learnings, preferences, facts, and instructions across missions"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-card border-border">
              <DialogHeader>
                <DialogTitle>Add Memory Entry</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                    <SelectTrigger className="bg-background border-border text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEMORY_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="capitalize">{t.replace("_", " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Key</Label>
                  <Input
                    placeholder="e.g. preferred_language"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    className="bg-background border-border text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Value</Label>
                  <Textarea
                    placeholder="The value or content to remember…"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="min-h-20 bg-background border-border text-sm resize-none"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button
                    size="sm"
                    disabled={!key || !value || upsertMutation.isPending}
                    onClick={() => upsertMutation.mutate({ key, value, type })}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        }
      />
      <PageContent>
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search memory…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card border-border text-sm h-8"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {["all", ...MEMORY_TYPES].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors capitalize",
                  typeFilter === t
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {t.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Brain}
            title="No memory entries"
            description="Agents automatically store learnings here. You can also add entries manually."
            action={{ label: "Add Entry", onClick: () => setOpen(true) }}
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((entry) => (
              <div key={entry.id} className="bg-card border border-border rounded-xl p-4 flex gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium capitalize", TYPE_COLORS[entry.type] ?? "")}>
                      {entry.type.replace("_", " ")}
                    </span>
                    <span className="text-xs font-mono text-foreground">{entry.key}</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{entry.value}</p>
                  {entry.tags && entry.tags.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {(entry.tags as string[]).map((tag) => (
                        <span key={tag} className="px-1.5 py-0.5 bg-muted rounded text-[10px] text-muted-foreground">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => deleteMutation.mutate({ id: entry.id })}
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </PageContent>
    </>
  );
}
