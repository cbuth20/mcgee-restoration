"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ReportResult } from "@/lib/reportEngine";

export default function ReportLineChart({ data }: { data: ReportResult[] }) {
  // Sort chronologically for time-based display
  const sorted = [...data].sort((a, b) => a.label.localeCompare(b.label));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart
        data={sorted}
        margin={{ top: 4, right: 30, left: 8, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" fontSize={12} tickLine={false} />
        <YAxis fontSize={12} tickLine={false} />
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
        <Line
          type="monotone"
          dataKey="value"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ r: 4, fill: "#3b82f6" }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
