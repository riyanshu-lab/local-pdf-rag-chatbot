import React, { useState } from "react";
import { 
  FileText, Download, Play, Code2, BookOpen, 
  HelpCircle, Sparkles, Check, Terminal, ExternalLink, ShieldCheck
} from "lucide-react";
import { StreamlitSimulator } from "./components/StreamlitSimulator";
import { CodeViewer } from "./components/CodeViewer";
import { SetupGuide } from "./components/SetupGuide";
import { RagExplainer } from "./components/RagExplainer";
import { APP_PY_CODE, REQUIREMENTS_TXT } from "./data/codeData";

type Tab = "simulator" | "code" | "guide" | "explainer";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("simulator");
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleDownloadAll = () => {
    // Download app.py
    const blobApp = new Blob([APP_PY_CODE], { type: "text/x-python;charset=utf-8" });
    const urlApp = URL.createObjectURL(blobApp);
    const linkApp = document.createElement("a");
    linkApp.href = urlApp;
    linkApp.download = "app.py";
    document.body.appendChild(linkApp);
    linkApp.click();
    document.body.removeChild(linkApp);
    URL.revokeObjectURL(urlApp);

    // Download requirements.txt after short timeout
    setTimeout(() => {
      const blobReq = new Blob([REQUIREMENTS_TXT], { type: "text/plain;charset=utf-8" });
      const urlReq = URL.createObjectURL(blobReq);
      const linkReq = document.createElement("a");
      linkReq.href = urlReq;
      linkReq.download = "requirements.txt";
      document.body.appendChild(linkReq);
      linkReq.click();
      document.body.removeChild(linkReq);
      URL.revokeObjectURL(urlReq);
    }, 250);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-sky-500/30 selection:text-sky-200">
      {/* Top Bar Contract: Brand Zone — Nav Links — 1 Primary Action */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-50">
        {/* Zone 1: Brand wordmark (single text element) */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
            <FileText className="w-4 h-4" />
          </div>
          <a href="/" className="text-base font-bold tracking-tight text-white whitespace-nowrap">
            PDF Chatbot Studio
          </a>
        </div>

        {/* Zone 2: 4 clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-300">
          <button
            onClick={() => setActiveTab("simulator")}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
              activeTab === "simulator"
                ? "text-sky-400 border-b-2 border-sky-400 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Live Simulator
          </button>
          <button
            onClick={() => setActiveTab("code")}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
              activeTab === "code"
                ? "text-sky-400 border-b-2 border-sky-400 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Code (app.py)
          </button>
          <button
            onClick={() => setActiveTab("guide")}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
              activeTab === "guide"
                ? "text-sky-400 border-b-2 border-sky-400 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Beginner Setup Guide
          </button>
          <button
            onClick={() => setActiveTab("explainer")}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
              activeTab === "explainer"
                ? "text-sky-400 border-b-2 border-sky-400 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            How RAG Works
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleDownloadAll}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 shadow-sm"
          >
            {downloadSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-300" />
                <span>Files Downloaded!</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download Project Files</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Mobile nav bar */}
      <div className="md:hidden flex items-center justify-around border-b border-slate-800 bg-slate-900 px-2 py-2 text-xs">
        <button
          onClick={() => setActiveTab("simulator")}
          className={`px-2 py-1 rounded ${activeTab === "simulator" ? "bg-sky-600 text-white" : "text-slate-400"}`}
        >
          Simulator
        </button>
        <button
          onClick={() => setActiveTab("code")}
          className={`px-2 py-1 rounded ${activeTab === "code" ? "bg-sky-600 text-white" : "text-slate-400"}`}
        >
          Code
        </button>
        <button
          onClick={() => setActiveTab("guide")}
          className={`px-2 py-1 rounded ${activeTab === "guide" ? "bg-sky-600 text-white" : "text-slate-400"}`}
        >
          Setup
        </button>
        <button
          onClick={() => setActiveTab("explainer")}
          className={`px-2 py-1 rounded ${activeTab === "explainer" ? "bg-sky-600 text-white" : "text-slate-400"}`}
        >
          Architecture
        </button>
      </div>

      {/* Main Screen Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col">
        {activeTab === "simulator" && (
          <div className="flex-1 flex flex-col min-h-[620px]">
            <StreamlitSimulator />
          </div>
        )}

        {activeTab === "code" && <CodeViewer />}

        {activeTab === "guide" && <SetupGuide />}

        {activeTab === "explainer" && <RagExplainer />}
      </main>

      {/* Clean quiet footer */}
      <footer className="border-t border-slate-800/80 py-4 px-6 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span>Python 3.12</span>
          <span>·</span>
          <span>Ollama llama3.2:3b</span>
          <span>·</span>
          <span>nomic-embed-text</span>
          <span>·</span>
          <span>ChromaDB</span>
          <span>·</span>
          <span>Streamlit</span>
        </div>
        <div>
          100% Free · Runs Offline Locally · No API Keys Required
        </div>
      </footer>
    </div>
  );
}
