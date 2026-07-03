"use client";

import React from "react";
import { useParams } from "next/navigation";
import { SubjectLMS } from "@/components/LMS/SubjectLMS";

export default function StudentSubjectLMSPage() {
  const params = useParams();
  const subjectId = params?.subjectId as string;

  if (!subjectId) {
    return <div className="text-center py-10 text-text-muted">Invalid subject identifier.</div>;
  }

  return <SubjectLMS subjectId={subjectId} />;
}
