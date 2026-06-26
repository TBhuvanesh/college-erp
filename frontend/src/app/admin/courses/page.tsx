"use client";

import React, { useState } from "react";
import { useSimulation } from "@/context/SimulationContext";
import { BookOpen, FolderOpen, Calendar, HelpCircle, AlertCircle } from "lucide-react";

export default function AdminCourses() {
  const { courses } = useSimulation();

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-display font-bold text-2xl text-white">Course Configurator</h2>
        <p className="text-xs text-neutral-400 mt-1">Configure institutional departments, program semesters, and academic credit weight distributions.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Course Nesting Tree View */}
        <div className="lg:col-span-2 space-y-4">
          {courses.map(course => (
            <div key={course.id} className="glass-card border border-neutral-800 rounded-xl p-5">
              
              {/* Course Title bar */}
              <div className="flex items-center gap-3 border-b border-neutral-800 pb-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
                  <FolderOpen size={16} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-white text-base leading-tight">{course.name}</h3>
                  <span className="text-[10px] text-neutral-500 font-mono mt-0.5 block">Course Code: {course.id.toUpperCase()} / Dept: {course.department}</span>
                </div>
              </div>

              {/* Semesters list */}
              <div className="space-y-4">
                {course.semesters.map(sem => (
                  <div key={sem.semesterNumber} className="border-l-2 border-l-indigo-600 pl-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar size={12} className="text-indigo-400" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">{sem.semesterNumber}</h4>
                    </div>

                    {/* Subjects table/list */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {sem.subjects.map(sub => (
                        <div key={sub.id} className="p-3 bg-neutral-950/40 border border-neutral-900 rounded-lg flex items-center justify-between text-xs hover:border-indigo-500/30 transition-all">
                          <div>
                            <span className="font-bold text-white block">{sub.name}</span>
                            <span className="text-[9px] text-neutral-500 font-mono mt-0.5 block">Subject ID: {sub.id.toUpperCase()}</span>
                          </div>
                          <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full px-2 py-0.5 font-bold">
                            {sub.credits} Credits
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

            </div>
          ))}
        </div>

        {/* Informational Guidelines Panel */}
        <div className="space-y-4">
          <div className="glass-card border border-neutral-800 rounded-xl p-5">
            <h4 className="font-display font-bold text-white text-sm flex items-center gap-2 mb-3">
              <AlertCircle size={16} className="text-indigo-400" />
              <span>Curriculum Guidelines</span>
            </h4>
            <div className="space-y-3 text-xs text-neutral-400 leading-normal">
              <p>
                All student registrations automatically inherit the subject templates defined inside this configuration catalog.
              </p>
              <ul className="list-disc pl-4 space-y-1.5 text-[11px] text-neutral-500">
                <li>Subjects are mapped to standard course codes.</li>
                <li>Credit points weigh final SGPA averages.</li>
                <li>Modifying course mappings updates active faculty attendance roster grids immediately.</li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
