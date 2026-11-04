import React, { useState } from "react";
import { 
  Check, Copy, Terminal, AlertTriangle, HelpCircle, ChevronDown, 
  ChevronRight, Laptop, CheckCircle2, ShieldAlert, Sparkles, FolderPlus 
} from "lucide-react";
import { SETUP_STEPS, StepGuide } from "../data/codeData";

export function SetupGuide() {
  const [selectedOS, setSelectedOS] = useState<"windows" | "mac" | "linux">("windows");
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const toggleStepCompleted = (id: number) => {
    setCompletedSteps(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleCopyCommand = (cmd: string, id: number) => {
    navigator.clipboard.writeText(cmd);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getCmdForOS = (step: StepGuide) => {
    if (selectedOS === "windows") return step.windowsCmd;
    if (selectedOS === "mac") return step.macCmd;
    return step.linuxCmd;
  };

  const FAQS = [
    {
      q: "PowerShell Error: 'Activate.ps1 cannot be loaded because running scripts is disabled'",
      a: "This is a default Windows security policy. Fix it right inside your PowerShell window before activating the venv by running: Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass. This only affects your current terminal window and is 100% safe."
    },
    {
      q: "Ollama Error: 'Connection refused' or 'model not found'",
      a: "1. Make sure the Ollama application is launched and running (check your Windows System Tray or Mac Menu Bar). 2. Make sure you ran 'ollama pull llama3.2:3b' and 'ollama pull nomic-embed-text' to completion before running the Streamlit app."
    },
    {
      q: "Streamlit says: 'No text found. This may be a scanned PDF.'",
      a: "pypdf extracts text embedded directly in the PDF file. If you upload a scanned photograph of a paper document, it contains image pixels rather than text characters. To chat with scanned PDFs, the document must first be processed with OCR (optical character recognition)."
    },
    {
      q: "Port 8501 is already in use by another process",
      a: "Streamlit will automatically offer port 8502 if 8501 is busy, or you can force a custom port: streamlit run app.py --server.port 8505"
    },
    {
      q: "How much RAM / VRAM does this require?",
      a: "Ollama with llama3.2:3b and nomic-embed-text requires only ~2.5 GB of RAM/VRAM. It runs comfortably on almost any modern Windows laptop, MacBook (M1/M2/M3 or Intel), or Linux PC without an expensive graphics card."
    }
  ];

  const progressPercent = Math.round((completedSteps.length / SETUP_STEPS.length) * 100);

  return (
    <div className="space-y-6">
      {/* Header & OS Switcher */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Laptop className="w-5 h-5 text-sky-400" />
              Beginner Setup Guide (Step-by-Step)
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Zero skipped steps. Follow these 6 steps to run your 100% free local PDF chatbot in under 5 minutes.
            </p>
          </div>

          {/* OS Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800">
            {(["windows", "mac", "linux"] as const).map(os => (
              <button
                key={os}
                onClick={() => setSelectedOS(os)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors ${
                  selectedOS === os
                    ? "bg-sky-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {os === "windows" ? "Windows (Default)" : os === "mac" ? "macOS" : "Linux"}
              </button>
            ))}
          </div>
        </div>

        {/* Progress Tracker */}
        <div className="mt-5 pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>Setup Progress: {completedSteps.length} of {SETUP_STEPS.length} steps completed</span>
            <span className="font-mono font-bold text-sky-400">{progressPercent}%</span>
          </div>
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
            <div 
              className="bg-sky-500 h-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Step Cards List */}
      <div className="space-y-4">
        {SETUP_STEPS.map((step) => {
          const isDone = completedSteps.includes(step.id);
          const cmdText = getCmdForOS(step);

          return (
            <div
              key={step.id}
              className={`bg-slate-900 border rounded-xl p-5 transition-all ${
                isDone 
                  ? "border-emerald-500/40 bg-slate-900/60" 
                  : "border-slate-800 hover:border-slate-700"
              }`}
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleStepCompleted(step.id)}
                    className={`w-6 h-6 rounded flex items-center justify-center shrink-0 mt-0.5 transition-colors border ${
                      isDone
                        ? "bg-emerald-500 border-emerald-400 text-slate-950"
                        : "bg-slate-950 border-slate-700 hover:border-sky-500 text-transparent"
                    }`}
                    title={isDone ? "Mark incomplete" : "Mark as completed"}
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-sky-400">Step 0{step.id}</span>
                      <h3 className={`text-base font-semibold ${isDone ? "line-through text-slate-400" : "text-slate-100"}`}>
                        {step.title}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{step.shortDesc}</p>
                  </div>
                </div>
              </div>

              {/* Terminal Command Box */}
              <div className="bg-slate-950 rounded-lg border border-slate-800 overflow-hidden mt-3">
                <div className="bg-slate-950/80 px-3.5 py-1.5 border-b border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1.5 font-mono">
                    <Terminal className="w-3.5 h-3.5 text-sky-400" />
                    {selectedOS === "windows" ? "PowerShell" : "Terminal / Bash"}
                  </span>
                  <button
                    onClick={() => handleCopyCommand(cmdText, step.id)}
                    className="flex items-center gap-1 text-slate-300 hover:text-sky-400 font-medium transition-colors"
                  >
                    {copiedId === step.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Commands</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-3 text-xs font-mono text-slate-200 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {cmdText}
                </div>
              </div>

              {/* Explanatory notes & warnings */}
              <div className="mt-3 text-xs text-slate-300 leading-relaxed">
                {step.explanation}
              </div>

              {step.pitfallWarning && (
                <div className="mt-2.5 p-2.5 rounded-lg bg-amber-950/30 border border-amber-800/40 text-amber-200 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-amber-300">Important Note: </span>
                    {step.pitfallWarning}
                  </div>
                </div>
              )}

              {/* Expected Output block */}
              <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center gap-2 text-[11px] text-slate-400">
                <span className="text-slate-400 font-medium">Expected output:</span>
                <code className="text-slate-300 font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  {step.expectedOutput.split("\n")[0]}
                </code>
              </div>
            </div>
          );
        })}
      </div>

      {/* Troubleshooting & FAQ Accordion */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-4">
          <HelpCircle className="w-5 h-5 text-sky-400" />
          Common Beginner Questions & Troubleshooting
        </h3>
        <div className="space-y-2">
          {FAQS.map((faq, idx) => {
            const isExpanded = expandedFaq === idx;
            return (
              <div
                key={idx}
                className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden transition-colors"
              >
                <button
                  onClick={() => setExpandedFaq(isExpanded ? null : idx)}
                  className="w-full p-3.5 text-left text-xs font-semibold text-slate-200 hover:text-sky-300 flex items-center justify-between gap-3"
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </button>
                {isExpanded && (
                  <div className="px-3.5 pb-3.5 text-xs text-slate-400 leading-relaxed border-t border-slate-800/60 pt-2.5">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
