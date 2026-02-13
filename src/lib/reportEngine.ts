import { getJobs, getContacts, getUsers, getJobFinancials } from "./api";

// --- Types ---

export type DataSource = "jobs" | "contacts" | "users";
export type ChartType = "bar" | "pie" | "line" | "table";

export interface Dimension {
  key: string;
  label: string;
  dataSource: DataSource;
  extractor: (record: any) => string;
  isTimeBased?: boolean;
}

export interface Metric {
  key: string;
  label: string;
  calculate: (group: any[]) => number;
  format: (n: number) => string;
  requiresFinancials?: boolean;
}

export interface ReportFilter {
  dateFrom?: string;
  dateTo?: string;
  valueFilter?: string;
}

export interface ReportResult {
  label: string;
  value: number;
  formattedValue: string;
  percentage: number;
  count: number;
}

export interface ReportConfig {
  dataSource: DataSource;
  dimensionKey: string;
  metricKey: string;
  chartType: ChartType;
  filters: ReportFilter;
}

// --- Dimension Registry ---

export const dimensions: Dimension[] = [
  // Jobs
  {
    key: "milestone",
    label: "Milestone",
    dataSource: "jobs",
    extractor: (r) => r.currentMilestone || "Unknown",
  },
  {
    key: "tradeType",
    label: "Trade Type",
    dataSource: "jobs",
    extractor: (r) => r.tradeType?.name || "Unknown",
  },
  {
    key: "workType",
    label: "Work Type",
    dataSource: "jobs",
    extractor: (r) => r.workType?.name || "Unknown",
  },
  {
    key: "leadSource",
    label: "Lead Source",
    dataSource: "jobs",
    extractor: (r) => r.leadSource?.name || "Unknown",
  },
  {
    key: "jobCity",
    label: "City",
    dataSource: "jobs",
    extractor: (r) => r.locationAddress?.city || "Unknown",
  },
  {
    key: "jobState",
    label: "State",
    dataSource: "jobs",
    extractor: (r) => r.locationAddress?.state?.abbreviation || "Unknown",
  },
  {
    key: "category",
    label: "Category",
    dataSource: "jobs",
    extractor: (r) => r.jobCategory?.name || "Unknown",
  },
  {
    key: "priority",
    label: "Priority",
    dataSource: "jobs",
    extractor: (r) => r.priority || "Unknown",
  },
  {
    key: "monthCreated",
    label: "Month Created",
    dataSource: "jobs",
    isTimeBased: true,
    extractor: (r) => {
      if (!r.createdDate) return "Unknown";
      const d = new Date(r.createdDate);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    },
  },
  {
    key: "yearCreated",
    label: "Year Created",
    dataSource: "jobs",
    isTimeBased: true,
    extractor: (r) => {
      if (!r.createdDate) return "Unknown";
      return String(new Date(r.createdDate).getFullYear());
    },
  },

  // Contacts
  {
    key: "contactCity",
    label: "City",
    dataSource: "contacts",
    extractor: (r) => r.address?.city || "Unknown",
  },
  {
    key: "contactState",
    label: "State",
    dataSource: "contacts",
    extractor: (r) => r.address?.state?.abbreviation || r.address?.state || "Unknown",
  },
  {
    key: "hasEmail",
    label: "Has Email",
    dataSource: "contacts",
    extractor: (r) =>
      r.emailAddresses && r.emailAddresses.length > 0 ? "Yes" : "No",
  },
  {
    key: "hasPhone",
    label: "Has Phone",
    dataSource: "contacts",
    extractor: (r) =>
      r.phoneNumbers && r.phoneNumbers.length > 0 ? "Yes" : "No",
  },

  // Users
  {
    key: "userRole",
    label: "Role",
    dataSource: "users",
    extractor: (r) => r.role?.name || "Unknown",
  },
  {
    key: "userStatus",
    label: "Status",
    dataSource: "users",
    extractor: (r) => r.status || "Unknown",
  },
];

// --- Metric Registry ---

