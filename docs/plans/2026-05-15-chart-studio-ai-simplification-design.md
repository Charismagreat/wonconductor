# Design: Chart Studio AI Architecture Simplification

## Overview
Consolidate the complex multi-tool architecture of Chart Studio AI into a single, robust "Universal Query Tool" (`run_studio_data_query`). This tool will automatically map AI requests to the appropriate `egdesk-helpers.ts` functions based on the data source type and user intent.

## Goals
- **Simplify AI Manifest**: Reduce the number of tools exposed to the AI model to minimize confusion and improve performance.
- **Unified Entry Point**: Use `run_studio_data_query` for all data retrieval needs (Finance, Hometax, Workspace).
- **Metadata-First Architecture**: Leverage existing helpers for accurate schema mapping and data retrieval.
- **Robust Prompting**: Clean up the system prompt to enforce the single-tool pattern.

## Proposed Changes

### 1. Tool Manifest (`src/lib/dashboard-ai.ts`)
- **Remove**: `get_finance_monthly_summary`, `get_finance_statistics`.
- **Keep/Enhance**: `run_studio_data_query` as the sole tool for data fetching.

### 2. Internal Routing Logic (`src/lib/ai-tools.ts`)
Refactor `run_studio_data_query` to handle all mappings internally:
- **Finance Data**:
  - `intent: "monthly"` -> `getMonthlySummary` (12 months)
  - `intent: "summary" | "statistics"` -> `getTransactionStats`
  - `intent: "list"` -> `queryBankTransactions` / `queryCardTransactions`
- **Hometax Data**:
  - Map `hometax_*` IDs to `queryTaxInvoices`, `queryTaxExemptInvoices`, or `queryCashReceipts`.
  - Infer `invoiceType` (`sales` / `purchase`) from the `tableId`.
- **Workspace Data**:
  - Map to `get_aggregated_report_data` if `groupBy` is provided.
  - Map to `query_workspace_table` otherwise.
- **Guardrails**: Ensure `applyGuardrails` is applied to all outputs.

### 3. System Prompt Refinement (`src/lib/dashboard-ai.ts`)
- Remove all references to `get_finance_dashboard_summary`, `get_aggregated_report_data`, and `execute_analytical_sql` as direct tools.
- Instruct AI to use `run_studio_data_query` with `groupBy` and `valueKey` for all aggregation tasks.
- Clarify the mapping between current time and date filters (`startDate`, `endDate`).

## Success Criteria
- AI successfully generates charts for Finance, Hometax, and Workspace data using only `run_studio_data_query`.
- No "Unknown tool" errors during AI execution.
- System prompt is concise and free of redundant tool instructions.
