import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Download, File, FileText, Files as FilesIcon, Image, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { PageContent, PageHeader } from "../components/AgentOSLayout";
import { EmptyState, LoadingSpinner } from "../components/AgentOSUI";
import { getLoginUrl } from "@/const";

function fileIcon(mimeType?: string | null) {
  if (!mimeType) return File;
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.startsWith("text/")) return FileText;
  return File;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Files() {
  const { isAuthenticated } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const utils = trpc.useUtils();
  const { data: workspace } = trpc.workspaces.getDefault.useQuery(undefined, { enabled: isAuthenticated });
  const { data: files, isLoading } = trpc.files.list.useQuery(
    { workspaceId: workspace?.id! },
    { enabled: isAuthenticated && !!workspace }
  );

  const uploadMutation = trpc.files.upload.useMutation({
    onSuccess: () => {
      utils.files.list.invalidate();
      toast.success("File uploaded");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.files.delete.useMutation({
    onSuccess: () => {
      utils.files.list.invalidate();
      toast.success("File deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !workspace) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = (ev.target?.result as string).split(",")[1] ?? "";
        await uploadMutation.mutateAsync({
          workspaceId: workspace.id,
          name: file.name,
          path: `/${file.name}`,
          content: base64,
          mimeType: file.type || undefined,
        });
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploading(false);
    }
    e.target.value = "";
  };

  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Sign in to manage files</p>
          <a href={getLoginUrl()}><Button>Sign In</Button></a>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Workspace Files"
        description="Files created or uploaded within your workspace"
        actions={
          <>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              size="sm"
              disabled={uploading || !workspace}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              {uploading ? "Uploading…" : "Upload File"}
            </Button>
          </>
        }
      />
      <PageContent>
        {isLoading ? (
          <LoadingSpinner />
        ) : (files ?? []).length === 0 ? (
          <EmptyState
            icon={FilesIcon}
            title="No files yet"
            description="Upload files or run missions that create files in your workspace"
            action={{ label: "Upload File", onClick: () => fileInputRef.current?.click() }}
          />
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-0 text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5 border-b border-border">
              <span className="w-8" />
              <span>Name</span>
              <span className="w-24 text-right">Size</span>
              <span className="w-32 text-right">Created</span>
              <span className="w-10" />
            </div>
            <div className="divide-y divide-border">
              {(files ?? []).map((f) => {
                const Icon = fileIcon(f.mimeType);
                return (
                  <div
                    key={f.id}
                    className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-0 items-center px-4 py-3 hover:bg-accent/30 transition-colors"
                  >
                    <div className="w-8">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{f.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{f.path}</p>
                    </div>
                    <span className="w-24 text-right text-xs text-muted-foreground">
                      {f.size != null ? formatBytes(f.size) : "—"}
                    </span>
                    <span className="w-32 text-right text-xs text-muted-foreground">
                      {new Date(f.createdAt).toLocaleDateString()}
                    </span>
                    <div className="w-10 flex justify-end">
                      <button
                        onClick={() => deleteMutation.mutate({ id: f.id })}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </PageContent>
    </>
  );
}
