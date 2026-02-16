import {
  getJobs,
  getJobCurrentMilestoneWithStatus,
  getJobRepresentatives,
  getJobFinancials,
  getFinancialById,
  getJobInvoices,
  getUsers,
} from "./api";

// ── Stage Definitions ──────────────────────────────────────────────

export type StageName =
  | "Initial Visit Scheduled"
  | "Adjuster Meeting Scheduled"
  | "Bought Job"
  | "Scheduled Design Meeting"
  | "Completed Design Meeting"
  | "Approved";

export type MilestoneCategory = "LEAD" | "PROSPECT" | "APPROVED" | "COMPLETED" | "INVOICED" | "CLOSED";

export interface StageDefinition {
  name: StageName;
  milestone: MilestoneCategory;
  statusMatch: string | null; // null = any status (used for APPROVED)
  order: number;
}

export const STAGES: StageDefinition[] = [
  { name: "Initial Visit Scheduled", milestone: "LEAD", statusMatch: "Initial Visit Scheduled", order: 1 },
  { name: "Adjuster Meeting Scheduled", milestone: "PROSPECT", statusMatch: "Adjuster Meeting Scheduled", order: 2 },
  { name: "Bought Job", milestone: "PROSPECT", statusMatch: "Bought Job", order: 3 },
  { name: "Scheduled Design Meeting", milestone: "PROSPECT", statusMatch: "Scheduled Design Meeting", order: 4 },
  { name: "Completed Design Meeting", milestone: "PROSPECT", statusMatch: "Completed Design Meeting", order: 5 },
  { name: "Approved", milestone: "APPROVED", statusMatch: null, order: 6 },
];

// ── Inactive Reps ────────────────────────────────────────────────
export const INACTIVE_REPS = new Set([
  "ajtaft",
  "ashton mcgee",
  "austinhagenyoung",
  "codygiguere",
  "davealexander",
  "geoffmiller",
  "kyledonlea",
  "michaelstanford",
  "pedroceballos",
  "samwanous",
]);

export function isActiveRep(name: string): boolean {
  if (!name) return false;
  return !INACTIVE_REPS.has(name.toLowerCase().trim());
}

// ── Types ──────────────────────────────────────────────────────────

export interface EnrichedJob {
  id: string;
  jobName: string;
  jobNumber: string;
  currentMilestone: string;
  createdDate: string;
  milestoneDate: string;   // date job entered its current milestone
  invoiceDate: string;     // earliest invoice date (for Built YTD)
  stage: StageName | "Unclassified";
  milestoneCategory: MilestoneCategory | "UNKNOWN";
  statusName: string;
  salesOwner: string;
  contractAmount: number;
  builtAmount: number;
}

export interface FunnelRow {
  stage: StageName;
  milestone: MilestoneCategory;
  count: number;
  value: number;
  order: number;
}

export interface ConversionRate {
  from: string;
  to: string;
  rate: number; // 0-100
}

export interface RepPerformance {
  rep: string;
  leads: number;
  ivsRate: number;
  adjusterRate: number;
  closeRate: number;
  approvedCount: number;
  approvedValue: number;
  avgDays: string;
}

export type LoadingPhase =
  | "fetching-jobs"
  | "enriching-status"
  | "enriching-sales-owner"
  | "enriching-financials"
  | "enriching-invoices"
  | "complete";

export interface SalesCycleState {
  jobs: EnrichedJob[];
  funnel: FunnelRow[];
  conversions: ConversionRate[];
  repPerformance: RepPerformance[];
  salesYTD: number;
  builtYTD: number;
  repFunnel: { rep: string; funnel: FunnelRow[] }[];
  repConversions: { rep: string; conversions: ConversionRate[] }[];
  phase: LoadingPhase;
  phaseMessage: string;
  progress: number; // 0-100
  error: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────

function getMilestoneCategory(milestone: string): MilestoneCategory | "UNKNOWN" {
  const upper = (milestone || "").toUpperCase();
  if (upper === "LEAD") return "LEAD";
  if (upper === "PROSPECT") return "PROSPECT";
  if (upper === "APPROVED") return "APPROVED";
  if (upper === "COMPLETED") return "COMPLETED";
  if (upper === "INVOICED") return "INVOICED";
  if (upper === "CLOSED") return "CLOSED";
  return "UNKNOWN";
}

function isCurrentYear(dateStr: string): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  return date.getFullYear() === new Date().getFullYear();
}

