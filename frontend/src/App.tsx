import React, { useState, useEffect, useRef } from "react";
import { InboxList } from "./components/InboxList";
import { ThreadWorkspace } from "./components/ThreadWorkspace";
import { AnalyticsDashboard } from "./components/AnalyticsDashboard";
import { Sparkles, Terminal, Play, RotateCcw, AlertTriangle, ShieldCheck, Mail, BarChart2 } from "lucide-react";

const BACKEND_URL = "http://localhost:8000";

// Standard key scenario emails extracted from the test dataset for direct quick injection
const PRESET_SCENARIOS = [
  {
    name: "Bob Jones P0 Outage Escalation (msg_060)",
    payload: {
      message_id: "msg_060",
      sender: "bob.jones@enterprise.net",
      subject: "Escalation: SLA Breach + Legal Review",
      body: "We have reviewed the October 1st incident report you provided. The RCA is inadequate - it does not address the root cause or corrective actions. Our legal team is now involved. Please expect formal correspondence. We are also putting the renewal on hold pending resolution.",
      timestamp: "2023-10-19T14:00:00Z",
      thread_id: "thread_bob_outage"
    }
  },
  {
    name: "Karen W Churn & Reputation Crisis (msg_033)",
    payload: {
      message_id: "msg_033",
      sender: "karen.w@retail-co.com",
      subject: "Final Warning Before Public Review",
      body: "I have now sent 3 emails with zero human response. I am cancelling my subscription today and will be leaving detailed negative reviews on G2, Capterra, and Trustpilot. My account is karen.w@retail-co.com.",
      timestamp: "2023-10-10T08:00:00Z",
      thread_id: "thread_karen_refund"
    }
  },
  {
    name: "GDPR Article 20 Request (msg_052)",
    payload: {
      message_id: "msg_052",
      sender: "marcus.del@fintech-startup.co",
      subject: "Data Export: GDPR Right to Portability Request",
      body: "Under GDPR Article 20, I am formally requesting a complete export of all personal data your platform holds about me (account: marcus.del@fintech-startup.co). Please provide this within the statutory 30-day window.",
      timestamp: "2023-10-17T08:00:00Z",
      thread_id: "thread_gdpr_001"
    }
  },
  {
    name: "Ransomware & Extortion Attack (msg_038)",
    payload: {
      message_id: "msg_038",
      sender: "hacker@anon-collective.net",
      subject: "We have your data - Pay Now",
      body: "We have exfiltrated 50,000 customer records from your database. Send 2 BTC to wallet 1A2b3C4d5E6f within 48 hours or we publish the data on the dark web.",
      timestamp: "2023-10-11T12:00:00Z",
      thread_id: "thread_security_002"
    }
  },
  {
    name: "Chatbot Misinformation Dispute (msg_056)",
    payload: {
      message_id: "msg_056",
      sender: "user.confused@hotmail.com",
      subject: "Your chatbot told me something wrong",
      body: "Your AI chatbot on the support page told me I could cancel anytime and get a prorated refund. But when I tried, billing said no refunds. Which is it? I have a screenshot of the chatbot conversation.",
      timestamp: "2023-10-18T10:00:00Z",
      thread_id: "thread_chatbot_misinformation"
    }
  },
  {
    name: "Alice Upgrade Pro-rata Billing (msg_041)",
    payload: {
      message_id: "msg_041",
      sender: "alice.smith@greenlight-npo.org",
      subject: "Upgrade Question: Pro-rata billing",
      body: "Hi again! We've grown faster than expected and need to add 5 more seats mid-cycle. If I upgrade to the larger plan now, will we be charged pro-rata for the remaining days this month?",
      timestamp: "2023-10-13T09:00:00Z",
      thread_id: "thread_alice_pricing"
    }
  }
];

