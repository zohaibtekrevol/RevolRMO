import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FolderArchive,
  FileText,
  Download,
  CloudOff,
  Inbox,
  FileSignature,
  Receipt,
  ScrollText,
} from "lucide-react";

type DriveProject = {
  projectId: string;
  projectName: string;
  region: string;
  status: string;
};

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
};

type ProjectFiles = {
  changeRequests: DriveFile[];
  invoices: DriveFile[];
  paymentReceipts: DriveFile[];
};

const SUBFOLDERS: {
  key: keyof ProjectFiles;
  label: string;
  icon: typeof FileText;
}[] = [
  { key: "changeRequests", label: "Change Requests", icon: FileSignature },
  { key: "invoices", label: "Invoices", icon: ScrollText },
  { key: "paymentReceipts", label: "Payment Receipts", icon: Receipt },
];

function formatBytes(size?: string): string {
  if (!size) return "";
  const bytes = parseInt(size, 10);
  if (isNaN(bytes) || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function FileRow({ file }: { file: DriveFile }) {
  const meta = [formatBytes(file.size), formatDate(file.modifiedTime)]
    .filter(Boolean)
    .join(" · ");
  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2 hover-elevate"
      data-testid={`row-drive-file-${file.id}`}
    >
      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" data-testid={`text-file-name-${file.id}`}>
          {file.name}
        </p>
        {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
      </div>
      <Button
        variant="ghost"
        size="sm"
        asChild
        data-testid={`button-download-${file.id}`}
      >
        <a href={`/api/drive/files/${file.id}/download`} download>
          <Download className="h-4 w-4" />
          <span className="ml-1.5">Download</span>
        </a>
      </Button>
    </div>
  );
}

function ProjectFilesPanel({ projectId }: { projectId: string }) {
  const { data, isLoading, isError, error } = useQuery<ProjectFiles>({
    queryKey: ["/api/drive/projects", projectId, "files"],
  });

  if (isLoading) {
    return (
      <div className="space-y-2" data-testid={`loading-files-${projectId}`}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    const message =
      error instanceof Error && error.message.includes("503")
        ? "Google Drive isn't connected right now. Connect a Google account to view documents."
        : "Couldn't load this project's documents. Please try again.";
    return (
      <p className="text-sm text-muted-foreground" data-testid={`error-files-${projectId}`}>
        {message}
      </p>
    );
  }

  if (!data) return null;

  const totalFiles =
    data.changeRequests.length + data.invoices.length + data.paymentReceipts.length;

  if (totalFiles === 0) {
    return (
      <div
        className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground"
        data-testid={`empty-files-${projectId}`}
      >
        <Inbox className="h-6 w-6" />
        <p className="text-sm">No documents have been saved for this project yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {SUBFOLDERS.map(({ key, label, icon: Icon }) => {
        const files = data[key];
        return (
          <div key={key} className="space-y-2">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">{label}</h4>
              <Badge variant="secondary" className="text-[10px]">
                {files.length}
              </Badge>
            </div>
            {files.length === 0 ? (
              <p className="pl-6 text-xs text-muted-foreground">No files.</p>
            ) : (
              <div className="space-y-1.5">
                {files.map((f) => (
                  <FileRow key={f.id} file={f} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function DriveDocuments() {
  const { data: status, isLoading: statusLoading } = useQuery<{ connected: boolean }>({
    queryKey: ["/api/drive/status"],
  });

  const connected = status?.connected ?? false;

  const {
    data: projects,
    isLoading: projectsLoading,
  } = useQuery<DriveProject[]>({
    queryKey: ["/api/drive/projects"],
    enabled: connected,
  });

  return (
    <div className="flex-1 space-y-6 p-4 md:p-6" data-testid="page-drive-documents">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <FolderArchive className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight" data-testid="text-page-title">
            Drive Documents
          </h1>
          <p className="text-sm text-muted-foreground">
            Browse and download project documents saved to Google Drive.
          </p>
        </div>
      </div>

      {statusLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : !connected ? (
        <Card data-testid="card-not-connected">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <CloudOff className="h-6 w-6" />
            </div>
            <CardTitle className="text-base">Google Drive isn't connected</CardTitle>
            <p className="max-w-md text-sm text-muted-foreground">
              Connect a Google account so the app can store and show your project
              documents. Once connected, your invoices, receipts, and change requests
              will appear here automatically.
            </p>
          </CardContent>
        </Card>
      ) : projectsLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : !projects || projects.length === 0 ? (
        <Card data-testid="card-no-projects">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Inbox className="h-6 w-6" />
            </div>
            <CardTitle className="text-base">No project documents yet</CardTitle>
            <p className="max-w-md text-sm text-muted-foreground">
              Project folders are created automatically the first time an invoice or
              receipt is generated. Once that happens, the projects will show up here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base" data-testid="text-projects-count">
              {projects.length} {projects.length === 1 ? "project" : "projects"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {projects.map((project) => (
                <AccordionItem
                  key={project.projectId}
                  value={project.projectId}
                  data-testid={`accordion-project-${project.projectId}`}
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex min-w-0 flex-1 items-center gap-3 pr-3 text-left">
                      <FolderArchive className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-medium">
                        {project.projectName}
                      </span>
                      <Badge variant="outline" className="ml-auto shrink-0 text-[10px]">
                        {project.region}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pt-2">
                      <ProjectFilesPanel projectId={project.projectId} />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
