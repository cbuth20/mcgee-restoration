"use client";

import { useApi } from "@/lib/hooks";
import { getUsers, getJobs } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import DataTable from "@/components/DataTable";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import { RefreshCw } from "lucide-react";

export default function UsersPage() {
  const { data: usersData, loading: usersLoading, error: usersError, refetch: refetchUsers } = useApi(
    () => getUsers(),
    []
  );

  const userList: any[] = usersData?.items || [];

  // Group by role
  const roleCounts: Record<string, number> = {};
  userList.forEach((u: any) => {
    const role = u.role?.name || "Unknown";
    roleCounts[role] = (roleCounts[role] || 0) + 1;
  });

  const activeCount = userList.filter((u: any) => u.status === "Active").length;

  const columns = [
    {
      key: "displayName",
      label: "Name",
      sortable: true,
      render: (item: any) => {
        const name = item.displayName || [item.firstName, item.lastName].filter(Boolean).join(" ") || "—";
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              {item.initials || name.charAt(0).toUpperCase()}
            </div>
            <div>
              <span className="font-medium text-gray-900">{name}</span>
              {item.email && (
                <p className="text-xs text-gray-500">{item.email}</p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "role",
      label: "Role",
      sortable: true,
      render: (item: any) => {
        const role = item.role?.name || "—";
        const colors: Record<string, string> = {
          CompanyAdmin: "bg-purple-50 text-purple-700",
          LocationAdmin: "bg-blue-50 text-blue-700",
          Manager: "bg-amber-50 text-amber-700",
          Sales: "bg-emerald-50 text-emerald-700",
          Office: "bg-gray-100 text-gray-700",
        };
        return (
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[role] || "bg-gray-100 text-gray-700"}`}>
            {role}
          </span>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (item: any) => (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            item.status === "Active"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {item.status || "Unknown"}
        </span>
      ),
    },
    {
      key: "phone",
      label: "Phone",
      render: (item: any) => item.phone || item.mobilePhone || "—",
    },
    {
      key: "email",
      label: "Email",
      render: (item: any) => (
        <span className="text-sm text-gray-600">{item.email || "—"}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Team"
        subtitle="AccuLynx users and roles"
        actions={
          <button
            onClick={refetchUsers}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        }
      />

      {usersLoading && <LoadingSpinner message="Loading team data..." />}
      {usersError && !usersLoading && <ErrorMessage message={usersError} onRetry={refetchUsers} />}

      {!usersLoading && !usersError && (
        <>
          {/* Stats */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium uppercase text-gray-500">Total Users</p>
              <p className="mt-1 text-xl font-bold text-gray-900">{userList.length}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium uppercase text-gray-500">Active</p>
              <p className="mt-1 text-xl font-bold text-emerald-600">{activeCount}</p>
            </div>
            {Object.entries(roleCounts)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 3)
              .map(([role, count]) => (
                <div key={role} className="rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-xs font-medium uppercase text-gray-500 truncate">{role}</p>
                  <p className="mt-1 text-xl font-bold text-gray-900">{count}</p>
                </div>
              ))}
          </div>

          <Card title="Team Members" subtitle={`${userList.length} users in your AccuLynx account`}>
            <DataTable
              columns={columns}
              data={userList}
              searchable
              searchKeys={["displayName", "firstName", "lastName", "email"]}
              emptyMessage="No users found"
            />
          </Card>
        </>
      )}
    </>
  );
}
