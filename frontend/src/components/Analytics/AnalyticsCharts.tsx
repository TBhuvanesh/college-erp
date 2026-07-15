"use client";

import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

// Elegant colors that support dark mode
const COLORS = [
  "var(--accent-blue)",     // blue
  "var(--accent-purple)",   // purple
  "var(--success)",         // green
  "var(--warning)",         // amber
  "var(--danger)",          // red
  "#06b6d4",                // cyan
  "#f97316",                // orange
  "#ec4899",                // pink
];

interface ChartSeries {
  label: string;
  data: number[];
}

interface CommonChartProps {
  title?: string;
  labels: string[];
  series: ChartSeries[];
  height?: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface border border-border-strong rounded-xl p-3.5 shadow-xl text-xs">
        <p className="font-bold text-text-primary mb-1">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: entry.color || entry.fill }}
              />
              <span className="text-text-secondary">{entry.name}:</span>
              <span className="font-semibold text-text-primary">
                {typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

// ----------------------------------------------------
// 1. Line Chart Component
// ----------------------------------------------------
export const LineChartComponent: React.FC<CommonChartProps> = ({
  labels,
  series,
  height = 300,
}) => {
  // Transform labels and series into Recharts array format
  const chartData = labels.map((label, index) => {
    const item: Record<string, any> = { name: label };
    series.forEach((s) => {
      item[s.label] = s.data[index] ?? 0;
    });
    return item;
  });

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 15, right: 15, left: -15, bottom: 5 }}>
          <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            stroke="var(--text-muted)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            dy={8}
          />
          <YAxis
            stroke="var(--text-muted)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            dx={-8}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="top"
            height={36}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: "12px", color: "var(--text-secondary)" }}
          />
          {series.map((s, idx) => (
            <Line
              key={s.label}
              type="monotone"
              dataKey={s.label}
              stroke={COLORS[idx % COLORS.length]}
              strokeWidth={2.5}
              dot={{ stroke: COLORS[idx % COLORS.length], strokeWidth: 2, r: 3 }}
              activeDot={{ r: 6 }}
              animationDuration={800}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// ----------------------------------------------------
// 2. Bar Chart Component
// ----------------------------------------------------
export const BarChartComponent: React.FC<CommonChartProps> = ({
  labels,
  series,
  height = 300,
}) => {
  const chartData = labels.map((label, index) => {
    const item: Record<string, any> = { name: label };
    series.forEach((s) => {
      item[s.label] = s.data[index] ?? 0;
    });
    return item;
  });

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 15, right: 15, left: -15, bottom: 5 }}>
          <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            stroke="var(--text-muted)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            dy={8}
          />
          <YAxis
            stroke="var(--text-muted)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            dx={-8}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="top"
            height={36}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: "12px", color: "var(--text-secondary)" }}
          />
          {series.map((s, idx) => (
            <Bar
              key={s.label}
              dataKey={s.label}
              fill={COLORS[idx % COLORS.length]}
              radius={[4, 4, 0, 0]}
              maxBarSize={45}
              animationDuration={800}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ----------------------------------------------------
// 3. Pie & Doughnut Chart Component
// ----------------------------------------------------
interface PieDoughnutProps extends CommonChartProps {
  isDoughnut?: boolean;
}

export const PieChartComponent: React.FC<PieDoughnutProps> = ({
  labels,
  series,
  height = 300,
  isDoughnut = false,
}) => {
  // Pie expects a flat array of { name, value }
  // We use the first series data
  const data = labels.map((label, index) => ({
    name: label,
    value: series[0]?.data[index] ?? 0,
  }));

  return (
    <div style={{ width: "100%", height }} className="flex flex-col items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={48}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: "11px", color: "var(--text-secondary)" }}
          />
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            labelLine={false}
            innerRadius={isDoughnut ? "55%" : 0}
            outerRadius="75%"
            paddingAngle={isDoughnut ? 3 : 0}
            dataKey="value"
            animationDuration={800}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

// ----------------------------------------------------
// 4. Area Chart Component
// ----------------------------------------------------
export const AreaChartComponent: React.FC<CommonChartProps> = ({
  labels,
  series,
  height = 300,
}) => {
  const chartData = labels.map((label, index) => {
    const item: Record<string, any> = { name: label };
    series.forEach((s) => {
      item[s.label] = s.data[index] ?? 0;
    });
    return item;
  });

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 15, right: 15, left: -15, bottom: 5 }}>
          <defs>
            {series.map((s, idx) => (
              <linearGradient
                key={`grad-${s.label}`}
                id={`grad-${idx}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor={COLORS[idx % COLORS.length]}
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor={COLORS[idx % COLORS.length]}
                  stopOpacity={0}
                />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            stroke="var(--text-muted)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            dy={8}
          />
          <YAxis
            stroke="var(--text-muted)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            dx={-8}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="top"
            height={36}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: "12px", color: "var(--text-secondary)" }}
          />
          {series.map((s, idx) => (
            <Area
              key={s.label}
              type="monotone"
              dataKey={s.label}
              stroke={COLORS[idx % COLORS.length]}
              strokeWidth={2.5}
              fillOpacity={1}
              fill={`url(#grad-${idx})`}
              animationDuration={800}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
