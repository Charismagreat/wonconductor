# Chart Studio AI Simplification Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Consolidate multiple specialized AI tools into a single "Universal Query Tool" (`run_studio_data_query`) to simplify the Chart Studio AI architecture.

**Architecture:** 
1. Expose only `run_studio_data_query` in `dashboard-ai.ts`.
2. Move all specialized routing logic (Finance, Hometax, Workspace) into `run_studio_data_query` within `ai-tools.ts`.
3. Update system prompt to enforce this pattern.

**Tech Stack:** TypeScript, Next.js, Gemini API, egdesk-helpers.

---

### Task 1: Refactor `run_studio_data_query` in `src/lib/ai-tools.ts`

**Files:**
- Modify: `src/lib/ai-tools.ts`

**Step 1: Enhance Finance routing with parameter support**
Update `run_studio_data_query` to handle `intent: "monthly"` with custom months if provided, and ensure all finance paths return guarded data.

**Step 2: Enhance Hometax routing**
Improve `idStr` detection for Hometax invoices to accurately map `sales`/`purchase` and `tax`/`exempt`.

**Step 3: Verification script**
Create `scratch/verify_universal_query.ts` to test various `tableId` and `intent` combinations.

---

### Task 2: Simplify Tool Manifest and Prompt in `src/lib/dashboard-ai.ts`

**Files:**
- Modify: `src/lib/dashboard-ai.ts`

**Step 1: Remove redundant tools from `tools` array**
Delete `get_finance_monthly_summary` and `get_finance_statistics` from the manifest.

**Step 2: Clean up system prompt**
Remove references to old tools and clarify instructions for using `run_studio_data_query`.

**Step 3: Commit changes**
Commit the consolidation work.

---

### Task 3: Final Verification

**Files:**
- Run: `scratch/verify_universal_query.ts`

**Step 1: Execute verification script**
Ensure all data sources are correctly routed through the single tool.

**Step 2: Clean up scratch files**
Remove `scratch/verify_universal_query.ts`.
