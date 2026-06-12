import React, { useState, useEffect } from "react";
import { User, DollarSign, Activity, FileText, ChevronDown, ChevronUp, CheckCircle, Send, AlertTriangle, ShieldCheck, HelpCircle, Save, Sparkles } from "lucide-react";


interface EmailDetail {
  id: number;
  thread_id: string;
  message_id: string;
  sender: string;
  subject: string;
  body: string;
  timestamp: string;
  sentiment_score: number;
  category: string;
  urgency: string;
  requires_human: boolean;
  confidence: number;
  raw_entities: any;
  status: string;
}

interface ActionDetail {
  id: number;
  email_id: number;
  agent_reasoning_log: Array<{ thought: string; action: string; observation: string }>;
  action_type: string;
  proposed_content?: string;
  is_approved: boolean;
  approved_by?: string;
  executed_at?: string;
}

interface ContactProfile {
  id: number;
  email: string;
  name: string;
  company: string;
  status: string;
  account_value: number;
  churn_risk_score: number;
}

interface ThreadWorkspaceProps {
  threadId: string;
  senderEmail: string;
  backendUrl: string;
  onActionComplete: () => void;
}

export const ThreadWorkspace: React.FC<ThreadWorkspaceProps> = ({
  threadId,
  senderEmail,
  backendUrl,
  onActionComplete,
}) => {
  const [emails, setEmails] = useState<EmailDetail[]>([]);
  const [contact, setContact] = useState<ContactProfile | null>(null);
  const [actions, setActions] = useState<ActionDetail[]>([]);
  const [reputation, setReputation] = useState<any>(null);
  const [threadSummary, setThreadSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // UI states
  const [isReasoningOpen, setIsReasoningOpen] = useState<boolean>(true);
  const [isRagOpen, setIsRagOpen] = useState<boolean>(true);
  const [draftContent, setDraftContent] = useState<string>("");
  const [isEditingDraft, setIsEditingDraft] = useState<boolean>(false);
  const [customReplyMode, setCustomReplyMode] = useState<boolean>(false);
  const [customReplyText, setCustomReplyText] = useState<string>("");

  useEffect(() => {
    fetchThreadDetails();
  }, [threadId]);

  const fetchThreadDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch thread and emails
      const threadRes = await fetch(`${backendUrl}/threads/${senderEmail}`);
      if (!threadRes.ok) throw new Error("Failed to load thread timeline.");
      const threadsData = await threadRes.json();
      const activeThread = threadsData.find((t: any) => t.thread_id === threadId);
      
      if (activeThread) {
        setEmails(activeThread.emails || []);
        setThreadSummary(activeThread.summary || null);
      } else {
        setEmails([]);
        setThreadSummary(null);
      }

      // 2. Fetch Contact profile
      const contactRes = await fetch(`${backendUrl}/contacts/${senderEmail}`);
      if (contactRes.ok) {
        const contactData = await contactRes.json();
        setContact(contactData);
        
        // Trigger scraping fetch if conditions met
        if (contactData && contactData.company) {
          fetchReputation(contactData.company);
        }
      } else {
        setContact(null);
      }

      // 3. Fetch actions for the latest email in the thread
      if (activeThread && activeThread.emails && activeThread.emails.length > 0) {
        // Sort by date to find the latest
        const sortedEmails = [...activeThread.emails].sort(
          (a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        const latest = sortedEmails[sortedEmails.length - 1];
        
        const actionRes = await fetch(`${backendUrl}/actions/${latest.id}`);
        if (actionRes.ok) {
          const actionData = await actionRes.json();
          const safeActions = Array.isArray(actionData) ? actionData : [];
          setActions(safeActions);
          if (safeActions.length > 0 && safeActions[0].proposed_content) {
            setDraftContent(safeActions[0].proposed_content);
          } else {
            setDraftContent("");
          }
        } else {
          setActions([]);
          setDraftContent("");
        }
      } else {
        setActions([]);
        setDraftContent("");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load thread workspace.");
    } finally {
      setLoading(false);
    }
  };

  const fetchReputation = async (company: string) => {
    try {
      const res = await fetch(`${backendUrl}/intelligence/reputation?company=${encodeURIComponent(company)}`);
      if (res.ok) {
        const repData = await res.json();
        setReputation(repData.intelligence);
      }
    } catch (e) {
      console.error("Failed to fetch reputation data:", e);
    }
  };

  // Highlight entities (e.g. monetary amounts, ticket IDs, order numbers, deadlines)
  const renderHighlightedBody = (textBody: string) => {
    if (!textBody) return "";
    
    // Regular Expressions for highlighting
    const entities = [
      { regex: /(\$\d+(?:,\d{3})*(?:\.\d{2})?)/g, style: "underline decoration-amber-500 decoration-2 text-amber-300 font-semibold" }, // Dollars - underlined in amber
      { regex: /((?:ticket|ticket\s*#)\s*\d+)/gi, style: "bg-blue-500/20 text-blue-300 font-semibold px-1 rounded" }, // Tickets - blue highlight
      { regex: /((?:order|order\s*#)\s*\d+)/gi, style: "bg-emerald-500/20 text-emerald-300 font-semibold px-1 rounded" }, // Orders - green highlight
      { regex: /((?:30-day statutory window|statutory 30-day window|30-day window|48\s*hours|oct(?:ober)?\s*\d+(?:st|nd|rd|th)?|dec(?:ember)?\s*\d+(?:st|nd|rd|th)?))/gi, style: "bg-purple-500/20 text-purple-300 font-semibold px-1 rounded" }, // Dates/Deadlines - purple highlight
      { regex: /(2\s*btc)/gi, style: "underline decoration-rose-500 decoration-2 text-rose-300 font-semibold" } // Crypto (Monetary) - underlined in red
    ];

    let html = escapeHtml(textBody);
    entities.forEach((entity) => {
      // Need to adjust match to prevent replacing html tags
      html = html.replace(entity.regex, `<span class="${entity.style}">$1</span>`);
    });

    return <div className="whitespace-pre-wrap leading-relaxed text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const escapeHtml = (text: string) => {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  // Draft updates & approvals
  const handleUpdateDraft = async () => {
    if (!actions || actions.length === 0) return;
    const actionId = actions[0].id;
    try {
      const res = await fetch(`${backendUrl}/drafts/${actionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposed_content: draftContent }),
      });
      if (!res.ok) throw new Error("Failed to save draft.");
      setIsEditingDraft(false);
      alert("Draft updated successfully.");
      fetchThreadDetails();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleApproveDraft = async () => {
    if (!actions || actions.length === 0) return;
    const actionId = actions[0].id;
    try {
      const res = await fetch(`${backendUrl}/drafts/${actionId}/approve`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to approve and send.");
      alert("Auto-reply approved and dispatched!");
      onActionComplete();
      fetchThreadDetails();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleCustomResponse = async () => {
    if (!emails || emails.length === 0) return;
    // Find latest email ID
    const sorted = [...emails].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const latest = sorted[sorted.length - 1];

    try {
      const res = await fetch(`${backendUrl}/respond/${latest.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: customReplyText }),
      });
      if (!res.ok) throw new Error("Failed to send custom response.");
      alert("Reply sent successfully!");
      setCustomReplyText("");
      setCustomReplyMode(false);
      onActionComplete();
      fetchThreadDetails();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleMarkSpam = async () => {
    if (!emails || emails.length === 0) return;
    try {
      const res = await fetch(`${backendUrl}/contacts/${senderEmail}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Blocked" }),
      });
      if (!res.ok) throw new Error("Failed to update contact status.");
      alert("Sender has been blocked and marked as Spam.");
      onActionComplete();
      fetchThreadDetails();
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex justify-center items-center h-full bg-card rounded-xl border border-border">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-muted-foreground">Analyzing Thread Workspace...</span>
        </div>
      </div>
    );
  }

  if (error || !emails || emails.length === 0) {
    return (
      <div className="flex-1 flex justify-center items-center h-full bg-card rounded-xl border border-border p-6 text-center">
        <div>
          <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
          <p className="text-foreground font-semibold">{error || "No active thread selected."}</p>
          <p className="text-xs text-muted-foreground mt-1">Select an item from your Mission Control Inbox.</p>
        </div>
      </div>
    );
  }

  // Identify latest email in the thread
  const sortedEmails = [...(emails || [])].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const activeTriageEmail = sortedEmails[sortedEmails.length - 1];

  const getSentimentBadge = (score: number) => {
    const safeScore = score || 0;
    if (safeScore > 0.3) return "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20";
    if (safeScore < -0.3) return "text-rose-400 bg-rose-500/10 border border-rose-500/20";
    return "text-amber-400 bg-amber-500/10 border border-amber-500/20";
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full gap-4 overflow-hidden">
      
      {/* LEFT & CENTER PANEL (Timeline and body highlights) */}
      <div className="flex-1 flex flex-col bg-card rounded-xl border border-border overflow-hidden">
        
        {/* Timeline Header */}
        <div className="p-4 border-b border-border bg-secondary/20 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-accent">Active Conversation</span>
            <span className={`text-xs px-2.5 py-0.5 rounded font-semibold uppercase ${
              (activeTriageEmail.urgency || "Medium") === "Critical" ? "bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse" :
              (activeTriageEmail.urgency || "Medium") === "High" ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" : "bg-blue-500/20 text-blue-400"
            }`}>
              {activeTriageEmail.urgency || "Medium"} Urgency
            </span>
          </div>
          <h3 className="title-font font-bold text-lg text-white truncate">{activeTriageEmail.subject || "(No Subject)"}</h3>
        </div>

        {/* Message Chronological Timeline */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-background/20">
          
          {/* Executive Summary Banner */}
          {threadSummary && (
            <div className="bg-primary/10 border border-primary/30 p-3.5 rounded-lg flex flex-col gap-1.5 neon-glow-primary mb-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-primary flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" /> Executive AI Summary (3-Sentences)
              </span>
              <p className="text-xs text-slate-300 italic leading-relaxed">
                "{threadSummary}"
              </p>
            </div>
          )}

          {sortedEmails.map((e, idx) => (
            <div key={e.id} className={`flex flex-col p-4 rounded-lg border transition-all ${
              e.sender === "support@mycompany.com" 
                ? "bg-primary/5 border-primary/20 ml-8" 
                : "bg-secondary/20 border-border mr-8"
            }`}>
              <div className="flex items-center justify-between gap-1 mb-2 border-b border-border/50 pb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-semibold text-xs text-foreground truncate">{e.sender}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-1.5 rounded font-medium ${getSentimentBadge(e.sentiment_score)}`}>
                    Sentiment: {(e.sentiment_score || 0).toFixed(1)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {e.timestamp ? new Date(e.timestamp).toLocaleString() : ""}
                  </span>
                </div>
              </div>
              
              {/* Highlighted text body */}
              <div className="text-muted-foreground">
                {renderHighlightedBody(e.body)}
              </div>
            </div>
          ))}
        </div>

        {/* Action Controls / Auto-Reply Proposal Box */}
        <div className="p-4 border-t border-border bg-secondary/35">
          {customReplyMode ? (
            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-semibold text-primary">Custom Human Response Mode</span>
              <textarea
                value={customReplyText}
                onChange={(e) => setCustomReplyText(e.target.value)}
                placeholder="Write your email reply here..."
                rows={4}
                className="w-full bg-background border border-border rounded-lg p-3 text-sm focus:outline-none focus:border-primary transition-colors text-white"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setCustomReplyMode(false)}
                  className="text-xs bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded hover:bg-zinc-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCustomResponse}
                  className="text-xs flex items-center gap-1.5 bg-primary text-white px-4 py-1.5 rounded hover:bg-primary/90 transition-all font-semibold"
                >
                  <Send className="w-3.5 h-3.5" /> Dispatch Reply
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* If an Agent proposed draft exists */}
              {actions && actions.length > 0 && actions[0].action_type === "Auto-Reply" && !actions[0].is_approved && (
                <div className="bg-secondary/40 p-3 rounded-lg border border-primary/20 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-accent flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Agent Proposed Response
                    </span>
                    <button
                      onClick={() => setIsEditingDraft(!isEditingDraft)}
                      className="text-xs text-primary font-semibold hover:underline"
                    >
                      {isEditingDraft ? "Viewing Mode" : "Edit Draft"}
                    </button>
                  </div>
                  {isEditingDraft ? (
                    <textarea
                      value={draftContent}
                      onChange={(e) => setDraftContent(e.target.value)}
                      rows={5}
                      className="w-full bg-background border border-border rounded p-2 text-xs focus:outline-none focus:border-accent text-white"
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap bg-background/30 p-2.5 rounded border border-border/50 max-h-40 overflow-y-auto">
                      {draftContent}
                    </p>
                  )}
                  {isEditingDraft && (
                    <button
                      onClick={handleUpdateDraft}
                      className="self-end text-xs flex items-center gap-1 bg-accent/20 text-accent border border-accent/30 px-3 py-1 rounded hover:bg-accent/30"
                    >
                      <Save className="w-3 h-3" /> Save Changes
                    </button>
                  )}
                </div>
              )}

              {/* General Control Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex gap-2">
                  {actions && actions.length > 0 && actions[0].action_type === "Auto-Reply" && !actions[0].is_approved && (
                    <button
                      onClick={handleApproveDraft}
                      className="text-xs flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-500 transition-all font-semibold"
                    >
                      <CheckCircle className="w-4 h-4" /> Approve & Send
                    </button>
                  )}
                  <button
                    onClick={() => setCustomReplyMode(true)}
                    className="text-xs bg-primary/20 text-primary border border-primary/30 px-4 py-2 rounded-lg hover:bg-primary/30 transition-all font-semibold"
                  >
                    Custom Reply
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleMarkSpam}
                    className="text-xs bg-rose-600/10 text-rose-400 border border-rose-600/20 px-3.5 py-2 rounded-lg hover:bg-rose-600/25 transition-all font-medium"
                  >
                    Mark Spam
                  </button>
                  <button
                    onClick={async () => {
                      alert("Paging CSM Team. Routing escalation ticket...");
                      onActionComplete();
                    }}
                    className="text-xs bg-amber-600/15 text-amber-400 border border-amber-600/25 px-3.5 py-2 rounded-lg hover:bg-amber-600/25 transition-all font-medium"
                  >
                    Escalate to Human
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL (Contact profile, Agent reasoning log, RAG chunks, Web Rep) */}
      <div className="w-full lg:w-80 flex flex-col gap-4 overflow-y-auto min-h-0">
        
        {/* Contact Profile Card */}
        {contact && (
          <div className="bg-card rounded-xl border border-border p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <User className="w-4 h-4 text-accent" />
              <h4 className="text-sm font-bold text-white">Contact CRM Profile</h4>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground block">Name</span>
                <span className="font-semibold text-white">{contact.name || "N/A"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Status</span>
                <span className={`font-semibold ${contact.status === "VIP" ? "text-amber-400" : "text-foreground"}`}>
                  {contact.status || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Company</span>
                <span className="font-semibold text-white">{contact.company || "N/A"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Value</span>
                <span className="font-semibold text-emerald-400">${(contact.account_value || 0).toLocaleString()}</span>
              </div>
            </div>
            
            <div className="mt-1 border-t border-border/50 pt-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">CS Churn Risk:</span>
              <span className={`font-bold px-2 py-0.5 rounded ${
                (contact.churn_risk_score || 0) > 0.7 ? "bg-rose-500/10 text-rose-400" :
                (contact.churn_risk_score || 0) > 0.3 ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400"
              }`}>
                {((contact.churn_risk_score || 0) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        )}

        {/* Reputation Web Intelligence Cache summary */}
        {reputation && (
          <div className="bg-card rounded-xl border border-border p-4 flex flex-col gap-2.5">
            <div className="flex items-center justify-between border-b border-border pb-1.5">
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-accent" />
                <h4 className="text-sm font-bold text-white">Web Intelligence</h4>
              </div>
              <span className="text-[9px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded">
                Robots.txt OK
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">G2 / Trustpilot score:</span>
              <span className="font-bold text-amber-400">{reputation.rating || "N/A"} / 5.0</span>
            </div>
            <div className="text-xs">
              <span className="text-muted-foreground block mb-1">Common Complaint Themes:</span>
              <ul className="list-disc list-inside text-rose-300 text-[11px] space-y-0.5">
                {reputation.complaint_themes?.map((t: string, i: number) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed bg-background/50 p-2 rounded">
              {reputation.summary}
            </p>
          </div>
        )}

        {/* Agent Collapsible Reasoning Trace */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <button
            onClick={() => setIsReasoningOpen(!isReasoningOpen)}
            className="w-full p-4 flex items-center justify-between border-b border-border bg-secondary/10 hover:bg-secondary/20 transition-all"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h4 className="text-sm font-bold text-white">Agent Reasoning Trace</h4>
            </div>
            {isReasoningOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {isReasoningOpen && (
            <div className="p-4 flex flex-col gap-3.5 max-h-96 overflow-y-auto text-xs bg-background/10">
              {!actions || actions.length === 0 || !actions[0].agent_reasoning_log || !Array.isArray(actions[0].agent_reasoning_log) || actions[0].agent_reasoning_log.length === 0 ? (
                <span className="text-muted-foreground">No agent reasoning steps recorded yet.</span>
              ) : (
                actions[0].agent_reasoning_log.map((step, idx) => {
                  const match = (step.thought || "").match(/^\[(.*?)\] (.*)$/s);
                  const agentName = match ? match[1] : "Coordinator Agent";
                  const thoughtText = match ? match[2] : (step.thought || "N/A");
                  
                  const getAgentBadgeColor = (name: string) => {
                    if (name.includes("Classifier")) return "bg-blue-500/10 text-blue-300 border-blue-500/20";
                    if (name.includes("Research")) return "bg-purple-500/10 text-purple-300 border-purple-500/20";
                    if (name.includes("Reply")) return "bg-emerald-500/10 text-emerald-300 border-emerald-500/20";
                    return "bg-amber-500/10 text-amber-300 border-amber-500/20";
                  };

                  return (
                    <div key={idx} className="flex flex-col gap-1.5 border-l-2 border-primary/30 pl-3 relative">
                      <div className="w-2 h-2 rounded-full bg-primary absolute -left-[5px] top-1.5"></div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold text-[10px] uppercase tracking-wide text-primary">
                          Step {idx + 1}
                        </span>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${getAgentBadgeColor(agentName)}`}>
                          {agentName}
                        </span>
                      </div>
                      <div>
                        <span className="text-amber-400 font-medium">Thought:</span>{" "}
                        <span className="text-muted-foreground leading-relaxed">{thoughtText}</span>
                      </div>
                      <div>
                        <span className="text-emerald-400 font-medium">Action:</span>{" "}
                        <code className="text-emerald-300 font-mono text-[10px] bg-secondary/80 px-1 py-0.5 rounded">
                          {step.action || "N/A"}
                        </code>
                      </div>
                      <div>
                        <span className="text-blue-400 font-medium">Observation:</span>{" "}
                        <span className="text-muted-foreground text-[11px] leading-relaxed italic">
                          {step.observation || "N/A"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Collapsible RAG Chunks Panel */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <button
            onClick={() => setIsRagOpen(!isRagOpen)}
            className="w-full p-4 flex items-center justify-between border-b border-border bg-secondary/10 hover:bg-secondary/20 transition-all"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent" />
              <h4 className="text-sm font-bold text-white">RAG Context Reference</h4>
            </div>
            {isRagOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {isRagOpen && (
            <div className="p-4 flex flex-col gap-3.5 max-h-96 overflow-y-auto text-xs bg-background/10">
              {!emails || emails.length === 0 || !activeTriageEmail ? (
                <span className="text-muted-foreground">Select an active email to load references.</span>
              ) : (
                <RagViewLoader backendUrl={backendUrl} query={`${activeTriageEmail.subject || ""} ${activeTriageEmail.body || ""}`} />
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

// Sub-component to fetch and render RAG context asynchronously to avoid main component block
const RagViewLoader: React.FC<{ backendUrl: string; query: string }> = ({ backendUrl, query }) => {
  const [chunks, setChunks] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    const fetchChunks = async () => {
      try {
        const res = await fetch(`${backendUrl}/rag/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          if (active) setChunks(data.results || []);
        }
      } catch (e) {
        console.error("Failed to fetch RAG chunks in sidebar:", e);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchChunks();
    return () => { active = false; };
  }, [query]);

  if (loading) return <span className="text-muted-foreground">Loading RAG references...</span>;
  if (!chunks || chunks.length === 0) return <span className="text-muted-foreground">No RAG references retrieved.</span>;

  return (
    <>
      {chunks.map((chunk, i) => (
        <div key={i} className="bg-secondary/20 border border-border p-2.5 rounded-lg flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[10px] font-bold text-accent">
            <span>Doc: {chunk.source_doc || "Unknown"}</span>
            <span className="text-emerald-400">Match: {((chunk.similarity || 0) * 100).toFixed(0)}%</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed italic bg-background/30 p-1.5 rounded border border-border/30">
            "{chunk.chunk_text || ""}"
          </p>
        </div>
      ))}
    </>
  );
};
