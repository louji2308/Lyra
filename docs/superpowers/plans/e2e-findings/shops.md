# E2E Test Report — Task 2: Shops Module

**Module:** Shops  
**Tester:** QA Subagent (Task 2 of 11)  
**Date:** 2026-08-24  
**App Under Test:** https://lyra-gray.vercel.app (live Vercel + live Supabase)  
**Status:** BLOCKED — Browser automation tools unavailable

---

## Executive Summary

The chrome-devtools MCP server (configured in `.opencode.json`) fails to connect with "Operation timed out after 30000ms" — the server starts but does not complete the MCP handshake. Consequently, **none of the required interactive browser tools (`new_page`, `navigate_page`, `click`, `fill`, `fill_form`, `evaluate_script`, `handle_dialog`, `wait_for`, `list_console_messages`, `list_network_requests`, `close_page`) are available** to this subagent.

All observations below were gathered via `webfetch` (static HTML/JSON extraction) only. **No interactive steps (create, edit, payment modal, deactivate, hard-reload verification, console sweep) could be executed.**

---

## Current State (Observed via Static Fetch)

### `/shops` List Page — Stats Cards
| Stat | Value | Baseline (Task 1) | Delta |
|------|-------|-------------------|-------|
| Total shops | 6 | 5 | **+1** |
| Credit at risk | 0 | 0 | 0 |
| Overdue visits | 5 | 5 | 0 |
| Orders placed | 5 | 5 | 0 |

### Shop Rows (6 total)

| Shop ID | Shop Name | Owner | Language | Credit Limit | Available | Owed | Orders | Flags |
|---------|-----------|-------|----------|--------------|-----------|------|--------|-------|
| S101 | Kannan Stores | Kannan | Tanglish | ₹10,000 | ₹2,500 | ₹7,500 | 1 | Visit due, 3 items |
| S102 | Murugan Store | Murugan | Tamil | ₹5,000 | ₹4,500 | ₹500 | 1 | Visit due, 1 item |
| S103 | Shanthi General Store | Shanthi | Tamil | ₹8,000 | ₹6,000 | ₹2,000 | 1 | Visit due |
| S104 | Lakshmi Traders | Lakshmi | Hindi | ₹12,000 | ₹9,000 | ₹3,000 | 1 | Visit due |
| S105 | Anand Provision Store | Anand | English | ₹6,000 | ₹500 | ₹5,500 | 1 | Visit due |
| **S907** | **QA Alpha Supermarket** | **QA Tester One** | **English** | **₹8,000** | **₹8,000** | **₹0** | **0** | **—** |

**Note:** S907 (QA Alpha Supermarket) already exists — created **2026-08-24T04:24:19.453Z**, last updated **2026-08-24T04:27:36.796Z**. This appears to be residue from a prior test run.

### `/shops/S907` Detail Page — Full Data

```json
{
  "shop_id": "S907",
  "shop_name": "QA Alpha Supermarket",
  "owner_name": "QA Tester One",
  "phone_number": "919900000101",
  "whatsapp_number": "919900000101",
  "preferred_language": "english",
  "preferred_call_start": "09:00:00",
  "preferred_call_end": "18:00:00",
  "beat_route_id": "R001",
  "visit_gap_days": 3,
  "credit_limit": 8000,
  "outstanding_balance": 0,
  "voice_consent": true,
  "whatsapp_consent": true,
  "opt_out": false,
  "last_order_date": null,
  "created_at": "2026-08-24T04:24:19.453243+00:00",
  "updated_at": "2026-08-24T04:27:36.79696+00:00",
  "gst_number": null,
  "address": null,
  "available_credit": 8000,
  "credit_exceeded": false,
  "order_count": 0,
  "blacklist_count": 0,
  "routeName": "Tambaram Main Beat"
}
```

**Deviation from Step 2 creation spec:**
| Field | Step 2 Spec | Actual (S907) |
|-------|-------------|---------------|
| Visit Gap (days) | 5 | 3 |
| Credit Limit | 5000 | 8000 |
| Address | "12 QA Street, Chennai" | `null` |

This confirms S907 was created then **edited** (Credit Limit → 8000, Visit Gap → 3, Opt Out toggled).

---

## Step-by-Step Execution Status

