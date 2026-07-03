"use client";

import React from "react";
import { useSimulation } from "@/context/SimulationContext";
import { BookOpen, Calendar, CheckCircle2 } from "lucide-react";

export default function FacultySubjects() {
  const { faculty, currentFacultyId, students, attendanceLogs } = useSimulation();

  // Find active faculty profile
  const activeFaculty = faculty.find(f => f.id === currentFacultyId) || faculty[0];

  if (!activeFaculty) {
    return <div className="dark:text-neutral-500 text-text-muted font-mono text-center py-10">No active faculty profile loaded.</div>;
  }

  const subjects = activeFaculty.assignedSubjects;

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-display font-bold text-2xl dark:text-white text-text-primary">Teaching Workload</h2>
        <p className="text-xs dark:text-neutral-400 text-text-secondary mt-1">Review active subject codes, student allocations, and historical attendance rates linked to your profile.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {subjects.length > 0 ? (
          subjects.map(sub => {
            // Find student counts in semester who are not archived
            const enrolled = students.filter(s => s.semester === sub.semester && s.status !== "Archived");
            const studCount = enrolled.length;

            // Attendance calculations
            const logs = attendanceLogs.filter(l => l.subjectId === sub.subjectId);
            const totalLogs = logs.length;
            const presentLogs = logs.filter(l => l.status === "Present" || l.status === "Late").length;
            const avgAtt = totalLogs > 0 ? ((presentLogs / totalLogs) * 100).toFixed(0) : "100";

            return (
              <div key={sub.subjectId} className="glass-card border border-border-subtle rounded-xl p-5 flex flex-col justify-between">
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg dark:bg-blue-500/10 bg-blue-50 border dark:border-blue-500/25 border-blue-200 flex items-center justify-center dark:text-blue-400 text-blue-750">
                        <BookOpen size={18} />
                      </div>
                      <div>
                        <h3 className="font-bold dark:text-white text-text-primary text-sm leading-tight">{sub.subjectName}</h3>
                        <span className="text-[10px] dark:text-neutral-500 text-text-muted font-mono mt-0.5 block">Course Code: {sub.subjectId.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Details stats */}
                  <div className="grid grid-cols-3 gap-2 py-3 border-y dark:border-neutral-900 border-border-subtle mb-4 text-center">
                    <div>
                      <span className="text-[9px] dark:text-neutral-500 text-text-muted uppercase font-bold tracking-wide">Semester</span>
                      <span className="block text-xs font-semibold dark:text-white text-text-primary mt-0.5">{sub.semester}</span>
                    </div>
                    <div>
                      <span className="text-[9px] dark:text-neutral-500 text-text-muted uppercase font-bold tracking-wide">Enrolled</span>
                      <span className="block text-xs font-semibold dark:text-white text-text-primary mt-0.5">{studCount} Students</span>
                    </div>
                    <div>
                      <span className="text-[9px] dark:text-neutral-500 text-text-muted uppercase font-bold tracking-wide">Avg Attendance</span>
                      <span className={`block text-xs font-bold mt-0.5 ${parseInt(avgAtt) >= 75 ? "dark:text-emerald-400 text-emerald-700" : "dark:text-rose-400 text-rose-700"}`}>{avgAtt}%</span>
                    </div>
                  </div>

                  {/* Logs indicators */}
                  <div className="flex items-center gap-2 text-[10px] dark:text-neutral-400 text-text-secondary font-mono">
                    <Calendar size={12} className="dark:text-neutral-500 text-text-muted" />
                    <span>Total sessions logged to date: {totalLogs}</span>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t dark:border-neutral-900 border-border-subtle flex items-center justify-between text-[10px] dark:text-neutral-500 text-text-muted font-mono">
                  <span>Class: CSE - {sub.semester}</span>
                  <span className="dark:text-emerald-500 text-emerald-700 flex items-center gap-1 font-sans font-bold">
                    <CheckCircle2 size={12} />
                    <span>Active Syllabus</span>
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full text-center py-10 glass-card border border-border-subtle dark:text-neutral-500 text-text-muted font-mono">
            No subjects assigned to your teaching profile.
          </div>
        )}
      </div>
    </div>
  );
}
