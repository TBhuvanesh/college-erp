"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899"];

interface ChartProps {
  data: any[];
  xKey: string;
  yKey: string;
  height?: number;
}

export function FeedbackBarChart({ data, xKey, yKey, height = 300 }: ChartProps) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
          <XAxis 
            dataKey={xKey} 
            stroke="var(--text-muted)" 
            fontSize={11} 
            tickLine={false} 
            axisLine={false} 
          />
          <YAxis 
            stroke="var(--text-muted)" 
            fontSize={11} 
            tickLine={false} 
            axisLine={false}
            domain={[0, 5]}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: "var(--background)", 
              borderColor: "var(--border-subtle)",
              color: "var(--text-primary)",
              borderRadius: "8px"
            }} 
          />
          <Bar dataKey={yKey} fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FeedbackLineChart({ data, xKey, yKey, height = 300 }: ChartProps) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
          <XAxis 
            dataKey={xKey} 
            stroke="var(--text-muted)" 
            fontSize={11} 
            tickLine={false} 
            axisLine={false} 
          />
          <YAxis 
            stroke="var(--text-muted)" 
            fontSize={11} 
            tickLine={false} 
            axisLine={false}
            domain={[0, 5]}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: "var(--background)", 
              borderColor: "var(--border-subtle)",
              color: "var(--text-primary)",
              borderRadius: "8px"
            }} 
          />
          <Line type="monotone" dataKey={yKey} stroke="#8b5cf6" strokeWidth={3} activeDot={{ r: 8 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface DoughnutProps {
  data: { name: string; value: number }[];
  height?: number;
}

export function FeedbackDoughnutChart({ data, height = 260 }: DoughnutProps) {
  return (
    <div style={{ width: "100%", height }} className="relative flex items-center justify-center">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--background)",
              borderColor: "var(--border-subtle)",
              color: "var(--text-primary)",
              borderRadius: "8px"
            }}
          />
          <Legend 
            verticalAlign="bottom" 
            height={36} 
            iconType="circle"
            formatter={(value) => <span className="text-xs text-text-secondary">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
