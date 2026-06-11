import React, { useState } from "react";
import { Mail, AlertCircle, ShieldAlert, Sparkles, User, RefreshCw, Trash2, ArrowRight } from "lucide-react";

interface ThreadSummary {
  id: number;
  thread_id: string;
  subject: string;
  sender_email: string;
  first_seen_at: string;
  last_updated_at: string;
  status: string;
  assigned_to?: string;
  last_email_body?: string;
  email_count: number;
  sentiment_average: number;
}

interface InboxListProps {
  threads: ThreadSummary[];
  selectedThreadId: string | null;
  onSelectThread: (threadId: string, senderEmail: string) => void;
  onRefresh: () => void;
  onBulkAction: (actionType: string) => void;
}

export const InboxList: React.FC<InboxListProps> = ({
  threads,
  selectedThreadId,
  onSelectThread,
  onRefresh,
  onBulkAction,
}) => {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filtering Logic
  const filteredThreads = threads.filter((t) => {
    // 1. Search Query
    const matchesSearch =
      (t.subject || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.sender_email || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.last_email_body || "").toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // 2. Tab filtering
    switch (activeTab) {
      case "needs_human":
        return t.status === "Escalated" || t.status === "Open";
      case "auto_replied":
        return t.status === "Resolved";
      case "escalated":
        return t.status === "Escalated";
      case "spam":
        return t.status === "Ignored" && (t.subject.toLowerCase().includes("spam") || (t.last_email_body || "").toLowerCase().includes("seo"));
      default:
        return true;
    }
  });

  const getSentimentColor = (score: number) => {
    if (score > 0.3) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (score < -0.3) return "bg-rose-500/10 text-rose-400 border-rose-500/20";
    return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Open":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "Resolved":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "Escalated":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      default:
        return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
    }
  };

  const toggleSelect = (threadId: string) => {
    setSelectedIds((prev) =>
      prev.includes(threadId) ? prev.filter((id) => id !== threadId) : [...prev, threadId]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredThreads.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredThreads.map((t) => t.thread_id));
    }
  };

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border border-border overflow-hidden">
      {/* Inbox Header Controls */}
      <div className="p-4 border-b border-border flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-accent" />
            <h2 className="title-font font-bold text-lg">Mission Control Inbox</h2>
            <span className="bg-primary/20 text-primary-foreground text-xs px-2 py-0.5 rounded-full font-semibold">
              {filteredThreads.length}
            </span>
          </div>
          <button
            onClick={onRefresh}
            className="p-1.5 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground"
            title="Refresh Inbox"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search subject, body, or sender..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-background/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
        />

        {/* Bulk Actions */}
        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between bg-secondary/50 p-2 rounded-lg border border-border fade-in">
            <span className="text-xs text-muted-foreground">{selectedIds.length} threads selected</span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onBulkAction("Spam");
                  setSelectedIds([]);
                }}
                className="text-xs flex items-center gap-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded hover:bg-rose-500/20 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" /> Mark Spam
              </button>
              <button
                onClick={() => {
                  onBulkAction("Resolve");
                  setSelectedIds([]);
                }}
                className="text-xs flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded hover:bg-emerald-500/20 transition-all"
              >
                Resolve
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-background/30 text-sm">
        {["all", "needs_human", "auto_replied", "escalated", "spam"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 border-b-2 text-xs font-semibold capitalize transition-all ${
              activeTab === tab
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/20"
            }`}
          >
            {tab.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Thread list scroll viewport */}
      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {filteredThreads.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
            <Mail className="w-8 h-8 text-muted/30" />
            <p className="text-sm">No conversations match the filters.</p>
          </div>
        ) : (
          filteredThreads.map((t) => {
            const isSelected = selectedThreadId === t.thread_id;
            const isChecked = selectedIds.includes(t.thread_id);

            return (
              <div
                key={t.thread_id}
                className={`p-4 flex gap-3 cursor-pointer hover:bg-secondary/40 transition-all border-l-2 ${
                  isSelected ? "bg-secondary/60 border-primary" : "border-transparent"
                }`}
                onClick={() => onSelectThread(t.thread_id, t.sender_email)}
              >
                {/* Checkbox select */}
                <div
                  className="pt-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelect(t.thread_id);
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    readOnly
                    className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary accent-primary bg-background/50 cursor-pointer"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  {/* Sender & Timestamp */}
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-semibold text-xs text-foreground truncate">{t.sender_email}</span>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {new Date(t.last_updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Subject line */}
                  <h4 className="font-semibold text-sm truncate text-white mb-1">{t.subject || "(No Subject)"}</h4>

                  {/* Snippet body */}
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2 leading-relaxed">
                    {t.last_email_body || "Empty body"}
                  </p>

                  {/* Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusBadge(t.status)}`}>
                      {t.status}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${getSentimentColor(t.sentiment_average || 0)}`}>
                      Sent: {(t.sentiment_average || 0) >= 0.1 ? "+" : ""}{(t.sentiment_average || 0).toFixed(1)}
                    </span>
                    {t.email_count > 1 && (
                      <span className="text-[10px] bg-secondary text-muted-foreground border border-border px-2 py-0.5 rounded">
                        {t.email_count} emails
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col justify-center">
                  <ArrowRight className={`w-4 h-4 text-muted-foreground transition-transform ${isSelected ? "translate-x-1 text-primary" : ""}`} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
