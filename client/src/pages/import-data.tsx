import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Download, Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, Edit, Save, RefreshCw, ArrowLeft, ArrowRight, Undo2 } from "lucide-react";
import type { ProjectWithMilestones } from "@shared/schema";
import Papa from "papaparse";

type ImportStep = "upload" | "preview" | "complete";

type ProcessedRow = {
  rowIndex: number;
  projectName: string;
  clientName: string;
  phaseMilestone: string;
  expectedAmount: string;
  receivedAmount: string;
  status: string;
  paymentType: "recurring" | "upsell";
  isTarget: boolean;
  receivedDate: string | null;
  invoiceDate: string | null;
  notes: string;
  matched: boolean;
  projectId: string | null;
  milestoneId: string | null;
  paymentId: string | null;
  matchedProjectName: string | null;
  matchedMilestoneName: string | null;
  errors: string[];
};

type PreviewResponse = {
  success: boolean;
  preview?: boolean;
  processedRows: ProcessedRow[];
  summary?: {
    total: number;
    matched: number;
    unmatched: number;
    withErrors: number;
  };
  created?: number;
  updated?: number;
  errors?: string[];
  undoToken?: string;
};

export default function ImportData() {
  const { toast } = useToast();
  const [step, setStep] = useState<ImportStep>("upload");
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [fileName, setFileName] = useState<string>("");
  const [rawData, setRawData] = useState<any[]>([]);
  const [processedRows, setProcessedRows] = useState<ProcessedRow[]>([]);
  const [summary, setSummary] = useState<{ total: number; matched: number; unmatched: number; withErrors: number } | null>(null);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [importResult, setImportResult] = useState<{ created: number; updated: number; errors: string[]; undoToken?: string } | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmMonth, setConfirmMonth] = useState<number>(new Date().getMonth() + 1);
  const [confirmYear, setConfirmYear] = useState<number>(new Date().getFullYear());
  const [undoCountdown, setUndoCountdown] = useState<number>(0);
  const [isUndoing, setIsUndoing] = useState(false);

  const { data: referenceData = [] } = useQuery<ProjectWithMilestones[]>({
    queryKey: ["/api/import/reference-data"],
  });

  const previewMutation = useMutation({
    mutationFn: async (data: { rows: any[]; month: number; year: number; fileName: string; confirm?: boolean }) => {
      const response = await apiRequest("POST", "/api/import/process", data);
      return response.json() as Promise<PreviewResponse>;
    },
    onSuccess: (data) => {
      if (data.preview) {
        setProcessedRows(data.processedRows);
        setSummary(data.summary || null);
        setStep("preview");
      } else if (data.success && !data.preview) {
        setImportResult({
          created: data.created || 0,
          updated: data.updated || 0,
          errors: data.errors || [],
          undoToken: data.undoToken,
        });
        setStep("complete");
        if (data.undoToken) {
          setUndoCountdown(30);
        }
        queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to process import data",
        variant: "destructive",
      });
    },
  });

  const downloadTemplate = useCallback(() => {
    const headers = [
      "Project Name",
      "Client Name",
      "Phase/Milestone",
      "Expected Amount",
      "Received Amount",
      "Status",
      "Payment Type",
      "Is Target",
      "Invoice Date",
      "Received Date",
      "Notes",
    ];

    const sampleRows = referenceData.slice(0, 3).flatMap((project) => {
      if (project.milestones && project.milestones.length > 0) {
        return project.milestones.map((m) => [
          project.name,
          project.clientName,
          m.name,
          m.expectedAmount || "0",
          "0",
          "Unpaid",
          "Recurring",
          "Yes",
          "",
          "",
          "",
        ]);
      }
      return [[project.name, project.clientName, "Phase 1", "0", "0", "Unpaid", "Recurring", "Yes", "", "", ""]];
    });

    const csvContent = [headers, ...sampleRows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `payment_import_template_${month}_${year}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [referenceData, month, year]);

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setFileName(file.name);

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data.map((row: any) => {
            const paymentTypeRaw = (row["Payment Type"] || row["paymentType"] || row["Type"] || "recurring").toString().toLowerCase();
            const paymentType = paymentTypeRaw === "upsell" ? "upsell" : "recurring";
            const isTargetRaw = (row["Is Target"] || row["isTarget"] || row["Target"] || "yes").toString().toLowerCase();
            const isTarget = isTargetRaw === "no" || isTargetRaw === "false" || isTargetRaw === "0" ? false : true;
            return {
              projectName: row["Project Name"] || row["projectName"] || row["project"] || "",
              clientName: row["Client Name"] || row["clientName"] || row["client"] || "",
              phaseMilestone: row["Phase/Milestone"] || row["phase"] || row["milestone"] || row["Phase"] || row["Milestone"] || "",
              expectedAmount: row["Expected Amount"] || row["expected"] || row["Expected"] || "0",
              receivedAmount: row["Received Amount"] || row["received"] || row["Received"] || "0",
              status: row["Status"] || row["status"] || "Unpaid",
              paymentType,
              isTarget,
              invoiceDate: row["Invoice Date"] || row["invoiceDate"] || null,
              receivedDate: row["Received Date"] || row["receivedDate"] || null,
              notes: row["Notes"] || row["notes"] || row["Narration"] || "",
            };
          });

          setRawData(rows);
          previewMutation.mutate({ rows, month, year, fileName: file.name });
        },
        error: (error) => {
          toast({
            title: "Error",
            description: `Failed to parse CSV file: ${error.message}`,
            variant: "destructive",
          });
        },
      });
    },
    [month, year, previewMutation, toast]
  );

  const handleRowEdit = (index: number, field: keyof ProcessedRow, value: string | boolean) => {
    setProcessedRows((prev) => {
      const updated = [...prev];
      (updated[index] as any)[field] = value;
      return updated;
    });
  };

  const handleProjectChange = (index: number, projectId: string) => {
    const project = referenceData.find((p) => p.id === projectId);
    if (project) {
      setProcessedRows((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          projectId,
          matchedProjectName: project.name,
          matched: true,
          errors: updated[index].errors.filter((e) => e !== "Project not found in system"),
        };
        return updated;
      });
    }
  };

  const handleMilestoneChange = (index: number, milestoneId: string) => {
    const row = processedRows[index];
    const project = referenceData.find((p) => p.id === row.projectId);
    const milestone = project?.milestones?.find((m) => m.id === milestoneId);
    if (milestone) {
      setProcessedRows((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          milestoneId,
          matchedMilestoneName: milestone.name,
        };
        return updated;
      });
    }
  };

  const openConfirmDialog = () => {
    setConfirmMonth(month);
    setConfirmYear(year);
    setShowConfirmDialog(true);
  };

  const executeImport = () => {
    const rowsToImport = processedRows.map((row) => ({
      projectName: row.projectName,
      clientName: row.clientName,
      phaseMilestone: row.phaseMilestone,
      expectedAmount: row.expectedAmount,
      receivedAmount: row.receivedAmount,
      status: row.status,
      paymentType: row.paymentType,
      isTarget: row.isTarget,
      invoiceDate: row.invoiceDate,
      receivedDate: row.receivedDate,
      notes: row.notes,
      projectId: row.projectId,
      milestoneId: row.milestoneId,
    }));

    setShowConfirmDialog(false);
    previewMutation.mutate({
      rows: rowsToImport,
      month: confirmMonth,
      year: confirmYear,
      fileName,
      confirm: true,
    });
  };

  const undoMutation = useMutation({
    mutationFn: async (token: string) => {
      const response = await apiRequest("POST", "/api/import/undo", { token });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Import Undone",
        description: `Reverted ${data.deleted || 0} payments${data.deletedMilestones ? ` and ${data.deletedMilestones} milestones` : ""}`,
      });
      setUndoCountdown(0);
      setIsUndoing(false);
      setImportResult(null);
      resetImport();
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    },
    onError: () => {
      toast({
        title: "Undo Failed",
        description: "Could not undo the import. The undo window may have expired.",
        variant: "destructive",
      });
      setUndoCountdown(0);
      setIsUndoing(false);
    },
  });

  const handleUndo = () => {
    if (importResult?.undoToken && !isUndoing && undoCountdown > 0) {
      setIsUndoing(true);
      undoMutation.mutate(importResult.undoToken);
    }
  };

  useEffect(() => {
    if (undoCountdown > 0) {
      const timer = setTimeout(() => {
        setUndoCountdown(undoCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [undoCountdown]);

  const resetImport = () => {
    setStep("upload");
    setFileName("");
    setRawData([]);
    setProcessedRows([]);
    setSummary(null);
    setImportResult(null);
    setEditingRow(null);
  };

  const months = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Import Payment Data</h1>
          <p className="text-muted-foreground">Upload your monthly payment data from spreadsheets</p>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className={`flex items-center gap-2 ${step === "upload" ? "text-primary" : "text-muted-foreground"}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === "upload" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            1
          </div>
          <span className="font-medium">Upload</span>
        </div>
        <div className="flex-1 h-0.5 bg-muted" />
        <div className={`flex items-center gap-2 ${step === "preview" ? "text-primary" : "text-muted-foreground"}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === "preview" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            2
          </div>
          <span className="font-medium">Review & Edit</span>
        </div>
        <div className="flex-1 h-0.5 bg-muted" />
        <div className={`flex items-center gap-2 ${step === "complete" ? "text-primary" : "text-muted-foreground"}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === "complete" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            3
          </div>
          <span className="font-medium">Complete</span>
        </div>
      </div>

      {step === "upload" && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Download Template
              </CardTitle>
              <CardDescription>Get the CSV template with your existing projects and milestones</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Month</Label>
                  <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
                    <SelectTrigger data-testid="select-import-month">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((m) => (
                        <SelectItem key={m.value} value={String(m.value)}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Year</Label>
                  <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
                    <SelectTrigger data-testid="select-import-year">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={downloadTemplate} className="w-full" variant="outline" data-testid="button-download-template">
                <Download className="h-4 w-4 mr-2" />
                Download CSV Template
              </Button>
              <p className="text-xs text-muted-foreground">
                The template includes your active projects and their milestones. Fill in the payment amounts and status for
                each row.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Data
              </CardTitle>
              <CardDescription>Upload your completed CSV file with payment data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <div className="space-y-2">
                  <Label htmlFor="file-upload" className="cursor-pointer">
                    <span className="text-primary hover:underline">Click to upload</span> or drag and drop
                  </Label>
                  <p className="text-xs text-muted-foreground">CSV files only</p>
                </div>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileUpload}
                  data-testid="input-file-upload"
                />
              </div>
              {previewMutation.isPending && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Processing file...
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={resetImport} data-testid="button-back-to-upload">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h2 className="font-semibold">
                  Review Import: {months.find((m) => m.value === month)?.label} {year}
                </h2>
                <p className="text-sm text-muted-foreground">{fileName}</p>
              </div>
            </div>
            <Button onClick={openConfirmDialog} disabled={previewMutation.isPending} data-testid="button-confirm-import">
              {previewMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm Import
                </>
              )}
            </Button>
          </div>

          {summary && (
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">{summary.total}</div>
                  <p className="text-sm text-muted-foreground">Total Rows</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-green-600">{summary.matched}</div>
                  <p className="text-sm text-muted-foreground">Matched</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-yellow-600">{summary.unmatched}</div>
                  <p className="text-sm text-muted-foreground">Unmatched</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-red-600">{summary.withErrors}</div>
                  <p className="text-sm text-muted-foreground">With Errors</p>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Phase/Milestone</TableHead>
                      <TableHead className="text-right">Expected</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                      <TableHead>Payment Status</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedRows.map((row, idx) => (
                      <TableRow
                        key={idx}
                        className={row.errors.length > 0 ? "bg-red-50 dark:bg-red-950/20" : row.matched ? "" : "bg-yellow-50 dark:bg-yellow-950/20"}
                      >
                        <TableCell className="font-mono text-sm">{idx + 1}</TableCell>
                        <TableCell>
                          {row.errors.length > 0 ? (
                            <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                              <XCircle className="h-3 w-3" />
                              Error
                            </Badge>
                          ) : row.matched ? (
                            <Badge variant="outline" className="flex items-center gap-1 w-fit text-green-600 border-green-600">
                              <CheckCircle className="h-3 w-3" />
                              Matched
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                              <AlertTriangle className="h-3 w-3" />
                              Review
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingRow === idx ? (
                            <Select value={row.projectId || ""} onValueChange={(v) => handleProjectChange(idx, v)}>
                              <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Select project" />
                              </SelectTrigger>
                              <SelectContent>
                                {referenceData.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div>
                              <div className="font-medium">{row.matchedProjectName || row.projectName}</div>
                              <div className="text-xs text-muted-foreground">{row.clientName}</div>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingRow === idx && row.projectId ? (
                            <Select value={row.milestoneId || ""} onValueChange={(v) => handleMilestoneChange(idx, v)}>
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Select milestone" />
                              </SelectTrigger>
                              <SelectContent>
                                {referenceData
                                  .find((p) => p.id === row.projectId)
                                  ?.milestones?.map((m) => (
                                    <SelectItem key={m.id} value={m.id}>
                                      {m.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span>{row.matchedMilestoneName || row.phaseMilestone}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {editingRow === idx ? (
                            <Input
                              type="text"
                              value={row.expectedAmount}
                              onChange={(e) => handleRowEdit(idx, "expectedAmount", e.target.value)}
                              className="w-24 text-right"
                            />
                          ) : (
                            `$${parseFloat(row.expectedAmount.replace(/[^0-9.-]/g, "") || "0").toLocaleString()}`
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {editingRow === idx ? (
                            <Input
                              type="text"
                              value={row.receivedAmount}
                              onChange={(e) => handleRowEdit(idx, "receivedAmount", e.target.value)}
                              className="w-24 text-right"
                            />
                          ) : (
                            `$${parseFloat(row.receivedAmount.replace(/[^0-9.-]/g, "") || "0").toLocaleString()}`
                          )}
                        </TableCell>
                        <TableCell>
                          {editingRow === idx ? (
                            <Select value={row.status} onValueChange={(v) => handleRowEdit(idx, "status", v)}>
                              <SelectTrigger className="w-[120px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Paid">Paid</SelectItem>
                                <SelectItem value="Invoiced">Invoiced</SelectItem>
                                <SelectItem value="Pending">Pending</SelectItem>
                                <SelectItem value="Unpaid">Unpaid</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge
                              variant={
                                row.status.toLowerCase() === "paid"
                                  ? "default"
                                  : row.status.toLowerCase() === "invoiced"
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {row.status}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingRow === idx ? (
                            <Select value={row.paymentType} onValueChange={(v) => handleRowEdit(idx, "paymentType", v)}>
                              <SelectTrigger className="w-[110px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="recurring">Recurring</SelectItem>
                                <SelectItem value="upsell">Upsell</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant={row.paymentType === "upsell" ? "secondary" : "outline"}>
                              {row.paymentType === "upsell" ? "Upsell" : "Recurring"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingRow === idx ? (
                            <Select value={row.isTarget ? "yes" : "no"} onValueChange={(v) => handleRowEdit(idx, "isTarget", v === "yes")}>
                              <SelectTrigger className="w-[80px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="yes">Yes</SelectItem>
                                <SelectItem value="no">No</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant={row.isTarget ? "default" : "outline"}>
                              {row.isTarget ? "Yes" : "No"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setEditingRow(editingRow === idx ? null : idx)}
                            data-testid={`button-edit-row-${idx}`}
                          >
                            {editingRow === idx ? <Save className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Import</DialogTitle>
            <DialogDescription>
              Review and confirm the import details before proceeding.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Import Month</Label>
                <Select value={String(confirmMonth)} onValueChange={(v) => setConfirmMonth(parseInt(v))}>
                  <SelectTrigger data-testid="select-confirm-month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((m) => (
                      <SelectItem key={m.value} value={String(m.value)}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Import Year</Label>
                <Select value={String(confirmYear)} onValueChange={(v) => setConfirmYear(parseInt(v))}>
                  <SelectTrigger data-testid="select-confirm-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Rows:</span>
                <span className="font-medium">{processedRows.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Matched Projects:</span>
                <span className="font-medium text-green-600">{processedRows.filter(r => r.matched).length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">With Errors:</span>
                <span className="font-medium text-red-600">{processedRows.filter(r => r.errors.length > 0).length}</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Only rows with matched projects and no errors will be imported. You can undo this import within 30 seconds after completion.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)} data-testid="button-cancel-confirm">
              Cancel
            </Button>
            <Button onClick={executeImport} disabled={previewMutation.isPending} data-testid="button-execute-import">
              {previewMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm & Import
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {step === "complete" && importResult && (
        <Card className="max-w-lg mx-auto">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle className="h-16 w-16 mx-auto text-green-600" />
            <div>
              <h2 className="text-xl font-semibold">Import Complete</h2>
              <p className="text-muted-foreground">
                {months.find((m) => m.value === confirmMonth)?.label} {confirmYear}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">{importResult.created}</div>
                <p className="text-sm text-muted-foreground">Created</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{importResult.updated}</div>
                <p className="text-sm text-muted-foreground">Updated</p>
              </div>
            </div>
            {importResult.errors.length > 0 && (
              <div className="text-left bg-red-50 dark:bg-red-950/20 rounded-lg p-4">
                <p className="font-medium text-red-600 mb-2">Errors ({importResult.errors.length})</p>
                <ul className="text-sm text-red-600 space-y-1">
                  {importResult.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {importResult.errors.length > 5 && (
                    <li>...and {importResult.errors.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}
            {undoCountdown > 0 && importResult.undoToken && (
              <Button
                onClick={handleUndo}
                variant="outline"
                className="w-full"
                disabled={undoMutation.isPending}
                data-testid="button-undo-import"
              >
                <Undo2 className="h-4 w-4 mr-2" />
                {undoMutation.isPending ? "Undoing..." : `Undo Import (${undoCountdown}s)`}
              </Button>
            )}
            <Button onClick={resetImport} className="w-full" data-testid="button-import-another">
              <RefreshCw className="h-4 w-4 mr-2" />
              Import Another Month
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