/** Milestones considered "post-approved" (job was built/invoiced) */
const POST_APPROVED_CATEGORIES: MilestoneCategory[] = ["APPROVED", "COMPLETED", "INVOICED"];

function extractStatusName(result: any): string {
  return result?.status?.name || result?.statusName || result?.name || "";
}

function classifyJob(milestone: MilestoneCategory | "UNKNOWN", statusName: string): StageName | "Unclassified" {
  if (milestone === "APPROVED") return "Approved";

  // Try exact status match first
  for (const stage of STAGES) {
    if (stage.milestone === milestone && stage.statusMatch) {
      if (statusName.toLowerCase() === stage.statusMatch.toLowerCase()) {
        return stage.name;
      }
    }
  }

  return "Unclassified";
}

function isCurrentMonth(dateStr: string): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

async function batchProcess<T>(
  items: T[],
  processor: (item: T) => Promise<void>,
  batchSize: number = 5,
  onBatchDone?: (completed: number, total: number) => void
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.allSettled(batch.map(processor));
    onBatchDone?.(Math.min(i + batchSize, items.length), items.length);
  }
}

// ── Aggregation Functions ──────────────────────────────────────────

export function buildFunnel(jobs: EnrichedJob[]): FunnelRow[] {
  return STAGES.map((stage) => {
    const matching = jobs.filter((j) => j.stage === stage.name);
    return {
      stage: stage.name,
      milestone: stage.milestone,
      count: matching.length,
      value: matching.reduce((sum, j) => sum + j.contractAmount, 0),
      order: stage.order,
    };
  });
}

export function buildConversions(jobs: EnrichedJob[]): ConversionRate[] {
  // "At or past" logic: a job at stage N has passed through stages 1..N
  const mtdJobs = jobs.filter((j) => isCurrentMonth(j.createdDate) && j.stage !== "Unclassified");
  const totalMTD = mtdJobs.length;
  if (totalMTD === 0) return [];

  function countAtOrPast(order: number): number {
    return mtdJobs.filter((j) => {
      const stageDef = STAGES.find((s) => s.name === j.stage);
      return stageDef && stageDef.order >= order;
    }).length;
  }

  const pairs: [string, string, number, number][] = [
    ["IVS", "Adjuster", 1, 2],
    ["Adjuster", "Bought", 2, 3],
    ["Bought", "Design Completed", 3, 5],
    ["Design Completed", "Approved", 5, 6],
  ];

  const conversions: ConversionRate[] = pairs.map(([from, to, fromOrder, toOrder]) => {
    const fromCount = countAtOrPast(fromOrder);
    const toCount = countAtOrPast(toOrder);
    return {
      from,
      to,
      rate: fromCount > 0 ? Math.round((toCount / fromCount) * 100) : 0,
    };
  });

  // Full cycle
  const leadCount = countAtOrPast(1);
  const approvedCount = countAtOrPast(6);
  conversions.push({
    from: "Lead",
    to: "Approved",
    rate: leadCount > 0 ? Math.round((approvedCount / leadCount) * 100) : 0,
  });

  return conversions;
}

export function buildRepFunnel(jobs: EnrichedJob[]): { rep: string; funnel: FunnelRow[] }[] {
  const activeJobs = jobs.filter((j) => isActiveRep(j.salesOwner));
  const byRep = new Map<string, EnrichedJob[]>();
  for (const job of activeJobs) {
    if (!job.salesOwner) continue;
    const list = byRep.get(job.salesOwner) || [];
    list.push(job);
    byRep.set(job.salesOwner, list);
  }

  return Array.from(byRep.entries())
    .map(([rep, repJobs]) => ({ rep, funnel: buildFunnel(repJobs) }))
    .sort((a, b) => a.rep.localeCompare(b.rep));
}