export const metrics: Metric[] = [
  {
    key: "count",
    label: "Count",
    calculate: (group) => group.length,
    format: (n) => n.toLocaleString(),
  },
  {
    key: "sumContractValue",
    label: "Sum Contract Value",
    requiresFinancials: true,
    calculate: (group) =>
      group.reduce((sum, r) => sum + (r._financials?.contractAmount || 0), 0),
    format: (n) =>
      n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
  },
  {
    key: "avgContractValue",
    label: "Avg Contract Value",
    requiresFinancials: true,
    calculate: (group) => {
      if (group.length === 0) return 0;
      const sum = group.reduce(
        (s, r) => s + (r._financials?.contractAmount || 0),
        0
      );
      return sum / group.length;
    },
    format: (n) =>
      n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
  },
  {
    key: "sumBalanceDue",
    label: "Sum Balance Due",
    requiresFinancials: true,
    calculate: (group) =>
      group.reduce((sum, r) => sum + (r._financials?.balanceDue || 0), 0),
    format: (n) =>
      n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
  },
];

// --- Helpers ---

export function getDimensionsForSource(source: DataSource): Dimension[] {
  return dimensions.filter((d) => d.dataSource === source);
}

export function getMetricsForSource(source: DataSource): Metric[] {
  // Financial metrics only available for jobs
  if (source !== "jobs") {
    return metrics.filter((m) => !m.requiresFinancials);
  }
  return metrics;
}

// --- Fetch batched financials ---

async function fetchFinancialsBatched(
  jobs: any[],
  onProgress?: (loaded: number, total: number) => void
): Promise<void> {
  const BATCH_SIZE = 5;
  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((job) => getJobFinancials(job.id))
    );
    results.forEach((result, idx) => {
      if (result.status === "fulfilled") {
        batch[idx]._financials = result.value;
      } else {
        batch[idx]._financials = {};
      }
    });
    onProgress?.(Math.min(i + BATCH_SIZE, jobs.length), jobs.length);
  }
}

// --- Core Aggregation ---

export async function aggregateReport(
  config: ReportConfig,
  onProgress?: (loaded: number, total: number) => void
): Promise<ReportResult[]> {
  const { dataSource, dimensionKey, metricKey, filters } = config;

  // 1. Fetch raw data
  let records: any[];
  switch (dataSource) {
    case "jobs": {
      const result = await getJobs({ maxItems: "500" });
      records = result.items;
      break;
    }
    case "contacts": {
      const result = await getContacts({ maxItems: "500" });
      records = result.items;
      break;
    }
    case "users": {
      const result = await getUsers();
      records = result.items;
      break;
    }
  }

  // 2. Apply date filter (on createdDate if available)
  if (filters.dateFrom || filters.dateTo) {
    const from = filters.dateFrom ? new Date(filters.dateFrom).getTime() : 0;
    const to = filters.dateTo
      ? new Date(filters.dateTo).getTime() + 86400000
      : Infinity;
    records = records.filter((r) => {
      const created = r.createdDate ? new Date(r.createdDate).getTime() : null;
      if (created === null) return true;
      return created >= from && created < to;
    });
  }

  // 3. Find dimension
  const dimension = dimensions.find((d) => d.key === dimensionKey);
  if (!dimension) throw new Error(`Unknown dimension: ${dimensionKey}`);

  // 4. Apply value filter on dimension field
  if (filters.valueFilter) {
    const filterLower = filters.valueFilter.toLowerCase();
    records = records.filter((r) =>
      dimension.extractor(r).toLowerCase().includes(filterLower)
    );
  }

  // 5. Fetch financials if needed
  const metric = metrics.find((m) => m.key === metricKey);
  if (!metric) throw new Error(`Unknown metric: ${metricKey}`);

  if (metric.requiresFinancials && dataSource === "jobs") {
    await fetchFinancialsBatched(records, onProgress);
  }

  // 6. Group by dimension
  const groups: Record<string, any[]> = {};
  for (const record of records) {
    const key = dimension.extractor(record);
    if (!groups[key]) groups[key] = [];
    groups[key].push(record);
  }

  // 7. Calculate metric per group
  const results: ReportResult[] = Object.entries(groups).map(
    ([label, group]) => {
      const value = metric.calculate(group);
      return {
        label,
        value,
        formattedValue: metric.format(value),
        percentage: 0,
        count: group.length,
      };
    }
  );

  // 8. Sort descending by value
  results.sort((a, b) => b.value - a.value);

  // 9. Compute percentages
  const total = results.reduce((sum, r) => sum + r.value, 0);
  if (total > 0) {
    for (const r of results) {
      r.percentage = Math.round((r.value / total) * 1000) / 10;
    }
  }

  return results;
}
