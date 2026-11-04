import React, { useState } from "react";
import { 
  Copy, Check, Download, FileCode, Terminal, HelpCircle, 
  ExternalLink, Layers, Sparkles, BookOpen, Code2 
} from "lucide-react";
import { APP_PY_CODE, REQUIREMENTS_TXT, FUNCTION_BREAKDOWN } from "../data/codeData";

export function CodeViewer() {
  const [activeTab, setActiveTab] = useState<"app.py" | "requirements.txt">("app.py");
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedFunc, setSelectedFunc] = useState<number | null>(null);

  const handleCopy = (content: string, label: string) => {
    navigator.clipboard.writeText(content);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDownloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Code2 className="w-5 h-5 text-sky-400" />
              Pristine Source Code
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Zero LangChain, zero LlamaIndex. Built entirely with vanilla Python 3.12, official Ollama SDK, ChromaDB, and Streamlit.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => handleDownloadFile("app.py", APP_PY_CODE)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span>Download app.py</span>
            </button>
            <button
              onClick={() => handleDownloadFile("requirements.txt", REQUIREMENTS_TXT)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Download requirements.txt</span>
            </button>
          </div>
        </div>

        {/* Function Quick Jump / Explanations Bar */}
        <div className="mt-4 pt-4 border-t border-slate-800">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Click Any Function to Inspect Why It Was Built This Way:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FUNCTION_BREAKDOWN.map((fn, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedFunc(selectedFunc === idx ? null : idx)}
                className={`text-xs px-2.5 py-1 rounded font-mono transition-colors border ${
                  selectedFunc === idx
                    ? "bg-sky-500/20 text-sky-300 border-sky-500/50"
                    : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700"
                }`}
              >
                {fn.name.split("(")[0]}()
              </button>
            ))}
          </div>

          {selectedFunc !== null && (
            <div className="mt-3 p-3.5 bg-slate-950 rounded-lg border border-sky-900/40 text-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-sky-300 font-bold">
                  {FUNCTION_BREAKDOWN[selectedFunc].name}
                </span>
                <span className="text-slate-400 font-mono text-[11px]">
                  {FUNCTION_BREAKDOWN[selectedFunc].lines}
                </span>
              </div>
              <p className="text-slate-300 mb-2 leading-relaxed">
                {FUNCTION_BREAKDOWN[selectedFunc].summary}
              </p>
              <div className="text-emerald-300/90 bg-emerald-950/30 p-2 rounded border border-emerald-900/30">
                <span className="font-bold text-emerald-400">Why this matters: </span>
                {FUNCTION_BREAKDOWN[selectedFunc].whyImportant}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Code Display Container */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        {/* Editor Tab Bar */}
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("app.py")}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === "app.py"
                  ? "bg-slate-800 text-sky-300 border border-slate-700"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-sky-400" />
              <span>app.py</span>
            </button>
            <button
              onClick={() => setActiveTab("requirements.txt")}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === "requirements.txt"
                  ? "bg-slate-800 text-emerald-300 border border-slate-700"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>requirements.txt</span>
            </button>
          </div>

          <button
            onClick={() => 
              handleCopy(
                activeTab === "app.py" ? APP_PY_CODE : REQUIREMENTS_TXT, 
                activeTab
              )
            }
            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
          >
            {copied === activeTab ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-300" />
                <span>Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy {activeTab}</span>
              </>
            )}
          </button>
        </div>

        {/* Code Content */}
        <div className="p-4 overflow-x-auto text-xs leading-relaxed font-mono">
          <pre className="text-slate-300">
            <code>
              {activeTab === "app.py" ? APP_PY_CODE : REQUIREMENTS_TXT}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
}