export function buildRepConversions(jobs: EnrichedJob[]): { rep: string; conversions: ConversionRate[] }[] {
  const activeJobs = jobs.filter((j) => isActiveRep(j.salesOwner));
  const byRep = new Map<string, EnrichedJob[]>();
  for (const job of activeJobs) {
    if (!job.salesOwner) continue;
    const list = byRep.get(job.salesOwner) || [];
    list.push(job);
    byRep.set(job.salesOwner, list);
  }

  return Array.from(byRep.entries())
    .map(([rep, repJobs]) => {
      // Use all classified jobs (not just current month) for per-rep conversions
      const classified = repJobs.filter((j) => j.stage !== "Unclassified");
      const total = classified.length;
      if (total === 0) return { rep, conversions: [] };

      function countAtOrPast(order: number): number {
        return classified.filter((j) => {
          const stageDef = STAGES.find((s) => s.name === j.stage);
          return stageDef && stageDef.order >= order;
        }).length;
      }

      const pairs: [string, string, number, number][] = [
        ["IVS", "Adjuster", 1, 2],
        ["Adjuster", "Bought", 2, 3],
        ["Bought", "Design Completed", 3, 5],
        ["Design Completed", "Approved", 5, 6],
      ];

      const conversions: ConversionRate[] = pairs.map(([from, to, fromOrder, toOrder]) => {
        const fromCount = countAtOrPast(fromOrder);
        const toCount = countAtOrPast(toOrder);
        return {
          from,
          to,
          rate: fromCount > 0 ? Math.round((toCount / fromCount) * 100) : 0,
        };
      });

      const leadCount = countAtOrPast(1);
      const approvedCount = countAtOrPast(6);
      conversions.push({
        from: "Lead",
        to: "Approved",
        rate: leadCount > 0 ? Math.round((approvedCount / leadCount) * 100) : 0,
      });

      return { rep, conversions };
    })
    .filter((r) => r.conversions.length > 0)
    .sort((a, b) => a.rep.localeCompare(b.rep));
}

export function buildRepPerformance(jobs: EnrichedJob[]): RepPerformance[] {
  const mtdJobs = jobs.filter((j) => isCurrentMonth(j.createdDate) && j.salesOwner);

  const byRep = new Map<string, EnrichedJob[]>();
  for (const job of mtdJobs) {
    const list = byRep.get(job.salesOwner) || [];
    list.push(job);
    byRep.set(job.salesOwner, list);
  }

  return Array.from(byRep.entries()).map(([rep, repJobs]) => {
    const total = repJobs.length;
    const classified = repJobs.filter((j) => j.stage !== "Unclassified");

    function countAtOrPast(order: number): number {
      return classified.filter((j) => {
        const s = STAGES.find((st) => st.name === j.stage);
        return s && s.order >= order;
      }).length;
    }

    const approvedJobs = repJobs.filter((j) => j.stage === "Approved");

    return {
      rep,
      leads: total,
      ivsRate: total > 0 ? Math.round((countAtOrPast(1) / total) * 100) : 0,
      adjusterRate: total > 0 ? Math.round((countAtOrPast(2) / total) * 100) : 0,
      closeRate: total > 0 ? Math.round((countAtOrPast(6) / total) * 100) : 0,
      approvedCount: approvedJobs.length,
      approvedValue: approvedJobs.reduce((s, j) => s + j.contractAmount, 0),
      avgDays: "—",
    };
  });
}

// ── Main Engine ────────────────────────────────────────────────────

