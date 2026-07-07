import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileWarning, CheckCircle2, AlertCircle, Loader2, Download, Plus, FolderPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { regions, type User } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type UnmatchedProject = {
  name: string;
  clientName: string;
  region: string;
  totalCost: number;
  affectedRows: number;
};

type ProjectToCreate = {
  name: string;
  clientName: string;
  region: string;
  totalCost: string;
  pmId?: string;
  affectedRows: number;
};

type ValidationResult = {
  totalRows: number;
  validRows: number;
  errorCount: number;
  errors: { row: number; field: string; message: string }[];
  preview: {
    projectId: string;
    projectName: string;
    clientName: string;
    region: string;
    expectedAmount: number;
    totalAmount: number;
    receivedAmount: number;
    paymentType: string;
    status: string;
    narration: string;
    month: number;
    year: number;
    isTarget: boolean;
    hasErrors: boolean;
  }[];
  unmatchedProjects: UnmatchedProject[];
};

type ImportResult = {
  success: boolean;
  created: number;
  failed: number;
  failedDetails: { index: number; error: string }[];
};

interface PaymentImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PaymentImportModal({ open, onOpenChange }: PaymentImportModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "create_projects" | "preview" | "result">("upload");
  const [csvContent, setCsvContent] = useState<string>("");
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [projectsToCreate, setProjectsToCreate] = useState<ProjectToCreate[]>([]);

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const validateMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest("POST", "/api/payments/import/validate", { csvContent: content });
      return response.json() as Promise<ValidationResult>;
    },
    onSuccess: (data) => {
      setValidationResult(data);
      if (data.unmatchedProjects && data.unmatchedProjects.length > 0) {
        setProjectsToCreate(data.unmatchedProjects.map(p => ({
          name: p.name,
          clientName: p.clientName || "",
          region: p.region || "",
          totalCost: String(p.totalCost || 0),
          pmId: undefined,
          affectedRows: p.affectedRows
        })));
        setStep("create_projects");
      } else {
        setStep("preview");
      }
    },
    onError: (error: any) => {
      toast({
        title: "Validation Failed",
        description: error.message || "Failed to validate CSV file",
        variant: "destructive",
      });
    },
  });

  const createProjectsMutation = useMutation({
    mutationFn: async (projects: ProjectToCreate[]) => {
      const createdProjects = [];
      for (const project of projects) {
        const response = await apiRequest("POST", "/api/projects", {
          name: project.name,
          clientName: project.clientName,
          region: project.region as "CA" | "TX" | "AE",
          totalCost: String(parseFloat(project.totalCost) || 0),
          pmId: project.pmId || null
        });
        const created = await response.json();
        createdProjects.push(created);
      }
      return createdProjects;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Projects Created",
        description: `Successfully created ${projectsToCreate.length} project(s). Re-validating import...`,
      });
      validateMutation.mutate(csvContent);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Create Projects",
        description: error.message || "Failed to create one or more projects",
        variant: "destructive",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (payments: ValidationResult["preview"]) => {
      const validPayments = payments
        .filter(p => !p.hasErrors)
        .map(p => ({
          ...p,
          expectedAmount: String(p.expectedAmount),
          totalAmount: String(p.totalAmount),
          receivedAmount: String(p.receivedAmount || 0),
        }));
      const response = await apiRequest("POST", "/api/payments/import", { payments: validPayments });
      return response.json() as Promise<ImportResult>;
    },
    onSuccess: (data) => {
      setImportResult(data);
      setStep("result");
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/summary"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-margin/hourly-buckets"], exact: false });
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import payments",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast({
        title: "Invalid File",
        description: "Please select a CSV file",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);
      validateMutation.mutate(content);
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith(".csv")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setCsvContent(content);
        validateMutation.mutate(content);
      };
      reader.readAsText(file);
    } else {
      toast({
        title: "Invalid File",
        description: "Please drop a CSV file",
        variant: "destructive",
      });
    }
  };

  const handleImport = () => {
    if (validationResult?.preview) {
      importMutation.mutate(validationResult.preview);
    }
  };

  const handleCreateProjects = () => {
    const validRegions = ["CA", "TX", "AE"];
    const incompleteProjects = projectsToCreate.filter(p => !p.clientName.trim() || !p.region || !validRegions.includes(p.region));
    if (incompleteProjects.length > 0) {
      toast({
        title: "Incomplete Project Data",
        description: "Please fill in Client Name and select a valid Region (CA, TX, or AE) for each project.",
        variant: "destructive",
      });
      return;
    }
    // Ensure totalCost has a valid number (default to 0 if empty)
    const projectsWithValidCost = projectsToCreate.map(p => ({
      ...p,
      totalCost: p.totalCost.trim() === "" ? "0" : p.totalCost
    }));
    createProjectsMutation.mutate(projectsWithValidCost);
  };

  const handleSkipProjects = () => {
    setStep("preview");
  };

  const updateProject = (index: number, field: keyof ProjectToCreate, value: string) => {
    setProjectsToCreate(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleClose = () => {
    setStep("upload");
    setCsvContent("");
    setValidationResult(null);
    setImportResult(null);
    setProjectsToCreate([]);
    onOpenChange(false);
  };

  const downloadTemplate = () => {
    const templateHeaders = [
      "projectId",
      "projectName",
      "clientName",
      "region",
      "expectedAmount",
      "totalAmount",
      "receivedAmount",
      "paymentType",
      "status",
      "narration",
      "invoiceDate",
      "dueDate",
      "receivedDate",
      "month",
      "year",
      "isTarget"
    ];
    const templateRow = [
      "",
      "Example Project",
      "Example Client",
      "CA",
      "1000",
      "1000",
      "0",
      "recurring",
      "pending_invoice",
      "Payment description",
      "2024-12-01",
      "2024-12-15",
      "",
      "12",
      "2024",
      "true"
    ];
    const csv = [templateHeaders.join(","), templateRow.join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "payment-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === "upload" && "Import Payments from CSV"}
            {step === "create_projects" && "Create Missing Projects"}
            {step === "preview" && "Preview Import Data"}
            {step === "result" && "Import Complete"}
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Upload a CSV file containing payment data to import."}
            {step === "create_projects" && "The following projects from your CSV don't exist yet. Fill in the required details to create them."}
            {step === "preview" && "Review the data before importing. Rows with errors will be skipped."}
            {step === "result" && "See the results of your import below."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {step === "upload" && (
            <div className="space-y-4">
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center hover-elevate cursor-pointer transition-colors"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                data-testid="dropzone-csv"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  data-testid="input-csv-file"
                />
                {validateMutation.isPending ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-10 w-10 text-muted-foreground animate-spin" />
                    <p className="text-sm text-muted-foreground">Validating CSV...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-10 w-10 text-muted-foreground" />
                    <p className="text-sm font-medium">Click to upload or drag and drop</p>
                    <p className="text-xs text-muted-foreground">CSV files only</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-4 flex-wrap">
                <p className="text-sm text-muted-foreground">
                  Need a template? Download one to see the expected format.
                </p>
                <Button variant="outline" size="sm" onClick={downloadTemplate} data-testid="button-download-template">
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>

              <Alert>
                <FileWarning className="h-4 w-4" />
                <AlertTitle>CSV Format Requirements</AlertTitle>
                <AlertDescription className="text-xs space-y-1">
                  <p>Required columns: projectId or projectName, expectedAmount, totalAmount, paymentType, status, month, year</p>
                  <p>Optional columns: clientName, region (used when creating new projects)</p>
                  <p>Payment types: recurring, upsell</p>
                  <p>Statuses: not_targeting, pending_invoice, invoiced, received</p>
                  <p>Dates should be in YYYY-MM-DD format</p>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {step === "create_projects" && (
            <div className="space-y-4">
              <Alert>
                <FolderPlus className="h-4 w-4" />
                <AlertTitle>Missing Projects Found</AlertTitle>
                <AlertDescription>
                  {projectsToCreate.length} project(s) from your CSV don't exist in the system. 
                  Fill in the required details below to create them, or skip to continue with only matched projects.
                </AlertDescription>
              </Alert>

              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {projectsToCreate.map((project, index) => (
                    <Card key={index}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center justify-between gap-2 flex-wrap">
                          <span className="flex items-center gap-2">
                            <FolderPlus className="h-4 w-4" />
                            {project.name}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {project.affectedRows} payment row(s)
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor={`client-${index}`} className="text-xs">
                              Client Name <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              id={`client-${index}`}
                              value={project.clientName}
                              onChange={(e) => updateProject(index, "clientName", e.target.value)}
                              placeholder="Enter client name"
                              data-testid={`input-client-name-${index}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`region-${index}`} className="text-xs">
                              Region <span className="text-destructive">*</span>
                            </Label>
                            <Select
                              value={project.region}
                              onValueChange={(value) => updateProject(index, "region", value)}
                            >
                              <SelectTrigger id={`region-${index}`} data-testid={`select-region-${index}`}>
                                <SelectValue placeholder="Select region" />
                              </SelectTrigger>
                              <SelectContent>
                                {regions.map((r) => (
                                  <SelectItem key={r} value={r}>{r}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`cost-${index}`} className="text-xs">
                              Total Cost <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              id={`cost-${index}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={project.totalCost}
                              onChange={(e) => updateProject(index, "totalCost", e.target.value)}
                              placeholder="0.00"
                              data-testid={`input-total-cost-${index}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`pm-${index}`} className="text-xs">
                              Project Manager
                            </Label>
                            <Select
                              value={project.pmId || ""}
                              onValueChange={(value) => updateProject(index, "pmId", value)}
                            >
                              <SelectTrigger id={`pm-${index}`} data-testid={`select-pm-${index}`}>
                                <SelectValue placeholder="Select PM (optional)" />
                              </SelectTrigger>
                              <SelectContent>
                                {users.map((user) => (
                                  <SelectItem key={user.id} value={user.id}>
                                    {user.firstName && user.lastName 
                                      ? `${user.firstName} ${user.lastName}`
                                      : user.email}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {step === "preview" && validationResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  Total Rows: {validationResult.totalRows}
                </Badge>
                <Badge variant="default" className="text-xs">
                  Valid: {validationResult.validRows}
                </Badge>
                {validationResult.errorCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    Errors: {validationResult.errorCount}
                  </Badge>
                )}
              </div>

              {validationResult.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Validation Errors</AlertTitle>
                  <AlertDescription>
                    <ScrollArea className="h-20 mt-2">
                      <ul className="text-xs space-y-1">
                        {validationResult.errors.slice(0, 10).map((err, i) => (
                          <li key={i}>
                            Row {err.row}: {err.field} - {err.message}
                          </li>
                        ))}
                        {validationResult.errors.length > 10 && (
                          <li>...and {validationResult.errors.length - 10} more errors</li>
                        )}
                      </ul>
                    </ScrollArea>
                  </AlertDescription>
                </Alert>
              )}

              <ScrollArea className="h-[300px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Expected</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Month/Year</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validationResult.preview.map((row, i) => (
                      <TableRow
                        key={i}
                        className={row.hasErrors ? "bg-destructive/10" : ""}
                        data-testid={`row-preview-${i}`}
                      >
                        <TableCell>
                          {row.hasErrors ? (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{row.projectName || row.projectId}</TableCell>
                        <TableCell className="capitalize">{row.paymentType}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.expectedAmount)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.totalAmount)}</TableCell>
                        <TableCell className="capitalize">{row.status.replace(/_/g, " ")}</TableCell>
                        <TableCell>{row.month}/{row.year}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          {step === "result" && importResult && (
            <div className="space-y-4">
              <Alert variant={importResult.failed === 0 ? "default" : "destructive"}>
                {importResult.failed === 0 ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertTitle>Import Summary</AlertTitle>
                <AlertDescription>
                  <p>Successfully imported {importResult.created} payment(s).</p>
                  {importResult.failed > 0 && (
                    <p>{importResult.failed} payment(s) failed to import.</p>
                  )}
                </AlertDescription>
              </Alert>

              {importResult.failedDetails.length > 0 && (
                <ScrollArea className="h-32 border rounded-md p-3">
                  <p className="text-sm font-medium mb-2">Failed Items:</p>
                  <ul className="text-xs space-y-1">
                    {importResult.failedDetails.map((item, i) => (
                      <li key={i} className="text-destructive">
                        Row {item.index + 1}: {item.error}
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}
          {step === "create_projects" && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setStep("upload");
                  setCsvContent("");
                  setValidationResult(null);
                  setProjectsToCreate([]);
                }}
              >
                Back
              </Button>
              <Button
                variant="ghost"
                onClick={handleSkipProjects}
              >
                Skip (import matched only)
              </Button>
              <Button
                onClick={handleCreateProjects}
                disabled={createProjectsMutation.isPending || validateMutation.isPending}
                data-testid="button-create-projects"
              >
                {(createProjectsMutation.isPending || validateMutation.isPending) ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Projects...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create {projectsToCreate.length} Project(s) & Continue
                  </>
                )}
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setStep("upload");
                  setCsvContent("");
                  setValidationResult(null);
                }}
              >
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={validationResult?.validRows === 0 || importMutation.isPending}
                data-testid="button-confirm-import"
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>Import {validationResult?.validRows} Payment(s)</>
                )}
              </Button>
            </>
          )}
          {step === "result" && (
            <Button onClick={handleClose} data-testid="button-close-import">
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
