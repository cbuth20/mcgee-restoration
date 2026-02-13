"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import DataTable from "@/components/DataTable";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import ReportBarChart from "@/components/charts/ReportBarChart";
import ReportPieChart from "@/components/charts/ReportPieChart";
import ReportLineChart from "@/components/charts/ReportLineChart";
import {
  type DataSource,
  type ChartType,
  type ReportConfig,
  type ReportResult,
  getDimensionsForSource,
  getMetricsForSource,
  dimensions,
  metrics,
  aggregateReport,
} from "@/lib/reportEngine";
import {
  Download,
  Play,
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  Table,
  AlertTriangle,
} from "lucide-react";

const DATA_SOURCES: { key: DataSource; label: string }[] = [
  { key: "jobs", label: "Jobs" },
  { key: "contacts", label: "Contacts" },
  { key: "users", label: "Users" },
];

const CHART_TYPES: { key: ChartType; label: string; icon: typeof BarChart3 }[] = [
  { key: "bar", label: "Bar", icon: BarChart3 },
  { key: "pie", label: "Pie", icon: PieChartIcon },
  { key: "line", label: "Line", icon: TrendingUp },
  { key: "table", label: "Table", icon: Table },
];

export default function BuilderPage() {
  // Config state
  const [dataSource, setDataSource] = useState<DataSource>("jobs");
  const [dimensionKey, setDimensionKey] = useState("milestone");
  const [metricKey, setMetricKey] = useState("count");
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [valueFilter, setValueFilter] = useState("");

  // Result state
  const [results, setResults] = useState<ReportResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  // Track if we've ever run
  const hasRun = useRef(false);

  // Derived
  const availableDimensions = getDimensionsForSource(dataSource);
  const availableMetrics = getMetricsForSource(dataSource);
  const selectedMetric = metrics.find((m) => m.key === metricKey);
  const selectedDimension = dimensions.find((d) => d.key === dimensionKey);
  const isFinancialMetric = selectedMetric?.requiresFinancials ?? false;

  // When data source changes, reset dimension and metric to first available
  useEffect(() => {
    const dims = getDimensionsForSource(dataSource);
    const mets = getMetricsForSource(dataSource);
    if (dims.length > 0) setDimensionKey(dims[0].key);
    if (mets.length > 0) setMetricKey(mets[0].key);
  }, [dataSource]);

  const runReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    setProgress(null);
    hasRun.current = true;

    const config: ReportConfig = {
      dataSource,
      dimensionKey,
      metricKey,
      chartType,
      filters: {
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        valueFilter: valueFilter || undefined,
      },
    };

    try {
      const data = await aggregateReport(config, (loaded, total) => {
        setProgress(`Loading financials: ${loaded}/${total} jobs`);
      });
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [dataSource, dimensionKey, metricKey, chartType, dateFrom, dateTo, valueFilter]);

  // Auto-run on first mount with default config
  useEffect(() => {
    if (!hasRun.current) {
      runReport();
    }
  }, [runReport]);

  const exportCsv = () => {
    if (!results) return;
    const dimLabel = selectedDimension?.label || "Dimension";
    const metLabel = selectedMetric?.label || "Value";
    const headers = [dimLabel, metLabel, "Percentage"];
    const rows = results.map((r) => [
      `"${r.label}"`,
      r.formattedValue,
      `${r.percentage}%`,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mcgee-report-${dataSource}-${dimensionKey}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderChart = () => {
    if (!results) return null;
    if (results.length === 0) {
      return (
        <div className="py-12 text-center text-sm text-gray-500">
          No data matches the current filters.
        </div>
      );
    }

    switch (chartType) {
      case "bar":
        return <ReportBarChart data={results} />;
      case "pie":
        return <ReportPieChart data={results} />;
      case "line":
        return <ReportLineChart data={results} />;
      case "table":
        return (
          <DataTable
            columns={[
              {
                key: "label",
                label: selectedDimension?.label || "Dimension",
                sortable: true,
                render: (item: ReportResult) => (
                  <span className="font-medium">{item.label}</span>
                ),
              },
              {
                key: "formattedValue",
                label: selectedMetric?.label || "Value",
                sortable: true,
              },
              {
                key: "count",
                label: "Count",
                sortable: true,
              },
              {
                key: "percentage",
                label: "Share",
                sortable: true,
                render: (item: ReportResult) => (
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                    <span className="text-sm">{item.percentage}%</span>
                  </div>
                ),
              },
            ]}
            data={results}
            searchable
            searchKeys={["label"]}
            emptyMessage="No data available"
          />
        );
    }
  };

  return (
    <>
      <PageHeader
        title="Report Builder"
        subtitle="Build custom reports from your AccuLynx data"
        actions={
          <div className="flex items-center gap-2">
            {results && (
              <button
                onClick={exportCsv}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            )}
            <button
              onClick={runReport}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              Run Report
            </button>
          </div>
        }
      />

      {/* Config Panel */}
      <Card title="Configuration" className="mb-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Data Source */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">
              Data Source
            </label>
            <div className="flex gap-1">
              {DATA_SOURCES.map((src) => (
                <button
                  key={src.key}
                  onClick={() => setDataSource(src.key)}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                    dataSource === src.key
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {src.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dimension */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">
              Dimension
            </label>
            <select
              value={dimensionKey}
              onChange={(e) => setDimensionKey(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 transition-colors focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              {availableDimensions.map((dim) => (
                <option key={dim.key} value={dim.key}>
                  {dim.label}
                </option>
              ))}
            </select>
          </div>

          {/* Metric */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">
              Metric
            </label>
            <select
              value={metricKey}
              onChange={(e) => setMetricKey(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 transition-colors focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              {availableMetrics.map((met) => (
                <option key={met.key} value={met.key}>
                  {met.label}
                  {met.requiresFinancials ? " (slow)" : ""}
                </option>
              ))}
            </select>
            {isFinancialMetric && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Requires per-job API calls — may take 20-60s</span>
              </div>
            )}
          </div>

          {/* Chart Type */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">
              Chart Type
            </label>
            <div className="flex gap-1">
              {CHART_TYPES.map((ct) => (
                <button
                  key={ct.key}
                  onClick={() => setChartType(ct.key)}
                  className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg px-2 py-2 text-xs font-medium transition-all ${
                    chartType === ct.key
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <ct.icon className="h-4 w-4" />
                  {ct.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 border-t border-gray-100 pt-4">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">
            Filters
          </label>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1 block text-xs text-gray-500">
                Date From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 transition-colors focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">
                Date To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 transition-colors focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">
                Value Contains
              </label>
              <input
                type="text"
                value={valueFilter}
                onChange={(e) => setValueFilter(e.target.value)}
                placeholder="Filter dimension values..."
                className="w-56 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            {(dateFrom || dateTo || valueFilter) && (
              <button
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                  setValueFilter("");
                }}
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Results */}
      {loading && (
        <LoadingSpinner
          message={progress || "Running report..."}
        />
      )}
      {error && !loading && (
        <ErrorMessage message={error} onRetry={runReport} />
      )}
      {!loading && !error && results && (
        <Card
          title={`${selectedDimension?.label || "Report"} by ${selectedMetric?.label || "Value"}`}
          subtitle={`${results.length} groups from ${dataSource} data`}
        >
          {renderChart()}
        </Card>
      )}
    </>
  );
}
