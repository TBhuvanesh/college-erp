"use client";

import React from "react";
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

// ----------------------------------------------------
// Circular Attendance Radial Chart
// ----------------------------------------------------
interface AttendanceRadialChartProps {
  percentage: number;
}

export const AttendanceRadialChart: React.FC<AttendanceRadialChartProps> = ({ percentage }) => {
  const data = [
    {
      name: "Attendance",
      value: percentage,
      fill: percentage >= 75 ? "#34d399" : percentage >= 60 ? "#fbbf24" : "#f87171" // emerald, amber, red
    }
  ];

  return (
    <div className="relative w-28 h-28 flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart 
          cx="50%" 
          cy="50%" 
          innerRadius="75%" 
          outerRadius="100%" 
          barSize={10} 
          data={data} 
          startAngle={90} 
          endAngle={-270}
        >
          <PolarAngleAxis
            type="number"
            domain={[0, 100]}
            angleAxisId={0}
            tick={false}
          />
          <RadialBar
            background={{ fill: 'var(--border-subtle)' }}
            dataKey="value"
            cornerRadius={10}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute flex flex-col items-center justify-center pointer-events-none">
        <span className="font-display text-xl font-bold dark:text-white text-text-primary">{percentage}%</span>
        <span className="text-[9px] text-neutral-500 uppercase tracking-widest font-semibold">ATT</span>
      </div>
    </div>
  );
};

// ----------------------------------------------------
// CGPA Trend Area Chart (Mini)
// ----------------------------------------------------
interface CGPATrendChartProps {
  data: { semester: string; cgpa: number }[];
}

export const CGPATrendChart: React.FC<CGPATrendChartProps> = ({ data }) => {
  return (
    <div className="h-24 w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
          <defs>
            <linearGradient id="colorCgpa" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <Tooltip 
            contentStyle={{ backgroundColor: 'var(--surface-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)', fontSize: '12px', borderRadius: '8px' }}
            itemStyle={{ color: 'var(--accent-blue)' }}
            cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1, strokeDasharray: '4 4' }}
          />
          <XAxis dataKey="semester" hide />
          <YAxis domain={[5, 10]} hide />
          <Area 
            type="monotone" 
            dataKey="cgpa" 
            stroke="#3b82f6" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorCgpa)" 
            animationDuration={1500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
