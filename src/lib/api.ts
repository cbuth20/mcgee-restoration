const BASE_URL = "/api/acculynx";

const MAX_PAGE_SIZE = 25;

async function fetchApi<T>(
  endpoint: string,
  params?: Record<string, string>
): Promise<T> {
  const searchParams = new URLSearchParams(params);
  const url = `${BASE_URL}?endpoint=${encodeURIComponent(endpoint)}${
    searchParams.toString() ? `&${searchParams.toString()}` : ""
  }`;

  const res = await fetch(url);
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API Error ${res.status}: ${errorText}`);
  }
  return res.json();
}

/**
 * Fetches all pages for a paginated endpoint.
 * AccuLynx max page size is 25, so we fetch in batches.
 * `maxItems` caps total records fetched (default 200).
 */
export async function fetchAllPages(
  endpoint: string,
  params?: Record<string, string>,
  maxItems: number = 200
): Promise<{ items: any[]; count: number }> {
  const allItems: any[] = [];
  let pageStartIndex = 0;
  let totalCount = 0;

  while (allItems.length < maxItems) {
    const result = await fetchApi<any>(endpoint, {
      ...params,
      pageSize: String(MAX_PAGE_SIZE),
      pageStartIndex: String(pageStartIndex),
    });

    const items = result.items || [];
    totalCount = result.count || 0;
    allItems.push(...items);

    // Stop if we got fewer than a full page or reached the end
    if (items.length < MAX_PAGE_SIZE || allItems.length >= totalCount) {
      break;
    }

    pageStartIndex += MAX_PAGE_SIZE;
  }

  return { items: allItems.slice(0, maxItems), count: totalCount };
}

/**
 * Fetches an endpoint and normalizes the response to { items, count }.
 * Works for both paginated and non-paginated endpoints.
 */
async function fetchSafe(
  endpoint: string,
  params?: Record<string, string>
): Promise<{ items: any[]; count: number }> {
  const result = await fetchApi<any>(endpoint, {
    ...params,
    pageSize: String(MAX_PAGE_SIZE),
  });

  // If response has items array, it's paginated
  if (result?.items) {
    return { items: result.items, count: result.count || result.items.length };
  }

  // If response is an array directly
  if (Array.isArray(result)) {
    return { items: result, count: result.length };
  }

  // Single object
  return { items: result ? [result] : [], count: result ? 1 : 0 };
}

// Jobs
export async function getJobs(params?: Record<string, string>) {
  const maxItems = params?.maxItems ? parseInt(params.maxItems) : 200;
  const { maxItems: _, ...rest } = params || {};
  // Default to newest-first so active/open jobs appear before old Cancelled/Closed ones
  const withDefaults = { sortOrder: "Descending", ...rest };
  return fetchAllPages("/jobs", withDefaults, maxItems);
}

export async function searchJobs(body: Record<string, unknown>) {
  const res = await fetch(`${BASE_URL}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: "/jobs/search", body }),
  });
  if (!res.ok) throw new Error(`API Error ${res.status}`);
  return res.json();
}

export async function getJobById(jobId: string) {
  return fetchApi<any>(`/jobs/${jobId}`);
}

export async function getJobFinancials(jobId: string) {
  return fetchApi<any>(`/jobs/${jobId}/financials`);
}

export async function getJobPayments(jobId: string) {
  return fetchApi<any>(`/jobs/${jobId}/payments`);
}

export async function getJobPaymentsOverview(jobId: string) {
  return fetchApi<any>(`/jobs/${jobId}/payments/overview`);
}

export async function getJobMilestones(jobId: string) {
  return fetchApi<any>(`/jobs/${jobId}/milestones`);
}

export async function getJobCurrentMilestone(jobId: string) {
  return fetchApi<any>(`/jobs/${jobId}/milestones/current`);
}

export async function getJobContacts(jobId: string) {
  return fetchApi<any>(`/jobs/${jobId}/contacts`);
}

