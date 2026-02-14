import {
  getJobs,
  getJobCurrentMilestoneWithStatus,
  getJobRepresentatives,
  getJobFinancials,
  getFinancialById,
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

export type MilestoneCategory = "LEAD" | "PROSPECT" | "APPROVED";

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

// ── Types ──────────────────────────────────────────────────────────

export interface EnrichedJob {
  id: string;
  jobName: string;
  jobNumber: string;
  currentMilestone: string;
  createdDate: string;
  stage: StageName | "Unclassified";
  milestoneCategory: MilestoneCategory | "UNKNOWN";
  statusName: string;
  salesOwner: string;
  contractAmount: number;
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
  | "complete";

export interface SalesCycleState {
  jobs: EnrichedJob[];
  funnel: FunnelRow[];
  conversions: ConversionRate[];
  repPerformance: RepPerformance[];
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
  return "UNKNOWN";
}

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

  // Fallback: when status is just the milestone name (e.g. "Lead", "Prospect"),
  // classify into the first stage for that milestone
  const statusLower = statusName.toLowerCase();
  if (statusLower === milestone.toLowerCase()) {
    const firstStage = STAGES.find((s) => s.milestone === milestone);
    if (firstStage) return firstStage.name;
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

  const makeState = (
    phase: LoadingPhase,
    phaseMessage: string,
    progress: number,
    error: string | null = null
  ): SalesCycleState => ({
    jobs: [...jobs],
    funnel: buildFunnel(jobs),
    conversions: buildConversions(jobs),
    repPerformance: buildRepPerformance(jobs),
    phase,
    phaseMessage,
    progress,
    error,
  });

  // Phase 1: Fetch jobs
  onUpdate(makeState("fetching-jobs", "Fetching jobs...", 5));

  let rawJobs: any[];
  try {
    // Fetch jobs filtered to the milestones we care about
    const [leads, prospects, approved] = await Promise.all([
      getJobs({ maxItems: "500", milestones: "Lead" }),
      getJobs({ maxItems: "500", milestones: "Prospect" }),
      getJobs({ maxItems: "500", milestones: "Approved" }),
    ]);
    rawJobs = [
      ...(leads.items || []),
      ...(prospects.items || []),
      ...(approved.items || []),
    ];
  } catch (err) {
    onUpdate(makeState("complete", "", 0, err instanceof Error ? err.message : "Failed to fetch jobs"));
    return;
  }

  // Build initial enriched list — APPROVED jobs can be classified immediately
  for (const job of rawJobs) {
    const milestoneCategory = getMilestoneCategory(job.currentMilestone);
    const stage = milestoneCategory === "APPROVED" ? "Approved" as StageName : "Unclassified" as const;

    jobs.push({
      id: job.id,
      jobName: job.jobName || `Job #${job.jobNumber || job.id}`,
      jobNumber: job.jobNumber || "",
      currentMilestone: job.currentMilestone || "",
      createdDate: job.createdDate || "",
      stage,
      milestoneCategory,
      statusName: "",
      salesOwner: "",
      contractAmount: 0,
    });
  }

  onUpdate(makeState("fetching-jobs", `Found ${jobs.length} jobs`, 15));

  // Phase 2: Enrich status for non-APPROVED jobs
  const needsStatus = jobs.filter((j) => j.milestoneCategory !== "APPROVED" && j.milestoneCategory !== "UNKNOWN");

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
    onUpdate(makeState("enriching-financials", `Loading financials for ${needsFinancials.length} jobs...`, 75));

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
        const pct = 75 + Math.round((done / total) * 20);
        onUpdate(makeState("enriching-financials", `Financials: ${done}/${total} jobs`, pct));
      }
    );
  }

  onUpdate(makeState("complete", "All data loaded", 100));
}
