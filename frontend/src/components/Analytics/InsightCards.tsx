"use client";

import React from "react";
import { AlertCircle, TrendingUp, BookOpen, AlertTriangle, GraduationCap, Sparkles } from "lucide-react";

export interface AcademicInsight {
  id: string;
  text: string;
  type: "warning" | "success" | "info" | "danger";
}

interface InsightCardsProps {
  insights?: AcademicInsight[];
}

export const InsightCards: React.FC<InsightCardsProps> = ({ insights }) => {
  // Default mock insights matching the backend-computed examples specified in user request
  const defaultInsights: AcademicInsight[] = [
    {
      id: "ins-1",
      text: "18 students have attendance below 75%",
      type: "danger",
    },
    {
      id: "ins-2",
      text: "AIML attendance increased by 4% this month",
      type: "success",
    },
    {
      id: "ins-3",
      text: "DBMS has highest assignment completion (94.2%)",
      type: "info",
    },
    {
      id: "ins-4",
      text: "23 students have pending academic fees",
      type: "warning",
    },
    {
      id: "ins-5",
      text: "91% of final-year students have applied for internships",
      type: "success",
    },
  ];

  const activeInsights = insights && insights.length > 0 ? insights : defaultInsights;

  const getStyle = (type: AcademicInsight["type"]) => {
    switch (type) {
      case "danger":
        return {
          card: "border-danger/35 dark:border-danger/20 dark:bg-danger-soft/10 bg-danger-soft/30 hover:bg-danger-soft/40 shadow-danger/5",
          icon: "text-danger",
          IconComponent: AlertCircle,
        };
      case "warning":
        return {
          card: "border-warning/35 dark:border-warning/20 dark:bg-warning-soft/10 bg-warning-soft/30 hover:bg-warning-soft/40 shadow-warning/5",
          icon: "text-warning",
          IconComponent: AlertTriangle,
        };
      case "success":
        return {
          card: "border-success/35 dark:border-success/20 dark:bg-success-soft/10 bg-success-soft/30 hover:bg-success-soft/40 shadow-success/5",
          icon: "text-success",
          IconComponent: TrendingUp,
        };
      case "info":
      default:
        return {
          card: "border-accent-blue/35 dark:border-accent-blue/20 dark:bg-accent-blue-soft/10 bg-accent-blue-soft/30 hover:bg-accent-blue-soft/40 shadow-accent-blue/5",
          icon: "text-accent-blue",
          IconComponent: BookOpen,
        };
    }
  };

  return (
    <div className="bg-surface rounded-2xl border border-border-subtle p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
        <Sparkles size={16} className="text-accent-purple" />
        <h3 className="font-display font-bold text-sm text-text-primary">Academic Insights</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeInsights.map((insight) => {
          const { card, icon, IconComponent } = getStyle(insight.type);
          return (
            <div
              key={insight.id}
              className={`flex items-start gap-3 p-4 rounded-xl border transition-all duration-300 hover:scale-[1.01] hover:shadow-md ${card}`}
            >
              <div className={`p-1.5 rounded-lg bg-surface border border-border-subtle flex items-center justify-center shrink-0`}>
                <IconComponent size={15} className={icon} />
              </div>
              <p className="text-xs font-semibold text-text-primary leading-relaxed mt-0.5">
                {insight.text}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
