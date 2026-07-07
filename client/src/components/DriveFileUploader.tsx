import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export interface DriveUploadResult {
  driveId: string;
  name: string;
  link: string | null;
}

interface DriveFileUploaderProps {
  // Project whose Change Requests folder the file is uploaded into.
  projectId: string;
  onUploaded: (result: DriveUploadResult) => void;
  maxFileSize?: number;
  accept?: string;
  disabled?: boolean;
  buttonClassName?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  children: ReactNode;
  "data-testid"?: string;
}

// Uploads a single file straight to Google Drive via the raw upload endpoint, then
// hands back the Drive file id + link. Renders as a button that opens the OS file
// picker (no modal) to keep the CR dialogs simple.
export function DriveFileUploader({
  projectId,
  onUploaded,
  maxFileSize = 25 * 1024 * 1024, // 25MB
  accept,
  disabled,
  buttonClassName,
  variant = "outline",
  children,
  "data-testid": dataTestId,
}: DriveFileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFile = async (file: File) => {
    if (file.size > maxFileSize) {
      toast({
        title: "File too large",
        description: `Maximum file size is ${Math.round(maxFileSize / (1024 * 1024))}MB.`,
        variant: "destructive",
      });
      return;
    }
    setUploading(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/change-requests/attachments?name=${encodeURIComponent(file.name)}`,
        {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
          credentials: "include",
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.code === "DRIVE_NOT_CONNECTED") {
          toast({
            title: "Google Drive not connected",
            description: "Connect a Google account to upload attachments.",
            variant: "destructive",
          });
          return;
        }
        throw new Error(data?.message || `Upload failed (${res.status})`);
      }
      const result = (await res.json()) as DriveUploadResult;
      onUploaded(result);
      toast({ title: "File uploaded", description: result.name });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error?.message || "Could not upload the file.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        data-testid={dataTestId ? `${dataTestId}-input` : undefined}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <Button
        type="button"
        variant={variant}
        className={buttonClassName}
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
        data-testid={dataTestId}
      >
        {uploading ? "Uploading..." : children}
      </Button>
    </>
  );
}
