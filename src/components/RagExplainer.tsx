import React, { useState } from "react";
import { 
  Network, ArrowRight, Layers, Database, Cpu, MessageSquare, 
  Sparkles, CheckCircle2, ShieldCheck, Zap, Scissors, BookOpen
} from "lucide-react";

export function RagExplainer() {
  const [sliderChunkSize, setSliderChunkSize] = useState(800);
  const [sliderOverlap, setSliderOverlap] = useState(150);

  const sampleSentence = "The Helios Apex-9000 hybrid solar inverter requires a minimum of 15 kWh battery capacity for microgrid operation. Over-temperature condition occurs at 85°C.";

  // Calculate stride
  const stride = Math.max(1, sliderChunkSize - sliderOverlap);

  return (
    <div className="space-y-6">
      {/* Introduction Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <Network className="w-5 h-5 text-sky-400" />
          How Local RAG Works (Under the Hood)
        </h2>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
          RAG (Retrieval-Augmented Generation) connects an LLM to your private documents without fine-tuning. Instead of feeding an entire 100-page PDF into the AI at once, RAG searches for only the most relevant paragraphs and pastes them directly into the model’s prompt.
        </p>
      </div>

      {/* Visual Flow Diagram: Ingestion & Retrieval */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Step 1: Ingestion Pipeline */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-sky-400 mb-2">
              <span>PIPELINE 01</span>
              <span>·</span>
              <span>RUNS ONCE ON PDF UPLOAD</span>
            </div>
            <h3 className="text-base font-bold text-slate-100 mb-3">
              Ingestion & Vector Indexing
            </h3>

            {/* Stages */}
            <div className="space-y-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-start gap-3">
                <div className="w-6 h-6 rounded bg-sky-950 border border-sky-800 text-sky-400 flex items-center justify-center font-bold shrink-0 text-[11px]">
                  1
                </div>
                <div>
                  <div className="font-semibold text-slate-200">PDF Page Extraction</div>
                  <div className="text-slate-400 mt-0.5">
                    <code className="text-sky-300">pypdf.PdfReader</code> pulls text from every page and tracks the exact 1-indexed page number: <code className="text-slate-300 font-mono">(page_num, text)</code>.
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-start gap-3">
                <div className="w-6 h-6 rounded bg-sky-950 border border-sky-800 text-sky-400 flex items-center justify-center font-bold shrink-0 text-[11px]">
                  2
                </div>
                <div>
                  <div className="font-semibold text-slate-200">Text Chunking with Overlap</div>
                  <div className="text-slate-400 mt-0.5">
                    Fixed slices of 800 characters advance by 650 characters (step = 800 - 150). Overlap ensures no crucial sentence is chopped across boundaries.
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-start gap-3">
                <div className="w-6 h-6 rounded bg-sky-950 border border-sky-800 text-sky-400 flex items-center justify-center font-bold shrink-0 text-[11px]">
                  3
                </div>
                <div>
                  <div className="font-semibold text-slate-200">Vector Embeddings (nomic-embed-text)</div>
                  <div className="text-slate-400 mt-0.5">
                    Ollama converts each 800-char chunk into a 768-dimensional float vector capturing its semantic meaning.
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-start gap-3">
                <div className="w-6 h-6 rounded bg-sky-950 border border-sky-800 text-sky-400 flex items-center justify-center font-bold shrink-0 text-[11px]">
                  4
                </div>
                <div>
                  <div className="font-semibold text-slate-200">ChromaDB In-Memory Storage</div>
                  <div className="text-slate-400 mt-0.5">
                    Batches of 32 chunks are stored in an ephemeral collection with metadata <code className="text-slate-300 font-mono">&#123;"page": n&#125;</code>.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Query & Retrieval Pipeline */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-400 mb-2">
              <span>PIPELINE 02</span>
              <span>·</span>
              <span>RUNS ON EVERY USER MESSAGE</span>
            </div>
            <h3 className="text-base font-bold text-slate-100 mb-3">
              Retrieval & Grounded Generation
            </h3>

            {/* Stages */}
            <div className="space-y-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-start gap-3">
                <div className="w-6 h-6 rounded bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center font-bold shrink-0 text-[11px]">
                  1
                </div>
                <div>
                  <div className="font-semibold text-slate-200">Question Vectorization</div>
                  <div className="text-slate-400 mt-0.5">
                    The user query (e.g. "What is the peak surge capacity?") is converted into a vector with the same embedding model.
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-start gap-3">
                <div className="w-6 h-6 rounded bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center font-bold shrink-0 text-[11px]">
                  2
                </div>
                <div>
                  <div className="font-semibold text-slate-200">Cosine Similarity Search (Top-4)</div>
                  <div className="text-slate-400 mt-0.5">
                    ChromaDB searches high-dimensional space and finds the 4 closest chunks in milliseconds.
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-start gap-3">
                <div className="w-6 h-6 rounded bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center font-bold shrink-0 text-[11px]">
                  3
                </div>
                <div>
                  <div className="font-semibold text-slate-200">Strict Grounded System Prompt</div>
                  <div className="text-slate-400 mt-0.5">
                    Chunks are stitched with <code className="text-emerald-300 font-mono">[Page N]</code> headers. If the info isn't there, the model is strictly commanded to state: <em className="text-slate-300">"I couldn't find that in the document."</em>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-start gap-3">
                <div className="w-6 h-6 rounded bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center font-bold shrink-0 text-[11px]">
                  4
                </div>
                <div>
                  <div className="font-semibold text-slate-200">Real-Time Token Streaming + Citations</div>
                  <div className="text-slate-400 mt-0.5">
                    <code className="text-slate-300 font-mono">st.write_stream()</code> paints words as they are generated by <code className="text-emerald-300">llama3.2:3b</code>, followed by <code className="text-slate-300 font-mono">st.caption("Sources: pages ...")</code>.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Why No LangChain / LlamaIndex Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          Why Pure Python Beats LangChain / LlamaIndex for Beginners
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
            <div className="font-bold text-slate-200 mb-1">Zero Hidden Black Boxes</div>
            <p className="text-slate-400 leading-relaxed">
              LangChain hides prompt construction behind complex nested chain classes. In our <code className="text-sky-300">app.py</code>, you can see every single line of Python that builds the context.
            </p>
          </div>
          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
            <div className="font-bold text-slate-200 mb-1">No Dependency Hell & Deprecations</div>
            <p className="text-slate-400 leading-relaxed">
              LangChain frequently deprecates imports across minor versions. Standard Python, pypdf, ChromaDB, and Ollama have rock-solid stable APIs that will work years from now.
            </p>
          </div>
          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
            <div className="font-bold text-slate-200 mb-1">Tiny Footprint & 100% Free</div>
            <p className="text-slate-400 leading-relaxed">
              Only 4 lightweight dependencies in <code className="text-emerald-300 font-mono">requirements.txt</code>. Installs in seconds, zero credit card, zero API tokens, runs 100% offline.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