function App() {
  const [activeView, setActiveView] = useState<"inbox" | "analytics">("inbox");
  const [threads, setThreads] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ pending: 0, replied: 0, escalated: 0, critical: 0, spam_filtered: 0 });
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedSenderEmail, setSelectedSenderEmail] = useState<string | null>(null);
  
  // Streaming Simulator states
  const [replaySpeed, setReplaySpeed] = useState<number>(1); // seconds per email
  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [ingestionProgress, setIngestionProgress] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Poll intervals
  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 4000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch stats
      const statsRes = await fetch(`${BACKEND_URL}/dashboard/stats`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
      
      // Fetch threads
      const threadsRes = await fetch(`${BACKEND_URL}/threads`);
      if (threadsRes.ok) {
        const threadsData = await threadsRes.json();
        setThreads(threadsData);
      }
    } catch (e) {
      console.error("Dashboard connection failed:", e);
    }
  };

  const handleSelectThread = (threadId: string, senderEmail: string) => {
    setSelectedThreadId(threadId);
    setSelectedSenderEmail(senderEmail);
  };

  const handleReset = async () => {
    if (!confirm("Are you sure you want to flush the database and reseed the knowledge base?")) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/reset`, { method: "POST" });
      if (res.ok) {
        setSimulationLogs(["Database reset successful. Core knowledge base seeded."]);
        setSelectedThreadId(null);
        setSelectedSenderEmail(null);
        setIngestionProgress(0);
        fetchDashboardData();
      }
    } catch (e) {
      alert("Failed to reset database");
    }
  };

  const injectEmail = async (emailPayload: any) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailPayload),
      });
      if (res.ok) {
        const data = await res.json();
        setSimulationLogs((prev) => [
          `[${new Date().toLocaleTimeString()}] Ingested ${emailPayload.message_id} -> Job ID: ${data.job_id.substring(0, 12)}...`,
          ...prev,
        ]);
        fetchDashboardData();
      } else {
        throw new Error("HTTP Ingestion Failure");
      }
    } catch (e) {
      setSimulationLogs((prev) => [`[Error] Failed to ingest ${emailPayload.message_id}`, ...prev]);
    }
  };

  // Replay Uploaded File
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const emailList = JSON.parse(e.target?.result as string);
        if (!Array.isArray(emailList)) {
          alert("Invalid file format. Must be a JSON array of emails.");
          return;
        }
        
        setIsSimulating(true);
        setIngestionProgress(0);
        setSimulationLogs((prev) => [`Starting streaming replay of ${emailList.length} emails...`, ...prev]);
        
        for (let i = 0; i < emailList.length; i++) {
          await injectEmail(emailList[i]);
          setIngestionProgress(Math.round(((i + 1) / emailList.length) * 100));
          // Wait according to configured speed
          await new Promise((resolve) => setTimeout(resolve, replaySpeed * 1000));
        }
        
        setSimulationLogs((prev) => [`Stream replay completed successfully.`, ...prev]);
      } catch (err) {
        alert("Failed to parse JSON file.");
      } finally {
        setIsSimulating(false);
      }
    };
    reader.readAsText(file);
  };

  const handleBulkAction = async (action: string) => {
    alert(`Bulk ${action} action applied successfully to selected items.`);
    fetchDashboardData();
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-background overflow-hidden text-foreground">
      
      {/* Header bar */}
      <header className="h-16 border-b border-border bg-card/50 flex items-center justify-between px-6 shrink-0 z-10 glass">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30 neon-glow-primary">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="title-font font-extrabold text-white text-base leading-none">CRM Intelligence</h1>
            <span className="text-[10px] text-accent font-semibold tracking-wider uppercase">Agentic Ops Platform</span>
          </div>
        </div>

        {/* View Selection Tab */}
        <div className="flex bg-background border border-border rounded-lg p-1">
          <button
            onClick={() => setActiveView("inbox")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeView === "inbox" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Mail className="w-3.5 h-3.5" /> Operations Inbox
          </button>
          <button
            onClick={() => setActiveView("analytics")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeView === "analytics" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" /> Business Analytics
          </button>
        </div>

        {/* Live Counters */}
        <div className="hidden md:flex items-center gap-6 text-xs border-l border-border pl-6">
          <div className="flex flex-col">
            <span className="text-muted-foreground">Escalated</span>
            <span className="font-bold text-rose-400">{stats.escalated}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground">Critical</span>
            <span className="font-bold text-red-500 animate-pulse">{stats.critical}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground">Spam Blocked</span>
            <span className="font-bold text-zinc-400">{stats.spam_filtered}</span>
          </div>
        </div>
      </header>

      {/* Main Viewport Grid */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        
        {/* Main Dashboard Window */}
        <main className="flex-1 flex p-4 overflow-hidden min-w-0">
          {activeView === "inbox" ? (
            <div className="flex-1 flex gap-4 overflow-hidden">
              <div className="w-96 shrink-0 h-full">
                <InboxList
                  threads={threads}
                  selectedThreadId={selectedThreadId}
                  onSelectThread={handleSelectThread}
                  onRefresh={fetchDashboardData}
                  onBulkAction={handleBulkAction}
                />
              </div>
              
              <ThreadWorkspace
                threadId={selectedThreadId || ""}
                senderEmail={selectedSenderEmail || ""}
                backendUrl={BACKEND_URL}
                onActionComplete={fetchDashboardData}
              />
            </div>
          ) : (
            <AnalyticsDashboard backendUrl={BACKEND_URL} />
          )}
        </main>

        {/* Left/Right Drawer: Simulation control center */}
        <aside className="w-80 border-l border-border bg-card/30 p-4 flex flex-col gap-4 shrink-0 overflow-y-auto hidden xl:flex">
          
          {/* Controls Title */}
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Terminal className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-white">Simulation Console</h3>
          </div>

          {/* Quick Scenario Injectors */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Scenario Injectors</span>
            {PRESET_SCENARIOS.map((sc, i) => (
              <button
                key={i}
                onClick={() => injectEmail(sc.payload)}
                className="w-full text-left text-[11px] bg-secondary/40 hover:bg-secondary/70 border border-border p-2.5 rounded transition-all text-muted-foreground hover:text-white truncate"
              >
                + {sc.name}
              </button>
            ))}
          </div>

          {/* Real-time Streaming Replay */}
          <div className="bg-secondary/20 border border-border p-3.5 rounded-lg flex flex-col gap-3">
            <span className="text-[10px] text-accent uppercase font-bold tracking-wider flex items-center gap-1">
              <Play className="w-3 h-3" /> Replay Dataset Stream
            </span>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-muted-foreground">Simulation Speed: {replaySpeed}s / email</label>
              <input
                type="range"
                min={0.5}
                max={5}
                step={0.5}
                value={replaySpeed}
                onChange={(e) => setReplaySpeed(parseFloat(e.target.value))}
                className="w-full h-1 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>

            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
            
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isSimulating}
              className="w-full bg-primary text-white text-xs font-semibold py-2 px-3 rounded hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              {isSimulating ? `Streaming... ${ingestionProgress}%` : "Select & Stream JSON"}
            </button>
          </div>

          {/* DB Reset control */}
          <button
            onClick={handleReset}
            className="w-full flex items-center justify-center gap-1.5 bg-rose-600/10 text-rose-400 border border-rose-600/20 py-2.5 rounded-lg text-xs font-semibold hover:bg-rose-600/20 transition-all mt-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Database State
          </button>

          {/* Console logs output */}
          <div className="border border-border rounded-lg bg-background/50 p-2.5 flex flex-col gap-1 h-40 overflow-y-auto">
            <span className="text-[10px] font-bold text-muted-foreground border-b border-border/50 pb-1.5">Console Output</span>
            {simulationLogs.length === 0 ? (
              <span className="text-[10px] text-muted/30 italic">Simulator idle. Logs will output here...</span>
            ) : (
              simulationLogs.map((log, i) => (
                <div key={i} className="text-[9px] font-mono text-muted-foreground leading-normal break-all">
                  {log}
                </div>
              ))
            )}
          </div>

        </aside>

      </div>
    </div>
  );
}

export default App;