export async function getJobEstimates(jobId: string) {
  return fetchApi<any>(`/jobs/${jobId}/estimates`);
}

export async function getJobInvoices(jobId: string) {
  return fetchApi<any>(`/jobs/${jobId}/invoices`);
}

export async function getJobRepresentatives(jobId: string) {
  return fetchApi<any>(`/jobs/${jobId}/representatives`);
}

export async function getJobSalesOwner(jobId: string) {
  return fetchApi<any>(`/jobs/${jobId}/representatives/sales-owner`);
}

export async function getJobCurrentMilestoneWithStatus(jobId: string) {
  return fetchApi<any>(`/jobs/${jobId}/milestones/current?includes=status`);
}

export async function getJobHistory(jobId: string) {
  return fetchApi<any>(`/jobs/${jobId}/history`);
}

// Contacts
export async function getContacts(params?: Record<string, string>) {
  const maxItems = params?.maxItems ? parseInt(params.maxItems) : 200;
  const { maxItems: _, ...rest } = params || {};
  return fetchAllPages("/contacts", rest, maxItems);
}

export async function searchContacts(body: Record<string, unknown>) {
  const res = await fetch(`${BASE_URL}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: "/contacts/search", body }),
  });
  if (!res.ok) throw new Error(`API Error ${res.status}`);
  return res.json();
}

export async function getContactById(contactId: string) {
  return fetchApi<any>(`/contacts/${contactId}`);
}

export async function getContactTypes() {
  return fetchApi<any>("/contacts/types");
}

// Users
export async function getUsers() {
  return fetchAllPages("/users", {}, 100);
}

export async function getUserById(userId: string) {
  return fetchApi<any>(`/users/${userId}`);
}

// Estimates
export async function getEstimates(params?: Record<string, string>) {
  return fetchApi<any>("/estimates", { ...params, pageSize: String(MAX_PAGE_SIZE) });
}

export async function getEstimateById(estimateId: string) {
  return fetchApi<any>(`/estimates/${estimateId}`);
}

// Invoices
export async function getInvoiceById(invoiceId: string) {
  return fetchApi<any>(`/invoices/${invoiceId}`);
}

// Financials
export async function getFinancialById(financialId: string) {
  return fetchApi<any>(`/financials/${financialId}`);
}

// Supplements
export async function getSupplements(params?: Record<string, string>) {
  return fetchApi<any>("/supplements", { ...params, pageSize: String(MAX_PAGE_SIZE) });
}

export async function getSupplementById(supplementId: string) {
  return fetchApi<any>(`/supplements/${supplementId}`);
}

// Company Settings
export async function getCompanySettings() {
  return fetchApi<any>("/company-settings");
}

export async function getLeadSources() {
  return fetchSafe("/company-settings/leads/lead-sources");
}

export async function getTradeTypes() {
  return fetchSafe("/company-settings/job-file-settings/trade-types");
}

export async function getWorkTypes() {
  return fetchSafe("/company-settings/job-file-settings/work-types");
}

export async function getJobCategories() {
  return fetchSafe("/company-settings/job-file-settings/job-categories");
}

export async function getAccountTypes() {
  return fetchSafe("/company-settings/location-settings/account-types");
}

// Reports
export async function getReportInstances(scheduleId: string) {
  return fetchApi<any>(`/reports/${scheduleId}/instances`);
}

export async function getReportByInstanceId(instanceId: string) {
  return fetchApi<any>(`/reports/instances/${instanceId}`);
}

export async function getReportLatestInstance(instanceId: string) {
  return fetchApi<any>(`/reports/instances/${instanceId}/latest`);
}

// Lead History
export async function getLeadHistory(leadId: string) {
  return fetchApi<any>(`/leads/${leadId}/history`);
}

// Diagnostics
export async function ping() {
  return fetchApi<any>("/ping");
}
