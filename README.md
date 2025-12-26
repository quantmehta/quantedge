# QuantEdge: Institutional-Grade Decision Analysis & Portfolio Management

**QuantEdge** is a high-performance, polyglot financial platform designed to bridge the gap between retail investing and institutional-grade quantitative analysis. It synthesizes real-time market data, heuristic decision theory, and a robust Python-based analysis engine to provide actionable event intelligence.

![QuantEdge Banner](https://img.shields.io/badge/Architecture-Hybrid_Polyglot-orange)
![Version](https://img.shields.io/badge/Version-1.0.0--Stable-green)
![License](https://img.shields.io/badge/License-Proprietary-red)

---

## 🌟 Core Pillars

### 1. Adaptive Ingestion Pipeline
QuantEdge features a "Bulletproof" header-detection and extraction engine capable of handling messy, real-world broker spreadsheets (CSV/XLSX).
- **Intelligent Mapping**: Automatically identifies `Symbol`, `Quantity`, and `Purchase Price` regardless of column ordering.
- **Paginated Enrichment**: Optimized for 500+ row portfolios, utilizing on-demand background enrichment to ensure low latency for users while maintaining 100% data integrity in the database.

### 2. Live Market Intelligence (Groww Integration)
Deep integration with the **Groww API** via a specialized Python bridge.
- **Multi-Pass Fuzzy Resolution**: Resolves imperfect company names (e.g., "Archem chemical ind") to precise tickers (AKSHARCHEM) using noise-word stripping algorithms.
- **Fault-Tolerant LTP Fetching**: Implements "Rescue Logic" and batch-isolation to ensure live market prices are persisted even when individual API symbols fail.

### 3. Stress Testing & Event Intelligence
Quantify risk before it happens.
- **Shock Matrix**: Simulate macro-economic shocks (e.g., Interest Rate hikes, Oil spikes) and visualize the propagation through your specific HNI or retail holdings.
- **PnL-at-Risk**: Calculate downside exposure using dynamic beta and sector-specific sensitivity scoring.

### 4. Deterministic Decision Engine
A rule-based conversational agent grounded in classical decision theory.
- **Criteria Selection**: Maximax, Maximin, Hurwicz, Laplace, and EMV (Expected Monetary Value).
- **Structured Reasoning**: Move from intuition-based "gut feeling" to deterministic payoff matrices.

---

## 🏗️ Technical Architecture

QuantEdge utilizes a high-concurrency architecture that optimizes for both UI responsiveness and heavy mathematical computation.

| Layer | Component | Description |
| :--- | :--- | :--- |
| **Orchestration** | **Next.js 16 (App Router)** | Handles session state, API routing, and high-performance server components. |
| **Logic/Schema** | **Prisma & SQLite** | Type-safe database management with optimized write-buffering for bulk holdings. |
| **Computation** | **Python (Pandas/NumPy)** | Operates as a "Sidecar" service for heavy financial modeling and API bridging. |
| **Styling** | **Tailwind CSS 4** | Ultra-modern, premium dark-mode interface with glassmorphism aesthetics. |

---

## 🛠️ Rapid Setup

### Prerequisites
- **Node.js**: v20+
- **Python**: v3.10+ (Add to PATH)
- **PortableGit**: (Included in `C:\Users\divit\OneDrive\Documents\DTH\`)

### 1. Installation
```powershell
# Clone and install dependencies
git clone https://github.com/your-repo/decision-maker.git
cd decision-maker
npm install
pip install -r requirements.txt
```

### 2. Database Initialization
```powershell
npx prisma generate
npx prisma db push
```

### 3. Launching
```powershell
# Bypassing execution policies via native batch
.\start_dev.bat
```
The application will be live at `http://localhost:3000`.

---

## 📂 Project Governance

- `app/`: Next.js features and API endpoints.
- `lib/`: Business logic, domain services, and decider engines.
- `python/`: Quantitative bridge and Groww API connector.
- `scripts/`: Dev-ops utilities for database calibration and benchmarks.

---

## 📜 Credits & Licensing
Developed by the **Advanced Agentic Coding Team** at QuantEdge Systems.

© 2025 QuantEdge Systems. All Rights Reserved.
