"use client";

import { MessageSquare, Star } from "lucide-react";

interface Comment {
  id: string;
  text_value: string;
  rating_value?: number;
  created_at?: string;
  subject_name?: string;
}

interface AnonymousCommentListProps {
  comments: Comment[];
  title?: string;
}

export function AnonymousCommentList({ comments, title = "Anonymous Student Comments" }: AnonymousCommentListProps) {
  if (!comments || comments.length === 0) {
    return (
      <div className="rounded-xl border border-border-subtle bg-surface p-6 text-center text-text-muted">
        <MessageSquare className="mx-auto h-8 w-8 opacity-40 mb-2" />
        <p className="text-sm">No comments submitted yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="font-display font-bold text-sm text-text-primary uppercase tracking-wider mb-2">
        {title} ({comments.length})
      </h3>
      <div className="max-h-[380px] overflow-y-auto pr-1 space-y-3 custom-scrollbar">
        {comments.map((comment, index) => (
          <div 
            key={comment.id || index}
            className="group relative overflow-hidden rounded-xl border border-border-subtle bg-surface p-4 transition-all hover:border-border-hover"
          >
            {/* Top border accent depending on rating */}
            {comment.rating_value && (
              <div 
                className={`absolute top-0 left-0 right-0 h-[3px] opacity-70 ${
                  comment.rating_value >= 4 
                    ? "bg-emerald-500" 
                    : comment.rating_value >= 3 
                    ? "bg-blue-500" 
                    : "bg-amber-500"
                }`}
              />
            )}
            
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800 text-xs font-bold text-text-muted">
                  A
                </span>
                <div>
                  <p className="text-xs font-semibold text-text-primary">Anonymous Student</p>
                  {comment.subject_name && (
                    <p className="text-[10px] text-accent-blue font-medium">{comment.subject_name}</p>
                  )}
                </div>
              </div>
              
              {comment.rating_value && (
                <div className="flex items-center gap-1 rounded-md bg-neutral-50 dark:bg-neutral-900 border border-border-subtle px-1.5 py-0.5 text-xs font-bold text-text-secondary">
                  <span>{comment.rating_value}</span>
                  <Star className="h-3.5 w-3.5 fill-amber-400 stroke-amber-400" />
                </div>
              )}
            </div>
            
            <p className="mt-3 text-sm text-text-secondary whitespace-pre-line leading-relaxed">
              "{comment.text_value}"
            </p>
            
            {comment.created_at && (
              <p className="mt-2 text-[10px] text-text-muted text-right font-medium">
                Submitted on {new Date(comment.created_at).toLocaleDateString()}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
