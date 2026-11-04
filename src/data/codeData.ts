export const REQUIREMENTS_TXT = `streamlit
chromadb
ollama
pypdf
`;

export const APP_PY_CODE = `import streamlit as st
import chromadb
import ollama
from pypdf import PdfReader
import uuid

# ==============================================================================
# SETTINGS & CONSTANTS
# ==============================================================================
# The embedding model converts text into numerical vector representations.
# nomic-embed-text is high-performance, compact, and 100% free locally.
EMBED_MODEL = "nomic-embed-text"

# The chat model generates the final answer from retrieved context.
# llama3.2:3b runs fast on consumer laptops with ~2-3 GB VRAM/RAM.
CHAT_MODEL = "llama3.2:3b"

# Chunking settings: character length per chunk and overlap to prevent
# cutting off sentences or context between adjacent chunks.
CHUNK_SIZE = 800
CHUNK_OVERLAP = 150

# Number of most relevant chunks to retrieve for each user question.
TOP_K = 4


# ==============================================================================
# 1. EXTRACT PAGES FROM PDF
# ==============================================================================
def extract_pages(pdf_file):
    """
    Extracts text from each page of the uploaded PDF file using pypdf.
    Returns a list of tuples: (page_number, text), skipping empty pages.
    Page numbers are 1-indexed for clear human-facing citations.
    """
    reader = PdfReader(pdf_file)
    pages_data = []
    
    for i, page in enumerate(reader.pages):
        text = page.extract_text()
        # Skip empty pages or pages containing only whitespace
        if text and text.strip():
            pages_data.append((i + 1, text.strip()))
            
    return pages_data


# ==============================================================================
# 2. CHUNK TEXT WITH OVERLAP
# ==============================================================================
def chunk_text(text, size=CHUNK_SIZE, overlap=CHUNK_OVERLAP):
    """
    Splits text into fixed-size character chunks with overlap.
    Overlap ensures semantic continuity so concepts spanning chunk boundaries
    are not lost during vector similarity search.
    """
    chunks = []
    start = 0
    text_len = len(text)
    step = size - overlap
    
    # Safety guard against zero or negative stride
    if step <= 0:
        step = size
        
    while start < text_len:
        end = start + size
        chunk = text[start:end]
        chunks.append(chunk)
        start += step
        
    return chunks


# ==============================================================================
# 3. GENERATE EMBEDDINGS USING OLLAMA
# ==============================================================================
def embed(texts):
    """
    Generates embedding vectors for a list of strings using Ollama's local API.
    Returns a list of vector floats corresponding to each input text.
    """
    response = ollama.embed(model=EMBED_MODEL, input=texts)
    return response["embeddings"]


# ==============================================================================
# 4. BUILD CHROMADB VECTOR INDEX
# ==============================================================================
def build_index(pdf_file):
    """
    Extracts text, chunks every page, attaches {"page": n} metadata, creates an
    ephemeral in-memory ChromaDB collection with a unique UUID name, generates
    embeddings in batches of 32 for optimal memory/speed, and stores them.
    Returns (collection, number_of_chunks), or (None, 0) if no text was found.
    """
    pages_data = extract_pages(pdf_file)
    if not pages_data:
        return None, 0

    all_chunks = []
    all_metadatas = []
    all_ids = []

    chunk_counter = 0
    for page_num, text in pages_data:
        page_chunks = chunk_text(text, CHUNK_SIZE, CHUNK_OVERLAP)
        for chunk in page_chunks:
            all_chunks.append(chunk)
            all_metadatas.append({"page": page_num})
            all_ids.append(f"chunk_{chunk_counter}")
            chunk_counter += 1

    if not all_chunks:
        return None, 0

    # In-memory ChromaDB client (no disk persistence needed, resets per session)
    client = chromadb.Client()
    collection_name = f"pdf_{uuid.uuid4().hex}"
    collection = client.create_collection(name=collection_name)

    # Embed and add in batches of 32 for smooth throughput and low RAM spike
    batch_size = 32
    for i in range(0, len(all_chunks), batch_size):
        batch_chunks = all_chunks[i : i + batch_size]
        batch_metas = all_metadatas[i : i + batch_size]
        batch_ids = all_ids[i : i + batch_size]

        batch_embeddings = embed(batch_chunks)
        collection.add(
            ids=batch_ids,
            embeddings=batch_embeddings,
            documents=batch_chunks,
            metadatas=batch_metas
        )

    return collection, len(all_chunks)


# ==============================================================================
# 5. RETRIEVE RELEVANT CHUNKS
# ==============================================================================
def retrieve(collection, question):
    """
    Embeds the user's question, queries ChromaDB for the top TOP_K closest chunks
    via cosine similarity, and returns (documents, metadatas).
    For high-level queries (e.g. 'analyze', 'summarize', 'what is this about'),
    also blends in representative overview chunks so the model can provide a comprehensive answer.
    """
    q_embedding = embed([question])[0]
    results = collection.query(
        query_embeddings=[q_embedding],
        n_results=TOP_K
    )
    # ChromaDB returns nested lists per query vector
    documents = results["documents"][0] if results["documents"] else []
    metadatas = results["metadatas"][0] if results["metadatas"] else []

    # If the user asks a broad overview or analysis query, also blend in initial chunks
    lower_q = question.lower()
    summary_terms = ["analyze", "summarize", "summary", "about", "overview", "what is this", "explain the pdf"]
    if any(term in lower_q for term in summary_terms):
        initial_res = collection.get(limit=TOP_K)
        if initial_res and initial_res.get("documents"):
            for doc, meta in zip(initial_res["documents"], initial_res["metadatas"]):
                if doc not in documents:
                    documents.append(doc)
                    metadatas.append(meta)

    return documents, metadatas


# ==============================================================================
# 6. STREAM ANSWER WITH CITATIONS
# ==============================================================================
def answer_stream(question, chunks, metas):
    """
    Formats retrieved chunks with clear [Page N] labels into a grounded context.
    Instructs the LLM via system prompt to answer comprehensively using this context.
    Provides complete, un-truncated answers with clear explanations and structure.
    Streams tokens in real time directly to the Streamlit UI.
    """
    context_blocks = []
    for chunk, meta in zip(chunks, metas):
        page_num = meta.get("page", "?")
        context_blocks.append(f"[Page {page_num}]\\n{chunk}")
    context_str = "\\n\\n".join(context_blocks)

    system_prompt = (
        "You are an expert document analysis assistant.\\n"
        "Your goal is to provide a complete, well-structured, and comprehensive answer to the user's question.\\n"
        "Guidelines:\\n"
        "1. Base your answer strictly on the facts present in the provided document excerpts.\\n"
        "2. Do not truncate, cut off, or abbreviate your explanations—provide full sentences and structured bullet points where helpful.\\n"
        "3. If the user asks to analyze, summarize, or explain what the document is about, synthesize the main topics, findings, structure, and details from the excerpts.\\n"
        "4. Only if the excerpts contain zero relevant information to answer the question, state: \\\"I couldn't find that in the document.\\\"\\n\\n"
        f"Context excerpts:\\n{context_str}"
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": question}
    ]

    response_stream = ollama.chat(
        model=CHAT_MODEL,
        messages=messages,
        stream=True,
        options={
            "num_predict": 1024,  # Ensures the response is complete and does not cut off prematurely
            "temperature": 0.2     # Keeps output grounded and factual
        }
    )

    for part in response_stream:
        yield part["message"]["content"]


# ==============================================================================
# 7. STREAMLIT WEB USER INTERFACE
# ==============================================================================
st.set_page_config(page_title="PDF Chatbot", page_icon="📄")
st.title("📄 Chat with your PDF")

# Initialize session state for persistence across re-runs
if "collection" not in st.session_state:
    st.session_state["collection"] = None
if "file_name" not in st.session_state:
    st.session_state["file_name"] = None
if "messages" not in st.session_state:
    st.session_state["messages"] = []

# Sidebar upload control
with st.sidebar:
    st.header("Document Upload")
    uploaded_file = st.file_uploader("Upload a PDF", type="pdf")

    # Re-index ONLY when a brand new file is uploaded
    if uploaded_file is not None and uploaded_file.name != st.session_state["file_name"]:
        with st.spinner("Indexing PDF chunks and creating vector embeddings..."):
            collection, count = build_index(uploaded_file)
            st.session_state["collection"] = collection
            st.session_state["file_name"] = uploaded_file.name
            st.session_state["messages"] = []  # Reset chat history for the fresh document

            if count > 0:
                st.success(f"Indexed {count} chunks")
            else:
                st.error("No text found. This may be a scanned PDF.")

# Render existing chat conversation
for msg in st.session_state["messages"]:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])
        if "sources" in msg and msg["sources"]:
            st.caption(f"Sources: pages {', '.join(str(p) for p in msg['sources'])}")

# User interaction gate
if st.session_state["collection"] is None:
    st.info("Upload a PDF in the sidebar to begin.")
else:
    if question := st.chat_input("Ask a question about your PDF..."):
        # 1. Display and save user question immediately
        st.chat_message("user").markdown(question)
        st.session_state["messages"].append({"role": "user", "content": question})

        # 2. Retrieve top K semantic chunks from ChromaDB
        chunks, metas = retrieve(st.session_state["collection"], question)
        unique_pages = sorted(list(set(m.get("page") for m in metas if "page" in m)))

        # 3. Stream assistant answer directly to the screen
        with st.chat_message("assistant"):
            full_response = st.write_stream(answer_stream(question, chunks, metas))
            if unique_pages:
                st.caption(f"Sources: pages {', '.join(str(p) for p in unique_pages)}")

        # 4. Save assistant response and sources to session state
        st.session_state["messages"].append({
            "role": "assistant",
            "content": full_response,
            "sources": unique_pages
        })
`;

