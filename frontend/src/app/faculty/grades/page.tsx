"use client";

import React, { useState, useEffect } from "react";
import { useSimulation } from "@/context/SimulationContext";
import { GraduationCap, BookOpen, AlertCircle, FileText, Sparkles } from "lucide-react";

export default function FacultyGrades() {
  const { faculty, currentFacultyId, students, submitGrades, grades } = useSimulation();

  // Find active faculty profile
  const activeFaculty = faculty.find(f => f.id === currentFacultyId) || faculty[0];

  const subjects = activeFaculty?.assignedSubjects || [];

  // States
  const [selectedSubjId, setSelectedSubjId] = useState(subjects[0]?.subjectId || "");
  const [examType, setExamType] = useState<"Midterm" | "Final">("Midterm");
  const [maxMarks, setMaxMarks] = useState(100);
  const [roster, setRoster] = useState<{ studentId: string; name: string; rollNo: string; marks: string }[]>([]);
  const [toastMsg, setToastMsg] = useState("");

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  const activeSubject = subjects.find(s => s.subjectId === selectedSubjId);

  // Populate grade inputs based on students in semester
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeSubject) {
        const enrolled = students.filter(s => s.semester === activeSubject.semester && s.status === "Good Standing");
        
        // Look up if grades are already submitted in context
        const existingGrades = grades.filter(
          g => g.subjectId === selectedSubjId && g.type === examType
        );

        const initialRoster = enrolled.map(stud => {
          const found = existingGrades.find(g => g.studentId === stud.id);
          return {
            studentId: stud.id,
            name: stud.name,
            rollNo: stud.rollNo,
            marks: found ? found.marks.toString() : ""
          };
        });

        setRoster(initialRoster);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedSubjId, examType, students, grades, activeSubject]);

  const handleMarksChange = (studId: string, val: string) => {
    setRoster(prev =>
      prev.map(item => (item.studentId === studId ? { ...item, marks: val } : item))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSubject) return;

    // Validate scores are in range and entered
    const invalid = roster.some(item => {
      const parsed = parseFloat(item.marks);
      return isNaN(parsed) || parsed < 0 || parsed > maxMarks;
    });

    if (invalid) {
      alert(`Please ensure all fields are filled with scores between 0 and ${maxMarks}.`);
      return;
    }

    const payload = roster.map(item => ({
      subjectId: activeSubject.subjectId,
      subjectName: activeSubject.subjectName,
      studentId: item.studentId,
      type: examType,
      marks: parseFloat(item.marks),
      maxMarks: maxMarks
    }));

    submitGrades(payload);
    triggerToast(`Internal marks published for ${activeSubject.subjectName} (${examType})!`);
  };

  if (!activeFaculty) {
    return <div className="dark:text-neutral-500 text-text-muted font-mono text-center py-10">No active faculty profile loaded.</div>;
  }

  return (
    <div className="relative">
      
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xl shadow-emerald-600/20 border border-emerald-400/20 animate-fade-in">
          <Sparkles size={14} className="animate-pulse" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="font-display font-bold text-2xl dark:text-white text-text-primary">Internal Marks Register</h2>
          <p className="text-xs dark:text-neutral-400 text-text-secondary mt-1">Upload raw evaluation marks for student midterms and finals. Released marks convert to letter grades instantly.</p>
        </div>
      </div>

      {/* Selections Controls Card */}
      <div className="glass-card border border-border-subtle rounded-xl p-4 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Subject */}
        <div className="flex items-center gap-2 dark:bg-neutral-955 bg-surface border dark:border-neutral-850 border-border-subtle rounded px-2 text-xs dark:text-white text-text-primary">
          <BookOpen size={12} className="text-blue-400" />
          <span className="dark:text-neutral-500 text-text-muted">Subject:</span>
          <select
            value={selectedSubjId}
            onChange={e => setSelectedSubjId(e.target.value)}
            className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2.5 flex-1 focus:outline-none font-bold"
          >
            {subjects.map(sub => (
              <option key={sub.subjectId} value={sub.subjectId} className="dark:bg-neutral-950 bg-surface dark:text-white text-text-primary">
                {sub.subjectName}
              </option>
            ))}
          </select>
        </div>

        {/* Exam Type */}
        <div className="flex items-center gap-2 dark:bg-neutral-955 bg-surface border dark:border-neutral-855 border-border-subtle rounded px-2 text-xs dark:text-white text-text-primary">
          <FileText size={12} className="text-blue-400" />
          <span className="dark:text-neutral-505 text-text-muted">Evaluation:</span>
          <select
            value={examType}
            onChange={e => setExamType(e.target.value as any)}
            className="bg-transparent dark:text-white text-text-primary cursor-pointer py-2.5 flex-1 focus:outline-none font-bold"
          >
            <option value="Midterm">Midterm Examination</option>
            <option value="Final">Final Examination</option>
          </select>
        </div>

        {/* Max Marks */}
        <div className="flex items-center gap-2 dark:bg-neutral-955 bg-surface border dark:border-neutral-855 border-border-subtle rounded px-2.5 text-xs dark:text-white text-text-primary">
          <GraduationCap size={12} className="text-blue-400" />
          <span className="dark:text-neutral-505 text-text-muted">Max Score:</span>
          <input
            type="number"
            value={maxMarks}
            onChange={e => setMaxMarks(parseInt(e.target.value) || 100)}
            className="bg-transparent dark:text-white text-text-primary font-bold w-16 focus:outline-none text-center"
          />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Data spreadsheet grid table */}
        <div className="glass-card border border-border-subtle rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="dark:bg-neutral-900/50 bg-neutral-100/50 border-b border-border-subtle dark:text-neutral-400 text-text-secondary font-semibold">
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3 font-mono">Roll Number</th>
                <th className="px-4 py-3">Maximum Marks</th>
                <th className="px-4 py-3">Obtained Marks</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-neutral-900 divide-border-subtle dark:text-neutral-300 text-text-secondary">
              {roster.length > 0 ? (
                roster.map(student => {
                  const val = parseFloat(student.marks);
                  const isErr = student.marks !== "" && (isNaN(val) || val < 0 || val > maxMarks);
                  return (
                    <tr key={student.studentId} className="dark:hover:bg-neutral-900/30 hover:bg-neutral-100/50 transition">
                      <td className="px-4 py-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full dark:bg-neutral-800 bg-neutral-100 border dark:border-neutral-700 border-border-subtle flex items-center justify-center font-bold text-blue-400">
                          {student.name.charAt(0)}
                        </div>
                        <span className="font-semibold dark:text-white text-text-primary">{student.name}</span>
                      </td>
                      <td className="px-4 py-3 font-mono">{student.rollNo}</td>
                      <td className="px-4 py-3 dark:text-neutral-500 text-text-muted">{maxMarks}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            placeholder="Score"
                            value={student.marks}
                            onChange={e => handleMarksChange(student.studentId, e.target.value)}
                            className={`w-24 px-2 py-1 dark:bg-neutral-950 bg-background border dark:text-white text-text-primary rounded text-xs font-semibold focus:outline-none ${
                              isErr ? "border-rose-500 ring-1 ring-rose-500/25" : "dark:border-neutral-850 border-border-subtle"
                            }`}
                          />
                          {isErr && (
                            <span className="text-[10px] text-rose-500 flex items-center gap-0.5">
                              <AlertCircle size={10} />
                              <span>Over max!</span>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="text-center py-10 dark:text-neutral-500 text-text-muted font-mono text-xs">
                    No students enrolled in this semester batch. Add some students in the Admin Portal!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Action button submission */}
        {roster.length > 0 && (
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-lg shadow-blue-600/25 cursor-pointer transition"
            >
              Publish Internal Marks
            </button>
          </div>
        )}

      </form>
    </div>
  );
}
