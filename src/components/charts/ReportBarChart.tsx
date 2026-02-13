"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { ReportResult } from "@/lib/reportEngine";

const COLORS = [
  "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444",
  "#06b6d4", "#ec4899", "#6366f1", "#14b8a6", "#f97316",
];

export default function ReportBarChart({ data }: { data: ReportResult[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(300, data.length * 40)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 30, left: 8, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" fontSize={12} tickLine={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={140}
          fontSize={12}
          tickLine={false}
        />
        <Tooltip
          formatter={(_value, _name, props) => [
            (props as any).payload.formattedValue,
            "Value",
          ]}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            fontSize: 13,
          }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={32}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