export interface SampleDoc {
  id: string;
  name: string;
  category: string;
  description: string;
  pages: { pageNum: number; text: string }[];
  sampleQuestions: string[];
}

export const SAMPLE_DOCUMENTS: SampleDoc[] = [
  {
    id: "solar-specs",
    name: "Helios_Apex_Solar_Inverter_Manual.pdf",
    category: "Technical Hardware Manual",
    description: "4-page specification manual for the Helios-9000 Hybrid Solar Inverter, battery limits, and error codes.",
    pages: [
      {
        pageNum: 1,
        text: `HELIOS APEX-9000 HYBRID SOLAR INVERTER - SYSTEM MANUAL (REVISION 4.2)
1. SYSTEM OVERVIEW & SPECIFICATIONS
The Helios Apex-9000 is a dual-string split-phase hybrid inverter engineered for residential microgrids and commercial battery energy storage.
- Continuous Rated AC Output: 9,600 Watts at 240V AC / 40 Amperes (60 Hz).
- Peak Surge Capacity: 14,400 Watts for up to 10 seconds.
- Maximum DC Input Voltage: 600V DC per MPPT channel.
- Dual MPPT Range: 120V DC to 500V DC with 99.1% tracking efficiency.
- Total Harmonic Distortion (THD): Less than 2.0% at rated load.
- Operating Temperature Range: -25°C to 60°C (-13°F to 140°F), with derating above 45°C.`
      },
      {
        pageNum: 2,
        text: `2. BATTERY STORAGE & CHARGING PROTOCOLS
The inverter supports Lithium Iron Phosphate (LiFePO4) and Nickel Manganese Cobalt (NMC) chemistries via closed-loop CANBus 2.0B.
- Nominal Battery Voltage: 48V DC (Operating Window: 42.0V to 58.4V DC).
- Maximum Continuous Charge Current: 160 Amperes DC.
- Maximum Discharge Current: 190 Amperes DC.
- Recommended Battery Bank Minimum: 15 kWh capacity.
- Maximum Depth of Discharge (DoD): 90% recommended for warranty longevity.
Float charging should be maintained at 54.0V DC with an absorption voltage of 56.8V DC held for 90 minutes. Lead-acid batteries are not permitted.`
      },
      {
        pageNum: 3,
        text: `3. SAFETY PROTECTIONS, FAULT CODES & TROUBLESHOOTING
The unit incorporates galvanically isolated grid relays and arc-fault circuit interrupter (AFCI) compliant with UL 1699B.
- Fault Code E-01: DC Ground Fault detected. The inverter disconnects within 15ms. Inspect PV wire insulation for rodent damage or water intrusion.
- Fault Code E-04: Grid Frequency Out of Range (tolerance: 59.3 Hz to 60.5 Hz). Reconnection occurs after 300 seconds of stable grid frequency.
- Fault Code E-07: Inverter Over-Temperature (>85°C heat sink). Clean the bottom intake air filters and ensure 30cm clearance on all sides.
- Fault Code E-12: Battery Low Voltage Cutoff (<41.8V DC). The system locks in sleep mode until solar charging resumes.`
      },
      {
        pageNum: 4,
        text: `4. WARRANTY TERMS & REGULATORY CERTIFICATIONS
Warranty is guaranteed by Helios Power Systems Inc. for a period of 10 years from the original commissioning date.
- Extended warranty up to 25 years is available if registered within 90 days.
- Compliance: UL 1741-SB, IEEE 1547-2018, CSA C22.2 No. 107.1, FCC Part 15 Class B.
- Remote Monitoring: Integrated Wi-Fi 802.11 b/g/n and Ethernet RJ-45 with Modbus TCP.
For emergency technical service or RMA authorization, contact support@heliospower.example or call 1-800-555-0199.`
      }
    ],
    sampleQuestions: [
      "What is the maximum rated AC output and peak surge capacity?",
      "Which battery chemistry is supported and what is the maximum charge current?",
      "What does fault code E-07 mean and how do I fix it?",
      "What is the standard warranty duration?"
    ]
  },
  {
    id: "employee-handbook",
    name: "Acme_Remote_Workplace_Handbook_2026.pdf",
    category: "Company Policy & HR",
    description: "3-page remote work handbook covering home office stipends, PTO policies, core hours, and security rules.",
    pages: [
      {
        pageNum: 1,
        text: `ACME TECHNOLOGIES - REMOTE WORKPLACE & CULTURE HANDBOOK (EDITION 2026)
CHAPTER 1: WORKING ARRANGEMENTS & CORE COLLABORATION HOURS
Acme operates as a remote-first organization across North America, Europe, and Asia-Pacific.
- Synchronous Core Collaboration Window: 10:00 AM to 2:00 PM US Eastern Time (ET), Monday through Thursday. All team members must be reachable via Slack during these hours.
- Fridays are dedicated 'Focus Days': No internal meetings may be scheduled, allowing uninterrupted deep work.
- Home Office Setup Stipend: Every permanent employee receives a one-time $1,200 USD equipment stipend upon onboarding, plus a $100 USD monthly internet/cellphone reimbursement.`
      },
      {
        pageNum: 2,
        text: `CHAPTER 2: TIME OFF, WELLNESS & PARENTAL LEAVE
We believe sustained creativity requires comprehensive rest and physical well-being.
- Paid Time Off (PTO): 25 days of flexible PTO per calendar year, accrued monthly. Up to 5 unused PTO days can roll over into the following calendar year.
- Sick & Mental Health Days: 10 dedicated days per year, with no doctor note required for absences under 3 consecutive days.
- Parental Leave: 16 weeks of 100% paid leave for both birthing and non-birthing parents, applicable within the first 12 months of birth or legal adoption.
- Annual Wellness Budget: $600 USD per year reimbursable for gym memberships, fitness trackers, counseling, or ergonomic desk equipment.`
      },
      {
        pageNum: 3,
        text: `CHAPTER 3: DATA PRIVACY & HARDWARE SECURITY PROTOCOLS
Maintaining cybersecurity is the shared responsibility of every team member.
- Hardware: All work must be conducted exclusively on Acme-provisioned MacBook Pro or ThinkPad workstations. Personal devices (BYOD) are strictly prohibited for client code repositories.
- Password Management: 1Password enterprise accounts are mandatory. Passwords must be at least 16 characters. Multi-Factor Authentication (MFA) via hardware security key (YubiKey) or authenticator app is enforced on all corporate SSO accounts.
- Public Wi-Fi: Employees connecting from coffee shops, airports, or hotels must route all internet traffic through the company WireGuard VPN.`
      }
    ],
    sampleQuestions: [
      "What are the mandatory core collaboration hours and what happens on Fridays?",
      "How much is the home office setup stipend and monthly reimbursement?",
      "How many weeks of paid parental leave are offered?",
      "Are employees allowed to use personal laptops (BYOD) for client code?"
    ]
  },
  {
    id: "transformer-paper",
    name: "Attention_Is_All_You_Need_Summary.pdf",
    category: "Academic AI Research",
    description: "3-page executive summary of the foundational Vaswani et al. 2017 Transformer architecture paper.",
    pages: [
      {
        pageNum: 1,
        text: `EXECUTIVE SUMMARY: ATTENTION IS ALL YOU NEED (VASWANI ET AL., 2017)
1. MOTIVATION & PARADIGM SHIFT
Recurrent neural networks (RNNs, LSTMs, GRUs) were the dominant sequence transduction architectures for machine translation. However, their inherently sequential computation prevents parallelization across training examples.
The Transformer eliminates recurrence and convolutions entirely, relying solely on attention mechanisms to model global dependencies between input and output tokens.
Key Results:
- On WMT 2014 English-to-German translation, the Transformer achieved 28.4 BLEU, establishing a new state of the art.
- On WMT 2014 English-to-French translation, the model scored 41.8 BLEU after training for only 3.5 days on 8 P100 GPUs.`
      },
      {
        pageNum: 2,
        text: `2. MODEL ARCHITECTURE: ENCODER & DECODER STACKS
The Transformer follows an encoder-decoder structure:
- Encoder: Stack of N = 6 identical layers. Each layer has two sub-layers: a multi-head self-attention mechanism and a position-wise fully connected feed-forward network. Residual connections around each sub-layer are followed by layer normalization (LayerNorm).
- Decoder: Stack of N = 6 identical layers. In addition to the two sub-layers, the decoder inserts a third sub-layer which performs multi-head attention over the encoder output stack.
- Masked Attention: Self-attention in the decoder is masked to prevent positions from attending to subsequent tokens, preserving auto-regressive decoding.`
      },
      {
        pageNum: 3,
        text: `3. MULTI-HEAD ATTENTION & POSITIONAL ENCODINGS
Scaled Dot-Product Attention computes:
Attention(Q, K, V) = softmax( (Q * K^T) / sqrt(d_k) ) * V
where queries Q, keys K, and values V have dimension d_k = 64.
Multi-Head Attention projects queries, keys, and values h = 8 times with different learned linear projections, allowing the model to jointly attend to information from different representation subspaces.
Because the model contains no recurrence or convolution, Positional Encodings using sine and cosine functions of varying frequencies are added to the input embeddings so token positions are respected.`
      }
    ],
    sampleQuestions: [
      "Why did the Transformer replace traditional RNNs and LSTMs?",
      "How many layers are in the encoder and decoder stacks?",
      "What is the mathematical formula for Scaled Dot-Product Attention?",
      "Why are positional encodings needed?"
    ]
  }
];

