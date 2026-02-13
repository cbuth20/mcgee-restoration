"use client";

import { useState, useEffect } from "react";
import { useApi } from "@/lib/hooks";
import { getJobs, getJobFinancials } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import Card from "@/components/Card";
import DataTable from "@/components/DataTable";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import { DollarSign, TrendingUp, Receipt, CreditCard, RefreshCw } from "lucide-react";

interface FinancialRow {
  jobId: string;
  jobName: string;
  milestone: string;
  trade: string;
  workType: string;
  contractAmount: number;
  paymentsReceived: number;
  paymentsPaid: number;
  balance: number;
  [key: string]: unknown;
}

export default function FinancialsPage() {
  const { data: jobsData, loading: jobsLoading, error: jobsError, refetch } = useApi(
    () => getJobs({ maxItems: "50" }),
    []
  );

  const [financials, setFinancials] = useState<FinancialRow[]>([]);
  const [loadingFinancials, setLoadingFinancials] = useState(false);

  const jobList: any[] = jobsData?.items || [];

  useEffect(() => {
    if (jobList.length === 0) return;

    async function loadFinancials() {
      setLoadingFinancials(true);
      const results: FinancialRow[] = [];

      const jobsToFetch = jobList.slice(0, 25);

      await Promise.allSettled(
        jobsToFetch.map(async (job: any) => {
          try {
            const fin = await getJobFinancials(job.id);
            if (fin) {
              results.push({
                jobId: job.id,
                jobName: job.jobName || `Job #${job.jobNumber || job.id}`,
                milestone: job.currentMilestone || "Unknown",
                trade: job.tradeTypes?.map((t: any) => t.name).join(", ") || "—",
                workType: job.workType?.name || "—",
                contractAmount: fin.contractAmount || fin.totalContractAmount || fin.estimateTotal || 0,
                paymentsReceived: fin.paymentsReceived || fin.totalReceived || 0,
                paymentsPaid: fin.paymentsPaid || fin.totalPaid || 0,
                balance: fin.balance || fin.amountDue || 0,
              });
            }
          } catch {
            // Skip jobs where financials aren't available
          }
        })
      );

      setFinancials(results);
      setLoadingFinancials(false);
    }

    loadFinancials();
  }, [jobList.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const isLoading = jobsLoading || loadingFinancials;

  const totalContract = financials.reduce((s, f) => s + f.contractAmount, 0);
  const totalReceived = financials.reduce((s, f) => s + f.paymentsReceived, 0);
  const totalPaid = financials.reduce((s, f) => s + f.paymentsPaid, 0);
  const totalBalance = financials.reduce((s, f) => s + f.balance, 0);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  const columns = [
    {
      key: "jobName",
      label: "Job",
      sortable: true,
      render: (item: any) => <span className="font-medium text-gray-900">{item.jobName}</span>,
    },
    {
      key: "milestone",
      label: "Milestone",
      sortable: true,
      render: (item: any) => (
        <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
          {item.milestone}
        </span>
      ),
    },
    {
      key: "trade",
      label: "Trade",
    },
    {
      key: "contractAmount",
      label: "Contract",
      sortable: true,
      render: (item: any) => <span className="font-medium">{fmt(item.contractAmount)}</span>,
    },
    {
      key: "paymentsReceived",
      label: "Received",
      sortable: true,
      render: (item: any) => <span className="text-emerald-600">{fmt(item.paymentsReceived)}</span>,
    },
    {
      key: "paymentsPaid",
      label: "Paid Out",
      sortable: true,
      render: (item: any) => <span className="text-red-600">{fmt(item.paymentsPaid)}</span>,
    },
    {
      key: "balance",
      label: "Balance",
      sortable: true,
      render: (item: any) => (
        <span className={`font-semibold ${item.balance > 0 ? "text-amber-600" : "text-gray-600"}`}>
          {fmt(item.balance)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Financials"
        subtitle="Financial overview across your jobs"
        actions={
          <button
            onClick={refetch}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        }
      />

      {isLoading && <LoadingSpinner message="Loading financial data..." />}
      {jobsError && !isLoading && (
        <ErrorMessage message={jobsError} onRetry={refetch} />
      )}

      {!isLoading && !jobsError && (
        <>
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Contract Value"
              value={fmt(totalContract)}
              icon={DollarSign}
              iconColor="text-blue-600"
              iconBg="bg-blue-50"
            />
            <StatCard
              label="Payments Received"
              value={fmt(totalReceived)}
              icon={TrendingUp}
              iconColor="text-emerald-600"
              iconBg="bg-emerald-50"
            />
            <StatCard
              label="Payments Paid"
              value={fmt(totalPaid)}
              icon={CreditCard}
              iconColor="text-red-600"
              iconBg="bg-red-50"
            />
            <StatCard
              label="Outstanding Balance"
              value={fmt(totalBalance)}
              icon={Receipt}
              iconColor="text-amber-600"
              iconBg="bg-amber-50"
            />
          </div>

          <Card
            title="Job Financial Details"
            subtitle={`Financial data for ${financials.length} jobs`}
          >
            <DataTable
              columns={columns}
              data={financials}
              searchable
              searchKeys={["jobName", "milestone", "trade"]}
              emptyMessage="No financial data available. Financial details may need to be configured in AccuLynx."
            />
          </Card>
        </>
      )}
    </>
  );
}