export async function loadSalesCycleData(
  onUpdate: (state: SalesCycleState) => void
): Promise<void> {
  const jobs: EnrichedJob[] = [];

  const computeYTDs = () => {
    // Sales YTD = sum of contractAmount for APPROVED jobs where milestoneDate (Approved Date) is in current year
    const salesYTD = jobs
      .filter((j) => j.milestoneCategory === "APPROVED" && isCurrentYear(j.milestoneDate))
      .reduce((s, j) => s + j.contractAmount, 0);

    // Built YTD = sum of actual invoice amounts for current-year invoices
    const builtYTD = jobs
      .filter((j) => j.builtAmount > 0)
      .reduce((s, j) => s + j.builtAmount, 0);

    return { salesYTD, builtYTD };
  };

  const makeState = (
    phase: LoadingPhase,
    phaseMessage: string,
    progress: number,
    error: string | null = null
  ): SalesCycleState => {
    const activeJobs = jobs.filter((j) => isActiveRep(j.salesOwner) || !j.salesOwner);
    const { salesYTD, builtYTD } = computeYTDs();
    return {
      jobs: [...jobs],
      funnel: buildFunnel(activeJobs),
      conversions: buildConversions(activeJobs),
      repPerformance: buildRepPerformance(activeJobs),
      salesYTD,
      builtYTD,
      repFunnel: buildRepFunnel(jobs),
      repConversions: buildRepConversions(jobs),
      phase,
      phaseMessage,
      progress,
      error,
    };
  };

  // Phase 1: Fetch jobs
  onUpdate(makeState("fetching-jobs", "Fetching jobs...", 5));

  let rawJobs: any[];
  try {
    // Fetch jobs from all relevant milestones including post-approved
    // Valid milestones for this company: Lead, Prospect, Approved, Completed, Invoiced, Closed
    const [leads, prospects, approved, completed, invoiced] = await Promise.all([
      getJobs({ maxItems: "500", milestones: "Lead" }),
      getJobs({ maxItems: "500", milestones: "Prospect" }),
      getJobs({ maxItems: "500", milestones: "Approved" }),
      getJobs({ maxItems: "500", milestones: "Completed" }),
      getJobs({ maxItems: "500", milestones: "Invoiced" }),
    ]);
    rawJobs = [
      ...(leads.items || []),
      ...(prospects.items || []),
      ...(approved.items || []),
      ...(completed.items || []),
      ...(invoiced.items || []),
    ];
  } catch (err) {
    onUpdate(makeState("complete", "", 0, err instanceof Error ? err.message : "Failed to fetch jobs"));
    return;
  }

  // Build initial enriched list — APPROVED and post-approved jobs can be classified immediately
  for (const job of rawJobs) {
    const milestoneCategory = getMilestoneCategory(job.currentMilestone);
    const stage = (milestoneCategory === "APPROVED") ? "Approved" as StageName : "Unclassified" as const;

    jobs.push({
      id: job.id,
      jobName: job.jobName || `Job #${job.jobNumber || job.id}`,
      jobNumber: job.jobNumber || "",
      currentMilestone: job.currentMilestone || "",
      createdDate: job.createdDate || "",
      milestoneDate: job.milestoneDate || "",
      invoiceDate: "",
      stage,
      milestoneCategory,
      statusName: "",
      salesOwner: "",
      contractAmount: 0,
      builtAmount: 0,
    });
  }

  onUpdate(makeState("fetching-jobs", `Found ${jobs.length} jobs`, 15));

  // Phase 2: Enrich status for LEAD and PROSPECT jobs only
  const needsStatus = jobs.filter((j) => j.milestoneCategory === "LEAD" || j.milestoneCategory === "PROSPECT");

  if (needsStatus.length > 0) {
    onUpdate(makeState("enriching-status", `Loading status for ${needsStatus.length} jobs...`, 20));

    await batchProcess(
      needsStatus,
      async (job) => {
        try {
          const result = await getJobCurrentMilestoneWithStatus(job.id);
          const statusName = extractStatusName(result);
          job.statusName = statusName;
          job.stage = classifyJob(job.milestoneCategory, statusName);
        } catch {
          // Leave as Unclassified
        }
      },
      5,
      (done, total) => {
        const pct = 20 + Math.round((done / total) * 25);
        onUpdate(makeState("enriching-status", `Status: ${done}/${total} jobs`, pct));
      }
    );
  }

  onUpdate(makeState("enriching-status", "Status enrichment complete", 45));

  // Phase 3: Enrich sales owner for all jobs with a known milestone
  const needsOwner = jobs.filter((j) => j.milestoneCategory !== "UNKNOWN");

  if (needsOwner.length > 0) {
    onUpdate(makeState("enriching-sales-owner", "Loading user directory...", 50));

    // Build a user ID → display name lookup from all users
    const userNameMap = new Map<string, string>();
    try {
      const usersResult = await getUsers();
      const userList = usersResult?.items || usersResult || [];
      for (const u of userList) {
        const name =
          u.displayName ||
          [u.firstName, u.lastName].filter(Boolean).join(" ") ||
          u.name || "";
        if (u.id && name) {
          userNameMap.set(u.id, name);
        }
      }
    } catch {
      // Continue without user lookup — salesOwner will stay empty
    }

    onUpdate(makeState("enriching-sales-owner", `Matching reps for ${needsOwner.length} jobs...`, 55));

    await batchProcess(
      needsOwner,
      async (job) => {
        try {
          const result = await getJobRepresentatives(job.id);
          const reps = result?.items || [];
          // Prefer SalesOwner type, fallback to CompanyRepresentative, then first rep
          const rep =
            reps.find((r: any) => r.type === "SalesOwner") ||
            reps.find((r: any) => r.type === "CompanyRepresentative") ||
            reps[0];
          if (rep?.user?.id) {
            job.salesOwner = userNameMap.get(rep.user.id) || "";
          }
        } catch {
          // Leave empty
        }
      },
      5,
      (done, total) => {
        const pct = 55 + Math.round((done / total) * 15);
        onUpdate(makeState("enriching-sales-owner", `Sales owners: ${done}/${total} jobs`, pct));
      }
    );
  }

  onUpdate(makeState("enriching-sales-owner", "Sales owner enrichment complete", 70));

  // Phase 4: Enrich financials
  const needsFinancials = jobs.filter((j) => j.milestoneCategory !== "UNKNOWN");

  if (needsFinancials.length > 0) {
    onUpdate(makeState("enriching-financials", `Loading financials for ${needsFinancials.length} jobs...`, 72));

    await batchProcess(
      needsFinancials,
      async (job) => {
        try {
          const result = await getJobFinancials(job.id);
          if (result) {
            // If the response has approvedJobValue directly, use it
            if (result.approvedJobValue != null) {
              job.contractAmount = result.approvedJobValue;
            } else if (result.id) {
              // /jobs/{id}/financials returned a link — resolve via /financials/{id}
              const full = await getFinancialById(result.id);
              if (full?.approvedJobValue != null) {
                job.contractAmount = full.approvedJobValue;
              }
            }
          }
        } catch {
          // Leave as 0
        }
      },
      5,
      (done, total) => {
        const pct = 72 + Math.round((done / total) * 18);
        onUpdate(makeState("enriching-financials", `Financials: ${done}/${total} jobs`, pct));
      }
    );
  }

  onUpdate(makeState("enriching-financials", "Financial enrichment complete", 90));

  // Phase 5: Enrich invoice dates for Built YTD
  // Fetch earliest invoice date for Completed/Invoiced jobs (and Approved jobs that may have invoices)
  const needsInvoices = jobs.filter((j) =>
    j.milestoneCategory === "APPROVED" || j.milestoneCategory === "COMPLETED" || j.milestoneCategory === "INVOICED"
  );

  if (needsInvoices.length > 0) {
    onUpdate(makeState("enriching-invoices", `Loading invoice dates for ${needsInvoices.length} jobs...`, 91));

    await batchProcess(
      needsInvoices,
      async (job) => {
        try {
          const result = await getJobInvoices(job.id);
          const invoices = result?.items || result || [];
          const invoiceList = Array.isArray(invoices) ? invoices : [];
          if (invoiceList.length > 0) {
            // Debug: log first invoice object keys to identify amount field
            if (jobs.indexOf(job) === needsInvoices.indexOf(job) && needsInvoices.indexOf(job) === 0) {
              console.log("[Built YTD Debug] Sample invoice object:", JSON.stringify(invoiceList[0]));
            }

            // Find the earliest invoice date
            const dates = invoiceList
              .map((inv: any) => inv.invoiceDate)
              .filter((d: string) => d && d !== "")
              .sort();
            if (dates.length > 0) {
              job.invoiceDate = dates[0];
            }

            // Sum invoice amounts for current-year invoices (Built YTD)
            job.builtAmount = invoiceList
              .filter((inv: any) => inv.invoiceDate && isCurrentYear(inv.invoiceDate))
              .reduce((sum: number, inv: any) => sum + (inv.invoiceTotal || inv.amount || inv.total || inv.invoiceAmount || 0), 0);
          }
        } catch {
          // Leave invoiceDate empty
        }
      },
      5,
      (done, total) => {
        const pct = 91 + Math.round((done / total) * 8);
        onUpdate(makeState("enriching-invoices", `Invoices: ${done}/${total} jobs`, pct));
      }
    );
  }

  onUpdate(makeState("complete", "All data loaded", 100));
}