export interface StepGuide {
  id: number;
  title: string;
  shortDesc: string;
  windowsCmd: string;
  macCmd: string;
  linuxCmd: string;
  explanation: string;
  pitfallWarning?: string;
  expectedOutput: string;
}

export const SETUP_STEPS: StepGuide[] = [
  {
    id: 1,
    title: "Install Python 3.12 & Verify PATH",
    shortDesc: "Install Python 3.12 and ensure the python and pip commands are accessible in your terminal.",
    windowsCmd: `# Download Python 3.12 from python.org
# CRITICAL CHECKBOX: On the installer's first screen, TICK:
# [x] "Add python.exe to PATH"
# Then open PowerShell and verify:
python --version
pip --version`,
    macCmd: `# Using Homebrew:
brew install python@3.12
python3 --version
pip3 --version`,
    linuxCmd: `# On Ubuntu / Debian:
sudo apt update
sudo apt install python3.12 python3.12-venv python3-pip -y
python3 --version
pip3 --version`,
    explanation: "Python 3.12 is the latest ultra-stable release supported by ChromaDB and PyTorch wheels. If you skip 'Add to PATH' on Windows, PowerShell will say 'python is not recognized as an internal or external command'.",
    pitfallWarning: "Windows beginners: If you forgot to check 'Add python.exe to PATH', re-run the installer, click 'Modify', and check the PATH box.",
    expectedOutput: "Python 3.12.x\npip 24.x"
  },
  {
    id: 2,
    title: "Install Ollama & Download Models",
    shortDesc: "Download Ollama and pull both llama3.2:3b (chat) and nomic-embed-text (embeddings).",
    windowsCmd: `# 1. Download and run installer from https://ollama.com/download/windows
# 2. Ollama starts as a background tray icon.
# 3. In PowerShell, pull both models:
ollama pull llama3.2:3b
ollama pull nomic-embed-text`,
    macCmd: `# Download from https://ollama.com or brew install ollama
ollama serve &
ollama pull llama3.2:3b
ollama pull nomic-embed-text`,
    linuxCmd: `# Install via official one-line script:
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.2:3b
ollama pull nomic-embed-text`,
    explanation: "Ollama runs open-weights models completely offline on your computer. nomic-embed-text generates 768-dimensional text vectors in milliseconds, and llama3.2:3b delivers rapid, coherent answers using only ~2GB of RAM.",
    pitfallWarning: "Ensure the Ollama application is running before executing commands (look for the llama icon in your Windows taskbar tray or Mac menu bar).",
    expectedOutput: "pulling manifest\npulling 3a36... 100% 2.0 GB\nverifying sha256 digest\nwriting manifest\nsuccess"
  },
  {
    id: 3,
    title: "Create Project Directory & Open in VS Code",
    shortDesc: "Create the project folder named 'pdf-chatbot' and launch VS Code inside it.",
    windowsCmd: `# Create the folder and navigate into it:
mkdir pdf-chatbot
cd pdf-chatbot

# Open the directory in Visual Studio Code:
code .`,
    macCmd: `mkdir -p pdf-chatbot
cd pdf-chatbot
code .`,
    linuxCmd: `mkdir -p pdf-chatbot
cd pdf-chatbot
code .`,
    explanation: "Keeping your project isolated in a clean folder prevents conflicts with other Python packages installed globally on your machine.",
    expectedOutput: "VS Code opens with an empty 'pdf-chatbot' workspace in the file explorer."
  },
  {
    id: 4,
    title: "Create and Activate Virtual Environment",
    shortDesc: "Set up an isolated Python venv and fix the common Windows PowerShell script execution policy error.",
    windowsCmd: `# 1. Create the virtual environment named 'venv':
python -m venv venv

# 2. Windows PowerShell fix (fixes "running scripts is disabled on this system"):
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

# 3. Activate the virtual environment:
.\\venv\\Scripts\\Activate.ps1

# Your prompt will now show (venv) at the beginning!`,
    macCmd: `# 1. Create virtual environment:
python3 -m venv venv

# 2. Activate:
source venv/bin/activate

# Prompt now shows (venv)`,
    linuxCmd: `# 1. Create virtual environment:
python3 -m venv venv

# 2. Activate:
source venv/bin/activate

# Prompt now shows (venv)`,
    explanation: "Windows PowerShell by default blocks running script files (`.ps1`). Running `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` only changes the security policy for the current terminal tab—it does not weaken your whole computer's security.",
    pitfallWarning: "If you see 'Activate.ps1 cannot be loaded because running scripts is disabled', run the Set-ExecutionPolicy command above first.",
    expectedOutput: "(venv) PS C:\\Users\\You\\pdf-chatbot>"
  },
  {
    id: 5,
    title: "Create Files & Install Requirements",
    shortDesc: "Create requirements.txt and app.py, then install dependencies with pip.",
    windowsCmd: `# 1. In VS Code, create two files:
#    - requirements.txt
#    - app.py
# (Paste the exact code provided in Tab 2)

# 2. Install all 4 packages inside the active venv:
pip install -r requirements.txt`,
    macCmd: `# Install all 4 packages inside the active venv:
pip install -r requirements.txt`,
    linuxCmd: `# Install all 4 packages inside the active venv:
pip install -r requirements.txt`,
    explanation: "This installs streamlit (web UI), chromadb (in-memory vector database), ollama (Python client for local LLMs), and pypdf (pure-Python PDF parser).",
    expectedOutput: "Successfully installed chromadb-0.x.x ollama-0.x.x pypdf-5.x.x streamlit-1.x.x"
  },
  {
    id: 6,
    title: "Run Streamlit App & Chat with PDF",
    shortDesc: "Start the Streamlit local web server and open the app in your browser at http://localhost:8501.",
    windowsCmd: `# Launch the Streamlit app:
streamlit run app.py

# Your default browser will automatically open:
# http://localhost:8501`,
    macCmd: `streamlit run app.py`,
    linuxCmd: `streamlit run app.py`,
    explanation: "Streamlit starts a local Python web server on port 8501. The browser will open immediately. Upload your PDF in the left sidebar, watch the chunks get indexed, and start asking questions!",
    expectedOutput: "  You can now view your Streamlit app in your browser.\n\n  Local URL: http://localhost:8501\n  Network URL: http://192.168.x.x:8501"
  }
];

