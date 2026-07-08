import { useState, useCallback } from "react";
import Papa from "papaparse";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, Download, FileText, AlertCircle, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CsvUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  templateUrl?: string;
  templateFilename: string;
  templateContent?: string;
  expectedColumns: string[];
  columnDisplayNames?: Record<string, string>;
  onImport: (data: Record<string, any>[]) => Promise<{
    success: number;
    errors: Array<{ row: number; error: string }>;
  }>;
  onSuccess?: () => void;
}

type UploadStep = "upload" | "preview" | "result";

export function CsvUploadDialog({
  open,
  onOpenChange,
  title,
  description,
  templateUrl,
  templateFilename,
  templateContent,
  expectedColumns,
  columnDisplayNames = {},
  onImport,
  onSuccess,
}: CsvUploadDialogProps) {
  const [step, setStep] = useState<UploadStep>("upload");
  const [parsedData, setParsedData] = useState<Record<string, any>[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: number;
    errors: Array<{ row: number; error: string }>;
  } | null>(null);

  const resetState = useCallback(() => {
    setStep("upload");
    setParsedData([]);
    setParseError(null);
    setIsImporting(false);
    setImportResult(null);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onOpenChange(false);
  }, [resetState, onOpenChange]);

  // Normalize column name: "Project Name" -> "project_name"
  const normalizeColumnName = (name: string) => {
    return name.toLowerCase().replace(/\s+/g, '_').trim();
  };

  const processFile = useCallback((file: File) => {
    setParseError(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setParseError(`CSV parsing error: ${results.errors[0].message}`);
          return;
        }

        const rawData = results.data as Record<string, any>[];
        if (rawData.length === 0) {
          setParseError("The CSV file is empty or contains no valid data rows.");
          return;
        }

        // Normalize headers to match expected format
        const data = rawData.map(row => {
          const normalizedRow: Record<string, any> = {};
          for (const [key, value] of Object.entries(row)) {
            normalizedRow[normalizeColumnName(key)] = value;
          }
          return normalizedRow;
        });

        const headers = Object.keys(data[0] || {});
        const missingColumns = expectedColumns.filter(
          (col) => !headers.includes(col)
        );

        if (missingColumns.length > 0) {
          setParseError(
            `Missing required columns: ${missingColumns.join(", ")}. Please use the template.`
          );
          return;
        }

        setParsedData(data);
        setStep("preview");
      },
      error: (error) => {
        setParseError(`Failed to parse CSV: ${error.message}`);
      },
    });
  }, [expectedColumns]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.csv')) {
      processFile(file);
    } else {
      setParseError("Please drop a CSV file.");
    }
  }, [processFile]);

  const handleDownloadTemplate = useCallback(() => {
    const csvContent = templateContent || `${expectedColumns.join(",")}\n`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = templateFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, [templateContent, expectedColumns, templateFilename]);

  const handleConfirmImport = useCallback(async () => {
    setIsImporting(true);
    try {
      const result = await onImport(parsedData);
      setImportResult(result);
      setStep("result");
      if (result.success > 0 && onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      setImportResult({
        success: 0,
        errors: [{ row: 0, error: error.message || "Import failed" }],
      });
      setStep("result");
    } finally {
      setIsImporting(false);
    }
  }, [parsedData, onImport, onSuccess]);

  const getColumnDisplayName = (col: string) => {
    return columnDisplayNames[col] || col.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) handleClose();
      else onOpenChange(open);
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-6 py-4">
            <Label
              htmlFor="csv-file"
              className="flex flex-col items-center justify-center border-2 border-dashed rounded-md p-8 bg-muted/20 cursor-pointer hover-elevate"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <Upload className="h-10 w-10 text-muted-foreground mb-4" />
              <span className="text-sm text-muted-foreground text-center">
                Click to select a CSV file or drag and drop
              </span>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
                data-testid="input-csv-file"
              />
            </Label>

            {parseError && (
              <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-md">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}

            <div className="flex items-center justify-between bg-muted/30 p-4 rounded-md">
              <div>
                <p className="text-sm font-medium">Need a template?</p>
                <p className="text-xs text-muted-foreground">
                  Download our CSV template with the correct column format
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                data-testid="button-download-template"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
            </div>

            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">Expected columns:</p>
              <div className="flex flex-wrap gap-2">
                {expectedColumns.map((col) => (
                  <Badge key={col} variant="secondary">
                    {getColumnDisplayName(col)}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="flex-1 min-h-0 space-y-4 py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Found <span className="font-medium">{parsedData.length}</span> rows to import
              </p>
              <Badge variant="outline">Preview Mode</Badge>
            </div>

            <ScrollArea className="h-[300px] border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    {expectedColumns.map((col) => (
                      <TableHead key={col}>{getColumnDisplayName(col)}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.slice(0, 50).map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                      {expectedColumns.map((col) => (
                        <TableCell key={col}>{row[col] || "-"}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {parsedData.length > 50 && (
              <p className="text-xs text-muted-foreground text-center">
                Showing first 50 rows of {parsedData.length}
              </p>
            )}

            <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-md border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                Please review the data above before confirming the import.
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                This action will create {parsedData.length} new records.
              </p>
            </div>
          </div>
        )}

        {step === "result" && importResult && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4">
              {importResult.success > 0 && (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">{importResult.success} records imported successfully</span>
                </div>
              )}
              {importResult.errors.length > 0 && (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">{importResult.errors.length} errors occurred</span>
                </div>
              )}
            </div>

            {importResult.errors.length > 0 && (
              <ScrollArea className="h-[200px] border rounded-md">
                <div className="p-4 space-y-2">
                  {importResult.errors.map((err, index) => (
                    <div key={index} className="text-sm flex items-start gap-2">
                      <Badge variant="destructive" className="shrink-0">
                        Row {err.row}
                      </Badge>
                      <span className="text-muted-foreground">{err.error}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose} data-testid="button-cancel-upload">
              Cancel
            </Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={resetState} data-testid="button-back-upload">
                Back
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={isImporting}
                data-testid="button-confirm-import"
              >
                {isImporting ? "Importing..." : `Confirm Import (${parsedData.length} rows)`}
              </Button>
            </>
          )}
          {step === "result" && (
            <Button onClick={handleClose} data-testid="button-close-result">
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