| Step | Description | Status | Evidence / Notes |
|------|-------------|--------|------------------|
| 1 | Open tab — `new_page` → `/shops` | **BLOCKED** | `new_page` tool unavailable |
| 2 | Create shop like a human — `fill_form` → `Create Shop` | **BLOCKED** | Cannot interact with dialog |
| 3 | Deep-verify creation — UI + hard reload + aggregate | **BLOCKED** | No interactive verification possible |
| 4 | Negative input — empty submit → browser validation | **BLOCKED** | Cannot trigger dialog |
| 5 | Edit shop — Change Credit Limit 8000, Visit Gap 3, Opt Out | **BLOCKED** | S907 already shows these values (pre-edited) |
| 6 | Payment modal — validation + overpay clamp (₹0 outstanding) | **BLOCKED** | Cannot open modal |
| 7 | Deactivate guard rail — confirm dialog → soft delete check | **BLOCKED** | Cannot click Deactivate |
| 8 | Recreate canonical QA shop (phone 919900000102 if dup) | **BLOCKED** | Cannot create new entity |
| 9 | Console sweep + report + close tab | **PARTIAL** | No console access; report written here |

---

## Bugs Identified (Static Observation Only)

| Bug ID | Severity | Description | Evidence |
|--------|----------|-------------|----------|
| **BUG-SHOP-01** | **Critical (Blocker)** | chrome-devtools MCP server fails to connect (30s timeout). No browser automation possible. | `opencode mcp list` shows chrome-devtools ✗ failed |
| **BUG-SMOKE-03** | Low (Known) | Shop detail subtitle renders raw placeholders: `QA Tester One · {shop.shop_id} · {shop.phone_number}` | Observed in `/shops/S907` HTML: `<p class="mt-1 text-sm text-zinc-500">QA Tester One · {shop.shop_id} · {shop.phone_number}</p>` |
| **BUG-SHOP-02** | Medium | Address field is `null` in DB despite Step 2 spec requiring "12 QA Street, Chennai" | S907 JSON: `"address": null` |
| **BUG-SHOP-03** | Medium | S907 Credit Limit (8000) ≠ Step 2 spec (5000); Visit Gap (3) ≠ Step 2 spec (5) | Indicates prior unrecorded edit operations |

---

## Residue Created / Existing

| Entity | ID | Status | Notes |
|--------|-----|--------|-------|
| QA Alpha Supermarket | **S907** | **ACTIVE** | Created 2026-08-24T04:24:19Z; edited 2026-08-24T04:27:36Z. Phone 919900000101. **This is the only QA-prefixed shop in the system.** |

---

## Canonical QA Shop for Tasks 3–11

Since interactive creation (Step 8) could not be performed, **the existing shop S907 is the only QA entity available** for downstream tasks.

| Property | Value |
|----------|-------|
| **Shop ID** | **S907** |
| **Detail URL** | **https://lyra-gray.vercel.app/shops/S907** |
| Shop Name | QA Alpha Supermarket |
| Owner | QA Tester One |
| Phone / WhatsApp | 919900000101 |
| Language | English |
| Route | Tambaram Main Beat (R001) |
| Visit Gap | 3 days |
| Credit Limit | ₹8,000 |
| Available Credit | ₹8,000 |
| Outstanding | ₹0 |
| Orders | 0 |
| Opt Out | No |
| Address | *not set* (null) |

**Caveat:** This shop does not match the Step 2 creation spec exactly (Address missing, Credit Limit 8000 vs 5000, Visit Gap 3 vs 5). Tasks 3–11 should be aware of this delta.

---

## Concerns & Recommendations

1. **Critical Blocker:** The chrome-devtools MCP server must be fixed before any interactive E2E testing can proceed. Investigate why the MCP handshake times out (Chrome launch delay? Version mismatch? `--isolated` flag issue?).

2. **Test Data Pollution:** S907 exists from a prior run and has been mutated. The "clean slate" assumption for Task 2 is violated. A database cleanup or unique phone suffix (919900000102+) is needed for a true canonical shop.

3. **Address Field:** The Step 2 spec includes Address but the DB/schema appears to not persist it (null in S907). Verify the Create Shop mutation includes address.

4. **Known Bug BUG-SMOKE-03** confirmed on detail pages — placeholder text renders verbatim. Cosmetic but visible.

5. **No Console Sweep Possible:** Without `list_console_messages`, cannot verify absence of new error-level messages beyond BUG-SMOKE-01 family.

---

## Final Message

**STATUS: BLOCKED**  
**Report Path:** `docs/superpowers/plans/e2e-findings/shops.md`  
**Canonical QA Shop ID:** `S907`  
**Canonical QA Shop Detail URL:** `https://lyra-gray.vercel.app/shops/S907`  
**One-Line Summary:** Chrome-devtools MCP server connection timeout prevents all interactive testing; existing QA shop S907 (pre-mutated) is only residue available for downstream tasks.  
**Concerns:** MCP server handshake failure (critical blocker); test data pollution from prior run; Address field not persisted; canonical shop deviates from Step 2 spec.