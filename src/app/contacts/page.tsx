"use client";

import { useApi } from "@/lib/hooks";
import { getContacts } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import Card from "@/components/Card";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import { RefreshCw, Download } from "lucide-react";

export default function ContactsPage() {
  const { data, loading, error, refetch } = useApi(
    () => getContacts({ maxItems: "200" }),
    []
  );

  const contactList: any[] = data?.items || [];
  const totalCount = data?.count || 0;

  const columns = [
    {
      key: "firstName",
      label: "Name",
      sortable: true,
      render: (item: any) => (
        <div>
          <span className="font-medium text-gray-900">
            {[item.firstName, item.lastName].filter(Boolean).join(" ") || "—"}
          </span>
          {item.companyName && (
            <p className="text-xs text-gray-500">{item.companyName}</p>
          )}
        </div>
      ),
    },
    {
      key: "city",
      label: "Location",
      sortable: true,
      render: (item: any) => {
        const addr = item.mailingAddress;
        if (!addr) return "—";
        const parts = [addr.city, addr.state?.abbreviation].filter(Boolean);
        return parts.length > 0 ? parts.join(", ") : "—";
      },
    },
    {
      key: "address",
      label: "Address",
      render: (item: any) => {
        const addr = item.mailingAddress;
        if (!addr?.street1) return "—";
        return (
          <span className="text-gray-600 text-xs">
            {addr.street1}
            {addr.street2 ? `, ${addr.street2}` : ""}
          </span>
        );
      },
    },
    {
      key: "zipCode",
      label: "Zip",
      render: (item: any) => item.mailingAddress?.zipCode || "—",
    },
    {
      key: "emails",
      label: "Emails",
      render: (item: any) => {
        const count = item.emailAddresses?.length || 0;
        return count > 0 ? (
          <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
            {count} email{count !== 1 ? "s" : ""}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        );
      },
    },
    {
      key: "phones",
      label: "Phones",
      render: (item: any) => {
        const count = item.phoneNumbers?.length || 0;
        return count > 0 ? (
          <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
            {count} phone{count !== 1 ? "s" : ""}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        );
      },
    },
  ];

  const exportCSV = () => {
    const headers = ["First Name", "Last Name", "Company", "Street", "City", "State", "Zip", "Emails", "Phones"];
    const rows = contactList.map((c: any) => [
      c.firstName || "",
      c.lastName || "",
      c.companyName || "",
      c.mailingAddress?.street1 || "",
      c.mailingAddress?.city || "",
      c.mailingAddress?.state?.abbreviation || "",
      c.mailingAddress?.zipCode || "",
      c.emailAddresses?.length || 0,
      c.phoneNumbers?.length || 0,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c: any) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mcgee-contacts-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Contacts"
        subtitle={`${totalCount.toLocaleString()} total contacts in AccuLynx`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button
              onClick={refetch}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        }
      />

      {loading && <LoadingSpinner message="Loading contacts..." />}
      {error && !loading && <ErrorMessage message={error} onRetry={refetch} />}

      {!loading && !error && (
        <Card
          title={`Contacts (${contactList.length} of ${totalCount.toLocaleString()})`}
          subtitle="Contact records from AccuLynx"
        >
          <DataTable
            columns={columns}
            data={contactList}
            searchable
            searchKeys={["firstName", "lastName", "companyName"]}
            emptyMessage="No contacts found"
          />
        </Card>
      )}
    </>
  );
}