export const FUNCTION_BREAKDOWN = [
  {
    name: "extract_pages(pdf_file)",
    summary: "Reads the uploaded binary or buffer with pypdf.PdfReader. Iterates through pages, pulls text with page.extract_text(), and discards blank pages. Returns (page_num, text) where page_num is 1-indexed.",
    whyImportant: "Keeping the 1-indexed page number attached to the text at the very first step is what enables precise [Page N] citations in the final answer.",
    lines: "Lines 30-46"
  },
  {
    name: "chunk_text(text, size=800, overlap=150)",
    summary: "Iterates through the string in fixed character slices of 800 chars, advancing by (size - overlap = 650 chars) each step.",
    whyImportant: "Overlap prevents cutting sentences in half. If a key fact is at character 790, chunk 1 and chunk 2 will both contain it, guaranteeing retrieval captures it.",
    lines: "Lines 51-72"
  },
  {
    name: "embed(texts)",
    summary: "Calls ollama.embed(model='nomic-embed-text', input=texts) and extracts the 'embeddings' list of float vectors.",
    whyImportant: "Direct native Ollama SDK call—no bloated LangChain wrapper needed. Generates dense 768-dimensional semantic vectors locally.",
    lines: "Lines 77-85"
  },
  {
    name: "build_index(pdf_file)",
    summary: "Loops over pages, chunks each page, associates metadata {'page': page_num}, instantiates an ephemeral chromadb.Client(), creates a collection with a unique UUID, and inserts vectors in batches of 32.",
    whyImportant: "Using uuid.uuid4().hex guarantees no collection collision if multiple PDFs are uploaded in a session. Batching in 32 items prevents memory spikes.",
    lines: "Lines 90-142"
  },
  {
    name: "retrieve(collection, question)",
    summary: "Embeds the query string into a vector, calls collection.query(query_embeddings=[q_vector], n_results=4), and returns the matched documents and metadata dicts.",
    whyImportant: "Uses cosine distance under the hood to find the 4 most conceptually relevant paragraphs out of hundreds in the document in under 10ms.",
    lines: "Lines 147-162"
  },
  {
    name: "answer_stream(question, chunks, metas)",
    summary: "Constructs a strict system prompt with '[Page N]\\nchunk', binds the model to only that context, orders it to say 'I couldn't find that in the document.' if absent, and calls ollama.chat(stream=True).",
    whyImportant: "Grounding: By strictly forbidding outside knowledge and formatting clear page headers, hallucinations are reduced to near zero.",
    lines: "Lines 167-202"
  },
  {
    name: "Streamlit UI & Session State",
    summary: "Configures page title/icon, manages st.session_state for collection, file_name, and messages. Detects file change in sidebar, builds index, renders chat history, and uses st.write_stream for live token typing.",
    whyImportant: "Streamlit re-executes the entire script on every user interaction. st.session_state is the critical feature that preserves the vector index and message history across runs without reloading.",
    lines: "Lines 207-270"
  }
];
