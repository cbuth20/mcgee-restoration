"use client";

import { useState, useEffect, useRef } from "react";
import { useApi } from "@/lib/hooks";
import {
  getCompanySettings,
  getLeadSources,
  getTradeTypes,
  getWorkTypes,
  getJobCategories,
  ping,
} from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import LoadingSpinner from "@/components/LoadingSpinner";
import { CheckCircle2, XCircle, RefreshCw, Upload, Trash2 } from "lucide-react";

interface RepStageRow {
  rank: number;
  rep: string;
  ivsCount: number;
  adjusterCount: number;
  boughtCount: number;
  designScheduledCount: number;
  designCompletedCount: number;
  approvedCount: number;
  salesYTD: number;
  total: number;
}

interface RepStageCSVData {
  rows: RepStageRow[];
  uploadedAt: string;
  fileName: string;
}

const REP_STAGE_CSV_KEY = "rep-stage-csv-data";

function parseRepStageCSV(text: string): RepStageRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Skip header row
  const dataLines = lines.slice(1);
  const rows: RepStageRow[] = dataLines.map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const ivsCount = parseFloat(cols[1]) || 0;
    const adjusterCount = parseFloat(cols[2]) || 0;
    const boughtCount = parseFloat(cols[3]) || 0;
    const designScheduledCount = parseFloat(cols[4]) || 0;
    const designCompletedCount = parseFloat(cols[5]) || 0;
    const approvedCount = parseFloat(cols[6]) || 0;
    const salesYTD = parseFloat(cols[7]) || 0;
    return {
      rank: 0,
      rep: cols[0] || "",
      ivsCount,
      adjusterCount,
      boughtCount,
      designScheduledCount,
      designCompletedCount,
      approvedCount,
      salesYTD,
      total: ivsCount + adjusterCount + boughtCount + designScheduledCount + designCompletedCount + approvedCount,
    };
  }).filter((r) => r.rep);

  // Rank by Sales YTD descending
  rows.sort((a, b) => b.salesYTD - a.salesYTD || a.rep.localeCompare(b.rep));
  rows.forEach((r, i) => { r.rank = i + 1; });

  return rows;
}

