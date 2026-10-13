# Commissioner Monitoring Frontend Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Cloudflare Worker API usage with direct Apna Ranchi Commissioner Monitoring API integration.

**Architecture:** A configurable browser transport targets `/v1/api/anchal`; adapters preserve existing UI models while polling replaces Worker live updates.

**Tech Stack:** TypeScript, Vite, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-07-anchal-frontend-integration-design.md`

## Global Constraints

- Never expose backend credentials in the frontend.
- Send monitoring cookies with `credentials: "include"`.
- Remove Cloudflare from the production frontend path.

## Review Focus

- Cross-origin API base URLs preserve cookie credentials.
- Backend error envelopes retain UI-visible messages.
- Read polling does not overwrite active form edits.
- All legacy `/api` calls are removed from client code.

### Task 1: API transport and contract mapping

**Files:** `src/client/api.ts`, client API tests.

- [ ] Add failing tests for API base URL, `/v1/api/anchal` path construction, cookies, error handling and freshness envelopes.
- [ ] Implement direct monitoring transport and response/error adapters.
- [ ] Run focused tests and commit.

### Task 2: Replace feature calls

**Files:** client pages/hooks currently calling `api`, shared client types, feature tests.

- [ ] Map login/session/logout, services, setup, entries, corrections, history, dashboard and dashboard-detail calls to the adapter.
- [ ] Replace live WebSocket behavior with polling and `lastUpdated` refresh state.
- [ ] Run feature tests and commit.

### Task 3: Remove Worker production path

**Files:** Vite/build configuration, Worker references, tests and documentation.

- [ ] Remove production Worker routing/dependencies while retaining static frontend build/development support.
- [ ] Add a regression test/search gate preventing client `/api` calls and Cloudflare runtime imports.
- [ ] Run full frontend test/build and commit.
