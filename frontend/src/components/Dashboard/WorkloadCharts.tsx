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

const COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444"];

interface WorkloadChartProps {
  weeklyData?: any[];
  assignmentData?: any[];
  completionData?: any[];
  height?: number;
}

export function WeeklyWorkloadChart({ weeklyData, height = 260 }: WorkloadChartProps) {
  const defaultData = weeklyData || [
    { name: "Mon", Hours: 4 },
    { name: "Tue", Hours: 6 },
    { name: "Wed", Hours: 5 },
    { name: "Thu", Hours: 7 },
    { name: "Fri", Hours: 4 },
    { name: "Sat", Hours: 2 }
  ];

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={defaultData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
          <XAxis 
            dataKey="name" 
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
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: "var(--background)", 
              borderColor: "var(--border-subtle)",
              color: "var(--text-primary)",
              borderRadius: "8px"
            }} 
          />
          <Line type="monotone" dataKey="Hours" stroke="#3b82f6" strokeWidth={3} activeDot={{ r: 8 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AssignmentReviewChart({ assignmentData, height = 260 }: WorkloadChartProps) {
  const defaultData = assignmentData || [
    { name: "Unit-1", Reviewed: 45, Pending: 5 },
    { name: "Unit-2", Reviewed: 42, Pending: 8 },
    { name: "Unit-3", Reviewed: 30, Pending: 20 },
    { name: "Unit-4", Reviewed: 10, Pending: 40 }
  ];

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={defaultData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
          <XAxis 
            dataKey="name" 
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
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: "var(--background)", 
              borderColor: "var(--border-subtle)",
              color: "var(--text-primary)",
              borderRadius: "8px"
            }} 
          />
          <Legend 
            verticalAlign="top" 
            height={36}
            iconType="circle"
            formatter={(value) => <span className="text-[11px] text-text-secondary">{value}</span>}
          />
          <Bar dataKey="Reviewed" stackId="a" fill="#10b981" />
          <Bar dataKey="Pending" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LessonCompletionDoughnut({ completionData, height = 240 }: WorkloadChartProps) {
  const defaultData = completionData || [
    { name: "Completed Lessons", value: 18 },
    { name: "Pending Planners", value: 7 }
  ];

  return (
    <div style={{ width: "100%", height }} className="relative flex items-center justify-center">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={defaultData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={70}
            paddingAngle={4}
            dataKey="value"
          >
            {defaultData.map((entry, index) => (
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
            formatter={(value) => <span className="text-[11px] text-text-secondary">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