export default function SettingsPage() {
  const { data: pingData, loading: pingLoading, error: pingError, refetch: refetchPing } = useApi(
    () => ping(),
    []
  );
  const { data: companyData, loading: companyLoading } = useApi(
    () => getCompanySettings(),
    []
  );
  const { data: leadSourcesData, loading: lsLoading } = useApi(
    () => getLeadSources(),
    []
  );
  const { data: tradeTypesData, loading: ttLoading } = useApi(
    () => getTradeTypes(),
    []
  );
  const { data: workTypesData, loading: wtLoading } = useApi(
    () => getWorkTypes(),
    []
  );
  const { data: jobCategoriesData, loading: jcLoading } = useApi(
    () => getJobCategories(),
    []
  );

  // CSV upload state
  const [csvData, setCsvData] = useState<RepStageCSVData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(REP_STAGE_CSV_KEY);
      if (raw) setCsvData(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const rows = parseRepStageCSV(text);
      if (rows.length === 0) return;
      const data: RepStageCSVData = {
        rows,
        uploadedAt: new Date().toISOString(),
        fileName: file.name,
      };
      localStorage.setItem(REP_STAGE_CSV_KEY, JSON.stringify(data));
      setCsvData(data);
    };
    reader.readAsText(file);
    // Reset input so the same file can be re-uploaded
    e.target.value = "";
  };

  const clearCSV = () => {
    localStorage.removeItem(REP_STAGE_CSV_KEY);
    setCsvData(null);
  };

  const isLoading = companyLoading || lsLoading || ttLoading || wtLoading || jcLoading;

  const leadSources: any[] = leadSourcesData?.items || (Array.isArray(leadSourcesData) ? leadSourcesData : []);
  const tradeTypes: any[] = tradeTypesData?.items || (Array.isArray(tradeTypesData) ? tradeTypesData : []);
  const workTypes: any[] = workTypesData?.items || (Array.isArray(workTypesData) ? workTypesData : []);
  const jobCategories: any[] = jobCategoriesData?.items || (Array.isArray(jobCategoriesData) ? jobCategoriesData : []);

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="API connection status and AccuLynx configuration"
      />

      {/* API Status */}
      <Card title="API Connection" subtitle="AccuLynx API connectivity status" className="mb-6">
        <div className="flex items-center gap-3">
          {pingLoading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
          ) : pingError ? (
            <XCircle className="h-5 w-5 text-red-500" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          )}
          <div>
            <p className="text-sm font-medium text-gray-900">
              {pingLoading ? "Checking connection..." : pingError ? "Connection Issue" : "Connected"}
            </p>
            <p className="text-xs text-gray-500">
              {pingError
                ? "Note: /ping may not be available but other endpoints work"
                : "AccuLynx API is reachable and authenticated"}
            </p>
          </div>
          <button
            onClick={refetchPing}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            <RefreshCw className="h-3 w-3" />
            Test
          </button>
        </div>
      </Card>

      {/* CSV Upload for Rep Stage Data */}
      <Card title="Rep Stage Data Upload" subtitle="Upload a CSV to override the Sales Rep Performance table" className="mb-6">
        {csvData ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="text-sm font-medium text-gray-900">CSV Loaded</p>
                <p className="text-xs text-gray-500">
                  {csvData.rows.length} rep{csvData.rows.length !== 1 ? "s" : ""} from{" "}
                  <span className="font-medium">{csvData.fileName}</span>
                  {" "}— uploaded {new Date(csvData.uploadedAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={clearCSV}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3 w-3" />
                Clear
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Expected columns: <span className="font-medium">Rep, IVS, Adjuster, Bought, Design Sched, Design Comp, Approved, Sales YTD</span>
            </p>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Upload className="h-4 w-4" />
                Choose CSV File
              </button>
            </div>
          </div>
        )}
      </Card>

      {isLoading && <LoadingSpinner message="Loading configuration..." />}

      {!isLoading && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Company Info */}
          {companyData && typeof companyData === "object" && (
            <Card title="Company Settings" subtitle="Your AccuLynx configuration">
              <div className="space-y-3">
                {Object.entries(companyData as Record<string, unknown>)
                  .filter(([k, v]) => (typeof v === "string" || typeof v === "number" || typeof v === "boolean") && k !== "_link")
                  .slice(0, 12)
                  .map(([key, value]) => (
                    <div key={key} className="flex justify-between border-b border-gray-50 pb-2">
                      <span className="text-sm text-gray-500 capitalize">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </span>
                      <span className="text-sm font-medium text-gray-900">{String(value)}</span>
                    </div>
                  ))}
              </div>
            </Card>
          )}

          {/* Lead Sources */}
          <Card title="Lead Sources" subtitle={`${leadSources.length} active sources`}>
            <div className="flex flex-wrap gap-2">
              {leadSources.map((ls: any, i: number) => (
                <span
                  key={ls.id || i}
                  className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                >
                  {ls.name || String(ls)}
                </span>
              ))}
              {leadSources.length === 0 && (
                <p className="text-sm text-gray-400">No lead sources configured</p>
              )}
            </div>
          </Card>

          {/* Trade Types */}
          <Card title="Trade Types" subtitle={`${tradeTypes.length} types`}>
            <div className="flex flex-wrap gap-2">
              {tradeTypes.map((tt: any, i: number) => (
                <span
                  key={tt.id || i}
                  className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
                >
                  {tt.name || String(tt)}
                </span>
              ))}
              {tradeTypes.length === 0 && (
                <p className="text-sm text-gray-400">No trade types configured</p>
              )}
            </div>
          </Card>

          {/* Work Types */}
          <Card title="Work Types" subtitle={`${workTypes.length} types`}>
            <div className="flex flex-wrap gap-2">
              {workTypes.map((wt: any, i: number) => (
                <span
                  key={wt.id || i}
                  className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700"
                >
                  {wt.name || String(wt)}
                </span>
              ))}
              {workTypes.length === 0 && (
                <p className="text-sm text-gray-400">No work types configured</p>
              )}
            </div>
          </Card>

          {/* Job Categories */}
          <Card title="Job Categories" subtitle={`${jobCategories.length} categories`} className="lg:col-span-2">
            <div className="flex flex-wrap gap-2">
              {jobCategories.map((jc: any, i: number) => (
                <span
                  key={jc.id || i}
                  className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700"
                >
                  {jc.name || String(jc)}
                </span>
              ))}
              {jobCategories.length === 0 && (
                <p className="text-sm text-gray-400">No job categories configured</p>
              )}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
