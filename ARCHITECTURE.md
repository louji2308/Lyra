# Lyra 2.0 — Complete Architecture Reference

> AI Order Co-Pilot for FMCG Distributors · Shree Agencies Demo

---

## Table of Contents

1. [Project Identity](#1-project-identity)
2. [System Architecture — Full Diagram](#2-system-architecture--full-diagram)
3. [Tech Stack](#3-tech-stack)
4. [Database Schema — All 12 Tables](#4-database-schema--all-12-tables)
5. [Voice Engine — The State Machine](#5-voice-engine--the-state-machine)
6. [Intent Detection — How "Understand Tamil" Works](#6-intent-detection--how-understand-tamil-works)
7. [Script Templates — What Lyra Actually Says](#7-script-templates--what-lyra-actually-says)
8. [TTS Pipeline — Three Engines](#8-tts-pipeline--three-engines)
9. [STT Pipeline — Deepgram Real-Time](#9-stt-pipeline--deepgram-real-time)
10. [Twilio Live Call Flow — End to End](#10-twilio-live-call-flow--end-to-end)
11. [Browser Simulator Flow](#11-browser-simulator-flow)
12. [API Routes — All 15 Endpoints](#12-api-routes--all-15-endpoints)
13. [Backend Business Logic Layer](#13-backend-business-logic-layer)
14. [Client API Wrapper](#14-client-api-wrapper)
15. [Tool Schemas — Function Calling](#15-tool-schemas--function-calling)
16. [System Prompt — The Brain](#16-system-prompt--the-brain)
17. [Portal Pages — UI Architecture](#17-portal-pages--ui-architecture)
18. [Data Flow Diagrams](#18-data-flow-diagrams)
19. [Environment Variables](#19-environment-variables)
20. [File Inventory — Every File](#20-file-inventory--every-file)
21. [Demo Scenarios — Baked-In Test Cases](#21-demo-scenarios--baked-in-test-cases)
22. [Phases 0–9 Build Log](#22-phases-09-build-log)

---

## 1. Project Identity

```
┌─────────────────────────────────────────────────────────┐
│                    LYRA 2.0                             │
│           AI Order Co-Pilot for FMCG                    │
│                                                         │
│  Product:  Voice-first order taking for distributors    │
│  Client:   Shree Agencies (demo)                        │
│  Phone:    +91 806 535 5944 (Lyra's number)            │
│  Twilio:   +91 737 212 163 (outbound caller ID)        │
│  DB:       Supabase (mxjsnhbziewlpnsybbvq)             │
│  Repo:     C:\Users\LOUJAN B\Lyra                      │
│  Built:    2026-08-16 (single build day)                │
└─────────────────────────────────────────────────────────┘
```

---

## 2. System Architecture — Full Diagram

```
                          ┌──────────────────────────────────┐
                          │         USER'S PHONE             │
                          │    (Shop Owner / Distributor)    │
                          └──────────────┬───────────────────┘
                                         │
                                    Voice Call
                                         │
                          ┌──────────────▼───────────────────┐
                          │         TWILIO Cloud             │
                          │   PSTN ↔ SIP ↔ WebSocket        │
                          │   Phone: +917372212163           │
                          └──┬───────────────────────────┬───┘
                             │                           │
                    TwiML Response              Media Stream (WebSocket)
                    (POST /api/twilio/voice)    (base64 mulaw 8kHz)
                             │                           │
              ┌──────────────▼──┐            ┌───────────▼────────────┐
              │   Next.js App   │            │  twilio-server.ts      │
              │   Port 3000     │            │  Port 3001 (WS)        │
              │                 │            │                        │
              │  /api/call      │            │  Twilio ↔ Deepgram     │
              │  /api/twilio/*  │            │  ↔ Engine ↔ Sarvam     │
              └─────────────────┘            └──┬─────────┬───────┬───┘
                                                │         │       │
                                                │         │       │
                                    ┌───────────▼──┐  ┌───▼───┐  ┌▼──────────┐
                                    │   Deepgram   │  │ Engine│  │  Sarvam   │
                                    │   STT        │  │ (FSM) │  │  AI TTS   │
                                    │   nova-2     │  │       │  │  bulbul:v3│
                                    │   ta-IN      │  └───┬───┘  │  mulaw    │
                                    └──────────────┘      │      └───────────┘
                                                          │
                                              ┌───────────▼───────────┐
                                              │   Supabase (Live DB)  │
                                              │                       │
                                              │  12 tables            │
                                              │  5 shops              │
                                              │  15 products          │
                                              │  8 memories           │
                                              │  3 schemes            │
                                              └───────────────────────┘


═══════════════════════════════════════════════════════════════
  BROWSER SIMULATOR PATH (demo / no real phone call)
═══════════════════════════════════════════════════════════════

  ┌─────────────────────────────────────────────────────┐
  │              Browser (localhost:3000)                │
  │                                                     │
  │  ┌───────────────────────────────────────────────┐  │
  │  │         VoiceSimulator Component              │  │
  │  │                                               │  │
  │  │  User types/speaks → detectIntent() → engine  │  │
  │  │  → Lyra responds → speakLyra() → Edge TTS    │  │
  │  │                                               │  │
  │  │  API calls → Supabase (live data)             │  │
  │  └───────────────────────────────────────────────┘  │
  │                                                     │
  │  Web Speech API (ta-IN) for mic input               │
  │  Edge TTS (ta-IN-ValluvarNeural) for output         │
  └─────────────────────────────────────────────────────┘
```

---

## 3. Tech Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                 │
├─────────────────────────────────────────────────────────────────┤
│  React 19.2.8          │  UI library                            │
│  Next.js 16.3.1        │  App Router, SSR, API Routes           │
│  Tailwind CSS v4       │  Utility-first styling                 │
│  TypeScript 5          │  Type safety                           │
│  Web Speech API        │  Browser mic input (ta-IN)             │
├─────────────────────────────────────────────────────────────────┤
│                        BACKEND                                  │
├─────────────────────────────────────────────────────────────────┤
│  Supabase JS v2        │  Database client (PostgreSQL)          │
│  Twilio v6             │  Telephony (outbound calls)            │
│  @deepgram/sdk v5      │  Real-time STT (nova-2 model)          │
│  Sarvam AI API         │  TTS (bulbul:v3, Tamil, mulaw)         │
│  node-edge-tts         │  Browser TTS (free, neural voices)     │
│  ws v8                 │  WebSocket server (media streams)      │
│  tsx                   │  TypeScript execution (dev server)     │
│  concurrently          │  Parallel dev servers                  │
├─────────────────────────────────────────────────────────────────┤
│                        INFRASTRUCTURE                           │
├─────────────────────────────────────────────────────────────────┤
│  Supabase Cloud        │  PostgreSQL + RLS + Realtime           │
│  Twilio Cloud          │  PSTN ↔ WebSocket bridge               │
│  Deepgram Cloud        │  Neural speech-to-text                 │
│  Sarvam AI Cloud       │  Indian-language TTS                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Database Schema — All 12 Tables

```
                    ┌──────────────┐
                    │    routes    │
                    │──────────────│
                    │ route_id PK  │
                    │ route_name   │
                    │ salesperson  │
                    │ coverage_area│
                    │ is_active    │
                    └──────┬───────┘
                           │ 1
                           │
                           │ N
┌──────────────┐    ┌──────▼───────┐    ┌──────────────────┐
│  schemes     │    │    shops     │    │    blacklist     │
│──────────────│    │──────────────│    │──────────────────│
│ scheme_id PK │◄───│ shop_id PK   │───►│ blacklist_id PK  │
│ scheme_name  │    │ shop_name    │    │ shop_id FK       │
│ start_date   │    │ owner_name   │    │ product_id FK    │
│ end_date     │    │ phone_number │    │ reason           │
│ eligible_    │    │ whatsapp_num │    └──────────────────┘
│  product_ids │    │ pref_lang    │
│ min_quantity │    │ call_start   │    ┌──────────────────┐
│ benefit_type │    │ call_end     │    │  shop_memory     │
│ benefit_val  │    │ beat_route FK│    │──────────────────│
│ is_active    │    │ credit_limit │    │ memory_id PK     │
└──────────────┘    │ outstanding  │    │ shop_id FK       │
                    │ voice_consent│    │ memory_text      │
                    │ opt_out      │    │ memory_type      │
                    └──────┬───────┘    │ confidence_score │
                           │            │ confirmed_by_user│
              ┌────────────┼────┐       └──────────────────┘
              │            │    │
              │ N          │ N  │ N
              │            │    │
   ┌──────────▼──┐  ┌─────▼──┐ ┌▼─────────────┐
   │  orders     │  │ call_  │ │  complaints   │
   │─────────────│  │ logs   │ │───────────────│
   │ order_id PK │  │────────│ │ complaint_id  │
   │ shop_id FK  │  │call_id │ │ shop_id FK    │
   │ call_id FK  │  │shop_id │ │ call_id FK    │
   │ order_date  │  │ start  │ │ complaint_type│
   │ total_amount│  │ end    │ │ description   │
   │ credit_used │  │ lang   │ │ severity      │
   │ payment_    │  │ sentmt │ │ status        │
   │  status     │  │ order? │ │ callback_req  │
   │ order_      │  │ wa?    │ └───────────────┘
   │  status     │  │ escal? │
   └──────┬──────┘  │ summary│ ┌───────────────┐
          │         └────────┘ │   returns      │
          │ N                  │───────────────│
   ┌──────▼──────┐             │ return_id PK  │
   │ order_items │             │ shop_id FK    │
   │─────────────│             │ order_id FK   │
   │ item_id PK  │             │ product_id FK │
   │ order_id FK │             │ quantity      │
   │ product_id FK│            │ reason        │
   │ quantity    │             │ credit_note   │
   │ price       │             │ status        │
   │ line_total  │             └───────────────┘
   └─────────────┘

   ┌──────────────┐    ┌──────────────┐
   │   products   │    │  inventory   │
   │──────────────│    │──────────────│
   │ product_id PK│◄───│ product_id PK│
   │ product_name │    │ available_qty│
   │ brand        │    │ reserved_qty │
   │ category     │    │ restock_date │
   │ unit_type    │    │ low_stock_   │
   │ price        │    │  threshold   │
   │ tax_rate     │    └──────────────┘
   │ is_active    │
   └──────────────┘
```

### Seed Data Summary

| Table | Rows | Key Data |
|-------|------|----------|
| routes | 1 | R001: Tambaram Main Beat |
| shops | 5 | S101–S105, 5 languages, mixed credit states |
| products | 15 | 4 categories: Personal Care, Home Care, Oral Care, Beverages |
| inventory | 15 | S106 Surf Excel at 3 units (low stock) |
| schemes | 3 | Active discount/cashback promotions |
| orders | 5 | Pre-seeded order history |
| order_items | 11 | Line items for seeded orders |
| call_logs | 5 | Historical call records |
| shop_memory | 8 | AI-learned shop preferences |
| blacklist | 3 | S101: Lux Soap + Vim Bar, S102: Vim Bar |
| complaints | 1 | S102: damaged_goods, medium severity |
| returns | 1 | S102: 1 product, photo_received |

---

## 5. Voice Engine — The State Machine

The engine is the core decision-maker. It is a **deterministic finite state machine** — no LLM calls, no randomness. Every transition is pre-defined.

```
                            ┌─────────────┐
                            │  greeting   │  "Hello, this is Lyra..."
                            └──────┬──────┘
                                   │ user responds (any)
                                   ▼
                            ┌─────────────┐
                            │  good_time  │  "Is this a good time?"
                            └──────┬──────┘
                                   │ user says yes/no
                        ┌──────────┴──────────┐
                        │ yes                 │ no
                        ▼                     ▼
                 ┌──────────────┐      ┌──────────┐
                 │repeat_order  │      │   end    │
                 │              │      │"Thank you"│
                 │ (show repeat │      └──────────┘
                 │  order)      │
                 └──────┬───────┘
                        │ user says: change / yes / no / stop / complaint / return
                        │
          ┌─────────────┼──────────────┬──────────────┐
          │             │              │              │
          ▼             ▼              ▼              ▼
   ┌────────────┐ ┌──────────┐  ┌───────────┐ ┌──────────┐
   │  changes   │ │  end     │  │ complaint │ │  return  │
   │            │ │ (confirm)│  │           │  │          │
   │ "What do   │ └──────────┘  └─────┬─────┘  └────┬─────┘
   │  you want  │                     │              │
   │  to change?"│                    ▼              ▼
   └──────┬─────┘             ┌────────────┐  ┌───────────┐
          │                   │complaint_  │  │return_    │
          ▼                   │desc        │  │product    │
   ┌──────────────┐           │            │  │           │
   │  read_back   │           │ "Describe  │  │ "Which    │
   │              │           │  the       │  │  product?"│
   │ "Your order  │           │  problem"  │  └─────┬─────┘
   │  is..."      │           └─────┬──────┘        │
   └──────┬───────┘                 │               ▼
          │                         ▼         ┌───────────┐
          │ user says yes/no       ▼         │return_qty  │
          │                  ┌──────────┐    │            │
   ┌──────▼──────┐           │   end    │    │ "How many  │
   │   confirm   │           │(complaint│    │  are you   │
   │             │           │ logged)  │    │  returning?"│
   │ "Confirmed! │           └──────────┘    └─────┬──────┘
   │  WhatsApp?" │                                 │
   └──────┬──────┘                                 ▼
          │                                  ┌───────────┐
          ▼                                  │return_    │
   ┌──────────┐                              │reason     │
   │   end    │                              │           │
   │          │                              │ "Why are  │
   └──────────┘                              │  you      │
                                             │  returning?"│
                                             └─────┬─────┘
                                                   │
                                                   ▼
                                             ┌──────────┐
                                             │   end    │
                                             │(return   │
                                             │ logged)  │
                                             └──────────┘
```

### State Transition Table

| From State | Intent Detected | Next State | Action |
|------------|-----------------|------------|--------|
| greeting | any | good_time | — |
| good_time | yes | repeat_order | fetch suggested order |
| good_time | no / stop | end | — |
| repeat_order | change | changes | — |
| repeat_order | yes / other | read_back | show full order |
| repeat_order | no | end | — |
| repeat_order | complaint | complaint | — |
| repeat_order | return | return_product | — |
| changes | (user text) | read_back | apply changes |
| read_back | yes | confirm | create order + save memory |
| read_back | no (1st time) | changes | 1 correction allowed |
| read_back | no (2nd time) | confirm | force confirm |
| confirm | yes | end | send WhatsApp |
| confirm | no | end | skip WhatsApp |
| complaint | (user text) | complaint_desc | — |
| complaint_desc | (user text) | end | log complaint |
| return_product | (product name) | return_qty | — |
| return_qty | (number) | return_reason | — |
| return_reason | (reason text) | end | log return + credit note |
| any | stop | end | — |

### Key Engine Rules

```
┌─────────────────────────────────────────────────────────────┐
│ 1. "stop" always goes to end (from ANY state)              │
│ 2. Complaint/return detected in repeat_order → sub-flow    │
│ 3. Max 1 correction in read_back (2nd "no" → force confirm)│
│ 4. Order is created at read_back → confirm transition       │
│ 5. WhatsApp sent only if user says "yes" at confirm         │
│ 6. Complaint description is the raw user text               │
│ 7. Return product name is matched against product catalog   │
│ 8. Credit note = quantity × product price (auto-calculated) │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Intent Detection — How "Understand Tamil" Works

Lyra uses **keyword-based intent detection** (not ML/NLP). It matches user speech against pre-defined token lists for Tamil, Tanglish (Tamil written in English script), and English.

### Intent Priority Order

```
  ┌─────────────────────────────────────────────────┐
  │              INTENT PRIORITY                    │
  │                                                 │
  │  1. STOP      ← highest priority               │
  │  2. COMPLAINT                                   │
  │  3. RETURN                                      │
  │  4. CHANGE                                      │
  │  5. YES                                         │
  │  6. NO                                          │
  │  7. OTHER     ← default / unrecognized          │
  └─────────────────────────────────────────────────┘
```

### Token Lists

```
STOP TOKENS (any language variant → stops the call):
  Tamil:      "நிறுத்து", "போதும்", "வேண்டாம்", "முடிஞ்சுச்சு", "தேவையில்ல"
  Tanglish:   "stop", "podhum", "venam", "mudinjuchu", "thevaiyillai",
              "otha", "othuka", "podaaa"
  English:    "stop", "end", "cancel", "enough", "done"

COMPLAINT TOKENS (report a problem):
  Tamil:      "புகார்", "குறை", "சரியில்ல", "பிரச்சனை"
  Tanglish:   "complaint", "pukar", "kurai", "sariyilla",
              "prachana", "mattam", "batti", "kosu"
  English:    "complaint", "problem", "issue", "damaged", "wrong",
              "bad quality", "defective"

RETURN TOKENS (return a product):
  Tamil:      "திரும்ப", "ரிட்டர்ன்", "மாற்று"
  Tanglish:   "return", "thirumbu", "maaru", "edukku", "eduthukka"
  English:    "return", "take back", "exchange"

CHANGE TOKENS (modify the order):
  Tamil:      "மாற்று", "மாற்றணும்", "குறை", "கூட்டு"
  Tanglish:   "change", "maaru", "maatru", "edit", "modify",
              "add", "remove", "kurai", "koottu", "mathu"

YES TOKENS (confirm/accept):
  Tamil:      "ஆம்", "சரி", "ஓகே", "ம்ம்"
  Tanglish:   "yes", "sari", "okay", "ok", "aama", "ah",
              "hm", "hmm", "seri", "leave it", "default ah",
              "same ah", "adhey ah", "ready ah"

NO TOKENS (reject/disagree):
  Tamil:      "இல்ல", "வேண்டாம்"
  Tanglish:   "no", "illa", "illanga", "venam", "wrong",
              "virudhaaga", "illai"
```

### Detection Logic

```
┌──────────────────────────────────────────────────────┐
│  Intent Detection Algorithm                          │
│                                                      │
│  1. Normalize: lowercase, trim whitespace            │
│  2. For each intent (by priority):                   │
│     a. For each token in that intent's list:         │
│        - Build regex: /\b{token}\b/i                 │
│          (boundary-aware, case-insensitive)          │
│        - If regex matches userText → return intent   │
│  3. If no match → return "other"                     │
│                                                      │
│  KEY: stop is checked FIRST.                         │
│  "stop" in "okay stop" → STOP, not YES.             │
│  "complaint" in "I have a complaint" → COMPLAINT.   │
└──────────────────────────────────────────────────────┘
```

---

## 7. Script Templates — What Lyra Actually Says

Lyra speaks in **Tanglish** (Tamil words written in English script). These are the templates from `script.ts`:

```
┌─────────────────────────────────────────────────────────────────┐
│ GREETING                                                       │
│ "Hello {ownerName}! This is Lyra from Shree Agencies.          │
│  I'm calling to help you with your order."                     │
├─────────────────────────────────────────────────────────────────┤
│ GOOD TIME                                                      │
│ "Is this a good time to talk about your order?"                │
├─────────────────────────────────────────────────────────────────┤
│ REPEAT ORDER                                                   │
│ "{ownerName}, based on your last order, I suggest:"            │
│ "{items}"                                                      │
│ "Total: ₹{total}"                                              │
├─────────────────────────────────────────────────────────────────┤
│ READ BACK                                                      │
│ "Your order:"                                                  │
│ "{items}"                                                      │
│ "Total: ₹{total}. Shall I confirm this order?"                 │
├─────────────────────────────────────────────────────────────────┤
│ CHANGES                                                        │
│ "No problem! What would you like to change?"                   │
├─────────────────────────────────────────────────────────────────┤
│ CONFIRM                                                        │
│ "Great! Your order {orderId} is confirmed.                      │
│  Would you like a WhatsApp summary?"                           │
├─────────────────────────────────────────────────────────────────┤
│ COMPLAINT ASK                                                  │
│ "I'm sorry to hear that. Can you tell me more                  │
│  about the problem?"                                           │
├─────────────────────────────────────────────────────────────────┤
│ COMPLAINT CONFIRM                                              │
│ "I've logged your complaint. Our team will                     │
│  follow up with you soon."                                     │
├─────────────────────────────────────────────────────────────────┤
│ RETURN ASK                                                     │
│ "Sure, I can help with a return.                               │
│  Which product do you want to return?"                         │
├─────────────────────────────────────────────────────────────────┤
│ RETURN QTY                                                     │
│ "How many units are you returning?"                            │
├─────────────────────────────────────────────────────────────────┤
│ RETURN REASON                                                  │
│ "Got it. Can you tell me the reason for the return?"           │
├─────────────────────────────────────────────────────────────────┤
│ RETURN CONFIRM                                                 │
│ "Return logged. A credit note of ₹{amount} will be             │
│  applied to your account."                                     │
├─────────────────────────────────────────────────────────────────┤
│ BLACKLISTED PRODUCT                                            │
│ "Sorry, {product} is currently not available                   │
│  for your shop. Would you like to choose something else?"      │
├─────────────────────────────────────────────────────────────────┤
│ END (various)                                                  │
│ CONFIRMED:    "Thank you {ownerName}! Order placed.            │
│                Have a great day!"                               │
│ CANCELLED:    "No problem! If you need anything,               │
│                just give us a call. Bye!"                       │
│ COMPLAINT:    "Your complaint has been noted.                  │
│                We'll get back to you. Bye!"                     │
│ RETURN:       "Your return has been processed.                 │
│                Credit note will be applied. Bye!"               │
│ STOP:         "Okay, goodbye!"                                  │
│ NO_TIME:      "No problem! I'll call you another time. Bye!"   │
│ DEFAULT:      "Thank you! Have a great day!"                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. TTS Pipeline — Three Engines

Lyra has **three TTS engines** for different contexts:

```
┌─────────────────────────────────────────────────────────────────┐
│                     TTS ENGINE SELECTION                        │
│                                                                 │
│  ┌───────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │    EDGE TTS       │  │   SARVAM AI      │  │   BHASHINI   │ │
│  │ (Browser Demo)    │  │ (Live Phone)     │  │ (Paused)     │ │
│  ├───────────────────┤  ├──────────────────┤  ├──────────────┤ │
│  │ Free              │  │ Paid (API key)   │  │ Free (Govt)  │ │
│  │ Neural quality    │  │ Bulbul v3        │  │ IndicTTS     │ │
│  │ MP3 output        │  │ Mulaw 8kHz       │  │ WAV output   │ │
│  │ ta-IN-ValluvarN   │  │ Tamil native     │  │ Tamil native │ │
│  │ Browser playback  │  │ Twilio-compatible│  │ Not active   │ │
│  └─────────┬─────────┘  └────────┬─────────┘  └──────┬───────┘ │
│            │                     │                    │         │
│            ▼                     ▼                    ▼         │
│     ┌──────────┐          ┌──────────┐         ┌──────────┐    │
│     │ Simulator│          │  Twilio  │         │  (N/A)   │    │
│     │  audio   │          │  stream  │         │          │    │
│     └──────────┘          └──────────┘         └──────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Edge TTS (Browser Simulator)

```
┌─────────────────────────────────────────────────────────────┐
│  Flow: Browser Simulator → /api/tts → Edge TTS → audio     │
│                                                             │
│  1. speakLyra(text) in tts.ts                               │
│  2. POST /api/tts { text, voice }                           │
│  3. tts.ts route handler:                                   │
│     a. Try Bhashini first (if BHASHINI_* env vars set)     │
│     b. Fall back to Edge TTS (node-edge-tts package)        │
│     c. Voice: ta-IN-ValluvarNeural (male)                   │
│        or ta-IN-PallaviNeural (female)                      │
│     d. Rate: -10%, Pitch: -5Hz                              │
│  4. Return MP3 audio blob to browser                        │
│  5. Browser creates HTMLAudioElement, plays audio           │
│  6. Fallback: if API fails → browser speechSynthesis        │
│                                                             │
│  Cost: FREE                                                 │
│  Quality: Microsoft Neural (very natural)                   │
│  Latency: ~200-500ms                                        │
└─────────────────────────────────────────────────────────────┘
```

### Sarvam AI TTS (Live Phone Calls)

```
┌─────────────────────────────────────────────────────────────┐
│  Flow: twilio-server.ts → Sarvam API → mulaw audio → Twilio│
│                                                             │
│  1. synthesizeSarvamTTSMulaw(text) in sarvam.ts             │
│  2. POST https://api.sarvam.ai/text-to-speech              │
│     Headers:                                                │
│       api-subscription-key: {SARVAM_API_KEY}                │
│       Content-Type: application/json                        │
│     Body:                                                   │
│       {                                                     │
│         "text": "...",                                      │
│         "target_language_code": "ta-IN",                    │
│         "speaker": "shubh",                                 │
│         "model": "bulbul:v3",                               │
│         "audio_format": "mulaw",                            │
│         "sample_rate": 8000,                                │
│         "pace": 1.0,                                        │
│         "loudness": 1.0,                                    │
│         "pitch": 1.0                                        │
│       }                                                     │
│  3. Response: raw mulaw audio bytes                         │
│  4. twilio-server sends audio to Twilio via WebSocket:      │
│     { event: "media", streamSid, media: {                   │
│       payload: audioBuffer.toString("base64") }}            │
│                                                             │
│  Cost: ~₹0.05-0.10 per call                                │
│  Quality: Native Tamil (bulbul model)                       │
│  Latency: ~1-3 seconds                                     │
│  Format: mulaw 8kHz (Twilio native)                         │
└─────────────────────────────────────────────────────────────┘
```

### Bhashini / ULCA TTS (Paused)

```
┌─────────────────────────────────────────────────────────────┐
│  Flow: /api/tts → Bhashini API → AI4Bharat IndicTTS → audio│
│                                                             │
│  STATUS: PAUSED (env keys empty)                            │
│                                                             │
│  1. bhashiniTts(text) in bhashini.ts                        │
│  2. GET MeitY ULCA API → fetch pipeline config              │
│     (cached for 5 minutes)                                  │
│  3. English → Tamil transliteration                         │
│  4. POST AI4Bharat IndicTTS (speaker: "hm系")               │
│  5. Return WAV audio                                        │
│                                                             │
│  Cost: FREE (Government of India service)                   │
│  Quality: Decent (research model)                           │
│  Latency: ~2-5 seconds                                      │
│  Note: Requires BHASHINI_USER_ID + BHASHINI_ULCA_API_KEY   │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. STT Pipeline — Deepgram Real-Time

```
┌─────────────────────────────────────────────────────────────┐
│                 DEEPGRAM STT PIPELINE                       │
│                                                             │
│  Model: nova-2 (latest, most accurate)                      │
│  Language: ta-IN (Tamil)                                    │
│  Encoding: mulaw (from Twilio)                              │
│  Sample Rate: 8000 Hz (Twilio native)                       │
│                                                             │
│  ┌─────────────┐     ┌──────────────┐     ┌──────────────┐ │
│  │   User      │     │   Twilio     │     │  Deepgram    │ │
│  │   speaks    │────►│   Media      │────►│  Cloud       │ │
│  │   into      │     │   Stream     │     │              │ │
│  │   phone     │     │   (base64)   │     │  WebSocket   │ │
│  └─────────────┘     └──────────────┘     └──────┬───────┘ │
│                                                   │         │
│                                          Transcription      │
│                                          (interim + final)  │
│                                                   │         │
│                                          ┌────────▼───────┐ │
│                                          │  twilio-server │ │
│                                          │                │ │
│                                          │  if (is_final) │ │
│                                          │    → engine()  │ │
│                                          │    → respond   │ │
│                                          └────────────────┘ │
│                                                             │
│  Features used:                                             │
│  - interim_results: true  (partial transcripts)             │
│  - utterance_end_ms: 1000 (detect silence)                  │
│  - vad_events: true        (voice activity detection)       │
│                                                             │
│  Cost: ~$0.0059/min (Deepgram pricing)                      │
│  Latency: ~200-500ms for final transcript                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. Twilio Live Call Flow — End to End

```
PHASE 1: INITIATE CALL
═══════════════════════

  User clicks "Live Call" button
         │
         ▼
  POST /api/call { shop_id: "S101" }
         │
         ▼
  getShopContext("S101") → phone_number: "+919876543210"
         │
         ▼
  twilioClient.calls.create({
    to: "+919876543210",
    from: "+917372212163",
    url: "http://localhost:3000/api/twilio/voice"
  })
         │
         ▼
  Returns { call_sid: "CA...", to: "+919876543210" }


PHASE 2: TWILIO WEBHOOK
═════════════════════════

  Twilio initiates call, hits webhook:
         │
         ▼
  POST /api/twilio/voice
         │
         ▼
  Returns TwiML XML:
  <?xml version="1.0" encoding="UTF-8"?>
  <Response>
    <Connect>
      <Stream url="wss://localhost:3001">
        <Parameter name="shop_id" value="S101"/>
      </Stream>
    </Connect>
  </Response>
         │
         ▼
  Twilio opens WebSocket to ws://localhost:3001


PHASE 3: WEBSOCKET BRIDGE
══════════════════════════

  ┌─────────────────────────────────────────────────────────┐
  │  twilio-server.ts (port 3001)                           │
  │                                                         │
  │  1. Twilio WebSocket connects                           │
  │  2. Create Deepgram connection (nova-2, ta-IN, mulaw)   │
  │  3. Twilio sends audio events (media)                   │
  │  4. Forward audio to Deepgram                           │
  │  5. Deepgram returns transcription                      │
  │  6. On is_final → run engine()                          │
  │  7. Engine returns { agentText, state }                  │
  │  8. Synthesize agentText via Sarvam TTS (mulaw)         │
  │  9. Send audio back to Twilio                           │
  │ 10. Twilio plays audio to phone                         │
  └─────────────────────────────────────────────────────────┘


PHASE 4: CONVERSATION LOOP
═══════════════════════════

  ┌────────────────────────────────────────────────────────┐
  │                                                        │
  │  User speaks ──► Deepgram STT ──► Engine ──► Sarvam   │
  │       ▲                                     │         │
  │       │          Twilio streams             │         │
  │       └─────────────────────────────────────┘         │
  │                                                        │
  │  This loop continues until state = "end"              │
  │  Max ~8-10 turns for a typical order                  │
  └────────────────────────────────────────────────────────┘
```

---

## 11. Browser Simulator Flow

```
┌─────────────────────────────────────────────────────────────┐
│              BROWSER SIMULATOR FLOW                         │
│                                                             │
│  1. User selects shop from dropdown                         │
│     │                                                       │
│     ▼                                                       │
│  2. identifyShopByPhone(phone) → ShopContext                │
│     │                                                       │
│     ▼                                                       │
│  3. getSuggestedOrder(shopId) → Repeat items                │
│     │                                                       │
│     ▼                                                       │
│  4. initializeVoiceContext(shop, suggestedOrder)            │
│     │                                                       │
│     ▼                                                       │
│  5. startCall(context) → "Hello {name}..."                  │
│     │                                                       │
│     ▼                                                       │
│  6. ┌─── USER INPUT LOOP ───────────────────────────────┐  │
│     │                                                    │  │
│     │  Option A: Type in text box                        │  │
│     │  Option B: Click mic → Web Speech API (ta-IN)      │  │
│     │           → speechRecognition.onresult → text      │  │
│     │                                                    │  │
│     │  → detectIntent(userText) → Intent                 │  │
│     │  → step(state, intent, userText, context)          │  │
│     │    → { state: nextState, agentText, toolCalls? }   │  │
│     │                                                    │  │
│     │  If toolCalls → execute API calls:                 │  │
│     │    - createOrder() → POST /api/create-order        │  │
│     │    - saveMemory() → POST /api/save-memory          │  │
│     │    - sendWhatsApp() → POST /api/send-whatsapp      │  │
│     │    - markOptOut() → POST /api/mark-opt-out         │  │
│     │    - createReturn() → POST /api/create-return      │  │
│     │                                                    │  │
│     │  → speakLyra(agentText)                            │  │
│     │    → POST /api/tts → Edge TTS → audio blob        │  │
│     │    → HTMLAudioElement.play()                        │  │
│     │                                                    │  │
│     │  → Update chat transcript (scrollable)             │  │
│     │  → Update DB trace panel (API call log)            │  │
│     │  → Update call flow progress bar                   │  │
│     │                                                    │  │
│     │  Loop until state = "end"                          │  │
│     └────────────────────────────────────────────────────┘  │
│                                                             │
│  Database Trace Panel shows:                                │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Tool              │ Detail          │ Status        │     │
│  │ identify_shop     │ S101 Kannan     │ ok            │     │
│  │ suggested_order   │ 4 items         │ ok            │     │
│  │ create_order      │ ORD1025         │ ok            │     │
│  │ save_memory       │ timing: 8am     │ ok            │     │
│  │ send_whatsapp     │ msg preview     │ ok            │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## 12. API Routes — All 15 Endpoints

```
┌─────────────────────────────────────────────────────────────────┐
│                    API ROUTE MAP                                │
│                                                                 │
│  BASE: http://localhost:3000/api                                │
│                                                                 │
│  SHOP & CONTEXT                                                 │
│  ├── GET  /shop-context?phone=XXX or ?shop_id=XXX              │
│  │       → full shop context (credit, blacklist, memories)     │
│  ├── GET  /suggested-order?shop_id=XXX                         │
│  │       → repeat order suggestion from last order             │
│  └── GET  /schemes                                             │
│          → active promotion schemes                             │
│                                                                 │
│  ORDER FLOW                                                     │
│  ├── POST /check-stock      { product_id, quantity? }          │
│  ├── POST /check-credit     { shop_id, order_total }           │
│  ├── POST /create-order     { shop_id, items[], ... }          │
│  └── POST /check-blacklist  { shop_id, product_id }            │
│                                                                 │
│  MEMORY & LEARNING                                              │
│  └── POST /save-memory      { shop_id, memory_text, type }     │
│                                                                 │
│  COMPLAINT & RETURN                                             │
│  ├── POST /save-complaint   { shop_id, type, description }     │
│  └── POST /create-return    { shop_id, product_id, qty }       │
│                                                                 │
│  COMPLIANCE                                                     │
│  └── POST /mark-opt-out     { shop_id }                        │
│                                                                 │
│  COMMUNICATION                                                  │
│  └── POST /send-whatsapp    { shop_id, order_id }              │
│                                                                 │
│  TTS                                                            │
│  ├── GET  /tts              → list available voices             │
│  ├── POST /tts              { text, voice } → audio blob       │
│  └── OPTIONS /tts           → CORS preflight                   │
│                                                                 │
│  TELEPHONY (Twilio)                                             │
│  ├── POST /call             { shop_id } → initiates call       │
│  └── POST /twilio/voice     → TwiML webhook for Media Stream   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 13. Backend Business Logic Layer

All server-side logic lives in `backend.ts` (742 lines). Here are the key functions and their logic:

```
┌─────────────────────────────────────────────────────────────────┐
│ identifyShopByPhone(phone)                                      │
│ ├── Normalize phone: remove +91, spaces, dashes                │
│ ├── Query: SELECT * FROM shops WHERE phone_number LIKE '%{n}'  │
│ └── Return: ShopContextResult (shop + phone_number)            │
├─────────────────────────────────────────────────────────────────┤
│ getShopContext(shopId)                                          │
│ ├── 1. Fetch shop record                                       │
│ ├── 2. Compute credit: limit - outstanding = available         │
│ ├── 3. Fetch blacklist items (product join)                    │
│ ├── 4. Fetch last order (date + items)                         │
│ ├── 5. Fetch memories (sorted by confidence DESC)              │
│ ├── 6. Fetch active schemes                                    │
│ ├── 7. Validate call time:                                     │
│ │      NOW() BETWEEN call_start AND call_end                   │
│ │      → is_valid_call_time: boolean                           │
│ │      → next_valid_window: "Tomorrow 9am" (if invalid)        │
│ ├── 8. Compute days_since_last_order                           │
│ └── Return: aggregated context object                          │
├─────────────────────────────────────────────────────────────────┤
│ getSuggestedOrder(shopId)                                       │
│ ├── 1. Get most recent order's items                           │
│ ├── 2. Get blacklist product IDs for this shop                 │
│ ├── 3. Filter: exclude blacklisted items from repeat order     │
│ ├── 4. Detect missing product categories                       │
│ │      (compare shop's usual categories vs last order)         │
│ ├── 5. Suggest new product from inventory if category missing  │
│ └── Return: { repeat_order, missing_categories, new_product }  │
├─────────────────────────────────────────────────────────────────┤
│ createOrder(shopId, items[], context)                           │
│ ├── 1. Generate order_id: ORD + auto-increment (ORD0001...)    │
│ ├── 2. Generate call_id: CALL + auto-increment (CALL001...)    │
│ ├── 3. Calculate total_amount (sum of line_total)              │
│ ├── 4. INSERT INTO orders                                      │
│ ├── 5. INSERT INTO order_items (one per product)               │
│ ├── 6. INSERT INTO call_logs (with transcript summary)         │
│ ├── 7. UPDATE shops:                                           │
│ │      - last_order_date = NOW()                               │
│ │      - outstanding_balance += total_amount                    │
│ └── Return: { order_id, call_id, total_amount }                │
├─────────────────────────────────────────────────────────────────┤
│ createReturn(shopId, productId, quantity, reason, orderId?)    │
│ ├── 1. Look up product price                                   │
│ ├── 2. Calculate credit_note = quantity × price                │
│ ├── 3. INSERT INTO returns                                     │
│ ├── 4. UPDATE shops: outstanding_balance -= credit_note         │
│ └── Return: { return_id, credit_note_amount, status }          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 14. Client API Wrapper

`client.ts` provides a typed client-side interface to all API routes:

```
┌─────────────────────────────────────────────────────────────────┐
│ voiceApi (client.ts)                                           │
│                                                                 │
│  .identifyShopByPhone(phone)                                    │
│    → GET /api/shop-context?phone={phone}                       │
│                                                                 │
│  .getShopContext(shopId)                                        │
│    → GET /api/shop-context?shop_id={shopId}                    │
│                                                                 │
│  .getSuggestedOrder(shopId)                                     │
│    → GET /api/suggested-order?shop_id={shopId}                 │
│                                                                 │
│  .checkStock(productId, quantity?)                              │
│    → POST /api/check-stock                                     │
│                                                                 │
│  .checkCredit(shopId, orderTotal)                               │
│    → POST /api/check-credit                                    │
│                                                                 │
│  .createOrder(shopId, items, context?)                          │
│    → POST /api/create-order                                    │
│                                                                 │
│  .saveMemory(shopId, text, type)                                │
│    → POST /api/save-memory                                     │
│                                                                 │
│  .saveComplaint(shopId, type, description?)                     │
│    → POST /api/save-complaint                                  │
│                                                                 │
│  .markOptOut(shopId)                                           │
│    → POST /api/mark-opt-out                                    │
│                                                                 │
│  .checkBlacklist(shopId, productId)                             │
│    → POST /api/check-blacklist                                 │
│                                                                 │
│  .sendWhatsApp(shopId, orderId)                                │
│    → POST /api/send-whatsapp                                   │
│                                                                 │
│  .createReturn(shopId, productId, quantity, reason?, orderId?) │
│    → POST /api/create-return                                   │
│                                                                 │
│  .getSchemes()                                                 │
│    → GET /api/schemes                                          │
│                                                                 │
│  All methods: post<T>(url, body) or get<T>(url)                │
│  Error handling: throws VoiceApiError on non-OK response       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 15. Tool Schemas — Function Calling

OpenAI-compatible tool definitions for the engine:

```
┌─────────────────────────────────────────────────────────────────┐
│  VOICE_TOOLS (11 tools)                                        │
│                                                                 │
│  1. identify_shop_by_phone                                     │
│     params: { phone_number: string }                           │
│                                                                 │
│  2. get_shop_context                                           │
│     params: { shop_id: string }                                │
│                                                                 │
│  3. get_repeat_order                                           │
│     params: { shop_id: string }                                │
│                                                                 │
│  4. check_stock                                                │
│     params: { product_id: string, quantity?: number }          │
│                                                                 │
│  5. check_credit                                               │
│     params: { shop_id: string, order_total: number }           │
│                                                                 │
│  6. check_blacklist                                            │
│     params: { shop_id: string, product_id: string }            │
│                                                                 │
│  7. create_order                                               │
│     params: { shop_id: string, items: Array<{                  │
│       product_id: string, quantity: number                     │
│     }> }                                                       │
│                                                                 │
│  8. send_whatsapp_summary                                      │
│     params: { shop_id: string, order_id: string }              │
│                                                                 │
│  9. mark_opt_out                                               │
│     params: { shop_id: string }                                │
│                                                                 │
│  10. create_return                                             │
│      params: { shop_id: string, product_id: string,            │
│        quantity: number, reason?: string,                       │
│        order_id?: string }                                     │
│                                                                 │
│  11. get_schemes                                               │
│      params: {}  (no parameters)                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 16. System Prompt — The Brain

```
┌─────────────────────────────────────────────────────────────────┐
│                    LYRA SYSTEM PROMPT                           │
│                                                                 │
│  Identity:                                                     │
│  "You are Lyra, a professional voice assistant for             │
│   Shree Agencies, an FMCG distributor."                        │
│                                                                 │
│  Call Flow:                                                    │
│  1. Greet shop owner by name                                   │
│  2. Confirm it's a good time to talk                           │
│  3. Suggest repeat order from last purchase                    │
│  4. Allow changes (add/remove/modify quantities)               │
│  5. Read back full order for confirmation                      │
│  6. Create order on confirmation                               │
│  7. Offer WhatsApp summary                                     │
│  8. End call                                                   │
│                                                                 │
│  Hard Rules:                                                   │
│  1. Never hallucinate product names or prices                  │
│  2. Always read back the order before confirming               │
│  3. Respect opt-out requests immediately                       │
│  4. Check stock before adding items                            │
│  5. Check credit before confirming                             │
│  6. Maximum 2 sentences per response                           │
│  7. Use Tanglish (Tamil + English) by default                  │
│  8. If user says "complaint" → enter complaint flow            │
│  9. If user says "return" → enter return flow                  │
│                                                                 │
│  Available Tools: (all 11 from tool schemas)                   │
│                                                                 │
│  Tone: Warm, professional, efficient                           │
│  Language: Tanglish (Tamil words in English script)            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 17. Portal Pages — UI Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PORTAL PAGES                                 │
│                                                                 │
│  / ──────────────► redirect to /shops                           │
│                                                                 │
│  /shops                                                        │
│  ├── Summary stats (shops, credit risk, overdue, orders)       │
│  └── Table: name, owner, language, credit bar, last order,     │
│             order count, blacklist count, flags                 │
│                                                                 │
│  /shops/[id]                                                   │
│  ├── Credit Health Card (progress bar, available vs owed)      │
│  ├── Shop Profile (phone, WhatsApp, language, call window)     │
│  ├── AI Memory List (text, type, confidence, confirmed)        │
│  ├── Blacklist (product name + reason)                         │
│  ├── Orders (OrderCard components)                             │
│  ├── Complaints (type, severity, status, callback)             │
│  ├── Call Logs (timestamp, language, sentiment, summary)       │
│  └── Returns (product, quantity, status, credit note)          │
│                                                                 │
│  /orders                                                       │
│  ├── Stats (total, value, active, delivered)                   │
│  ├── Active Orders section                                     │
│  └── Order History section                                     │
│                                                                 │
│  /memory                                                       │
│  └── (AI Memory page — pending)                                │
│                                                                 │
│  /exceptions                                                   │
│  └── (Exceptions page — pending)                               │
│                                                                 │
│  /voice                                                        │
│  └── VoiceSimulator component (full-width)                     │
│      ├── Left panel: Call simulator                            │
│      │   ├── Shop selector dropdown                            │
│      │   ├── Start Call / Live Call buttons                    │
│      │   ├── Chat transcript (scrollable)                      │
│      │   ├── Text input + mic button                           │
│      │   └── TTS toggle + voice picker                         │
│      └── Right panel:                                          │
│          ├── Database Trace (API call log)                     │
│          ├── Call Flow Progress (step indicators)              │
│          ├── System Prompt (copyable)                          │
│          └── Tool Schemas (copyable)                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 18. Data Flow Diagrams

### DFD 1: Shop Identification

```
  Phone call arrives
       │
       ▼
  Twilio → POST /api/twilio/voice
       │
       ▼
  TwiML: <Connect><Stream url="..."/>
       │
       ▼
  WebSocket: Twilio sends "start" event with shop_id param
       │
       ▼
  twilio-server: session.ctx.shop_id = "S101"
       │
       ▼
  getShopContext("S101") → Supabase
       │
       ▼
  Full context: credit, blacklist, memories, schemes, call_time
```

### DFD 2: Order Creation

```
  User: "Yes, confirm the order"
       │
       ▼
  detectIntent("yes") → "yes"
       │
       ▼
  engine("read_back", "yes", context)
       │
       ├── toolCalls: [create_order, save_memory, send_whatsapp]
       │
       ▼
  voiceApi.createOrder(shopId, items)
       │
       ▼
  POST /api/create-order
       │
       ├── INSERT orders (ORD1025, shop_id, total, ...)
       ├── INSERT order_items (11 rows)
       ├── INSERT call_logs (CALL001, transcript, ...)
       └── UPDATE shops (last_order_date, outstanding_balance)
       │
       ▼
  Return: { order_id: "ORD1025", total_amount: 4200 }
```

### DFD 3: Complaint Flow

```
  User: "I have a complaint about Surf Excel"
       │
       ▼
  detectIntent("complaint about Surf Excel") → "complaint"
       │
       ▼
  engine("repeat_order", "complaint", ctx)
       │
       ├── state → "complaint"
       ├── agentText → "I'm sorry to hear that..."
       │
       ▼
  User: "It was damaged when I received it"
       │
       ▼
  engine("complaint", "It was damaged...", ctx)
       │
       ├── state → "complaint_desc"
       ├── agentText → "Can you tell me more..."
       │
       ▼
  User: "The box was crushed and product leaked"
       │
       ▼
  engine("complaint_desc", "The box was crushed...", ctx)
       │
       ├── state → "end"
       ├── toolCalls: [save_complaint]
       │
       ▼
  voiceApi.saveComplaint(shopId, "damaged_goods", "The box was crushed...")
       │
       ▼
  POST /api/save-complaint → INSERT complaints
```

### DFD 4: Return Flow

```
  User: "I want to return Vim Bar"
       │
       ▼
  detectIntent("return") → "return"
       │
       ▼
  engine → state: "return_product"
       │
       ▼
  User: "Vim Bar"
       │
       ▼
  engine → match "Vim Bar" to product catalog → state: "return_qty"
       │
       ▼
  User: "5 packets"
       │
       ▼
  engine → parse quantity=5 → state: "return_reason"
       │
       ▼
  User: "They were expired"
       │
       ▼
  engine → state: "end"
       │
       ├── toolCalls: [create_return]
       │
       ▼
  voiceApi.createReturn(shopId, "P004", 5, "expired")
       │
       ▼
  POST /api/create-return
       │
       ├── credit_note = 5 × ₹25 = ₹125
       ├── INSERT returns
       └── UPDATE shops (outstanding_balance -= 125)
```

---

## 19. Environment Variables

```
┌─────────────────────────────────────────────────────────────────┐
│  Variable                    │  Value / Status                  │
├──────────────────────────────┼──────────────────────────────────┤
│ NEXT_PUBLIC_SUPABASE_URL     │  https://mxjsnhbz...supabase.co │
│ NEXT_PUBLIC_SUPABASE_ANON_KEY│  sb_publishable_...              │
│                              │                                  │
│ LYRA_PHONE_NUMBER            │  +918065355944                   │
│                              │                                  │
│ TWILIO_ACCOUNT_SID           │  AC4995...                       │
│ TWILIO_AUTH_TOKEN            │  ad9146...                       │
│ TWILIO_PHONE_NUMBER          │  +917372212163                   │
│ TWILIO_WS_PORT               │  3001                            │
│                              │                                  │
│ DEEPGRAM_API_KEY             │  9715c7...                       │
│                              │                                  │
│ SARVAM_API_KEY               │  sk_0g1j...                      │
│                              │                                  │
│ BHASHINI_USER_ID             │  (empty — paused)                │
│ BHASHINI_ULCA_API_KEY        │  (empty — paused)                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 20. File Inventory — Every File

```
portal/
├── .env.local                          (20 lines)   Environment variables
├── next.config.ts                      (7 lines)    Next.js config
├── package.json                        (36 lines)   Dependencies + scripts
├── package-lock.json                   (21K lines)  Lock file
├── postcss.config.mjs                  (6 lines)    PostCSS config
├── tailwind.config.ts                  (13 lines)   Tailwind config
├── tsconfig.json                       (23 lines)   TypeScript config
├── twilio-server.ts                    (215 lines)  Twilio WebSocket bridge
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                  (35 lines)   Root layout + fonts
│   │   ├── page.tsx                    (5 lines)    Redirect to /shops
│   │   ├── not-found.tsx               (21 lines)   404 page
│   │   │
│   │   ├── shops/
│   │   │   ├── page.tsx                (174 lines)  Shops list
│   │   │   └── [id]/
│   │   │       └── page.tsx            (433 lines)  Shop detail
│   │   │
│   │   ├── orders/
│   │   │   └── page.tsx                (87 lines)   Orders list
│   │   │
│   │   ├── voice/
│   │   │   └── page.tsx                (33 lines)   Voice simulator page
│   │   │
│   │   ├── memory/
│   │   │   └── page.tsx                (pending)    AI Memory page
│   │   │
│   │   ├── exceptions/
│   │   │   └── page.tsx                (pending)    Exceptions page
│   │   │
│   │   └── api/
│   │       ├── shop-context/route.ts   (24 lines)   GET shop context
│   │       ├── suggested-order/route.ts(18 lines)   GET suggested order
│   │       ├── check-stock/route.ts    (18 lines)   POST check stock
│   │       ├── check-credit/route.ts   (17 lines)   POST check credit
│   │       ├── create-order/route.ts   (34 lines)   POST create order
│   │       ├── save-memory/route.ts    (35 lines)   POST save memory
│   │       ├── save-complaint/route.ts (31 lines)   POST save complaint
│   │       ├── mark-opt-out/route.ts   (16 lines)   POST mark opt-out
│   │       ├── check-blacklist/route.ts(21 lines)   POST check blacklist
│   │       ├── send-whatsapp/route.ts  (21 lines)   POST send WhatsApp
│   │       ├── create-return/route.ts  (33 lines)   POST create return
│   │       ├── schemes/route.ts        (14 lines)   GET schemes
│   │       ├── tts/route.ts            (109 lines)  GET/POST TTS
│   │       ├── call/route.ts           (40 lines)   POST initiate call
│   │       └── twilio/
│   │           └── voice/route.ts      (20 lines)   POST TwiML webhook
│   │
│   ├── components/
│   │   ├── app-shell.tsx               (39 lines)   Layout shell + nav
│   │   ├── nav.tsx                     (89 lines)   Navigation items
│   │   ├── order-card.tsx              (58 lines)   Order card component
│   │   ├── voice-simulator.tsx         (691 lines)  Voice call simulator
│   │   └── ui.tsx                      (186 lines)  Shared UI primitives
│   │
│   └── lib/
│       ├── supabase.ts                 (12 lines)   Supabase client
│       ├── types.ts                    (224 lines)  All TypeScript types
│       ├── data.ts                     (325 lines)  Server data fetching
│       ├── format.ts                   (99 lines)   Formatting utilities
│       ├── tones.ts                    (109 lines)  Color/status mappings
│       │
│       └── voice/
│           ├── types.ts                (46 lines)   Voice-specific types
│           ├── engine.ts               (211 lines)  State machine
│           ├── intents.ts              (69 lines)   Intent detection
│           ├── script.ts               (56 lines)   Script templates
│           ├── prompt.ts               (26 lines)   System prompt
│           ├── tools.ts                (154 lines)  Tool schemas
│           ├── client.ts               (214 lines)  API client wrapper
│           ├── backend.ts              (742 lines)  Business logic
│           ├── tts.ts                  (71 lines)   Browser TTS helper
│           ├── twilio.ts               (42 lines)   Twilio client
│           ├── sarvam.ts               (71 lines)   Sarvam TTS client
│           └── bhashini.ts             (217 lines)  Bhashini TTS (paused)
│
├── supabase/
│   ├── migrations/
│   │   └── 20260816000000_initial_schema.sql  (356 lines)
│   └── seed.sql                                    (180 lines)
│
└── Progress.md                         (234 lines)  Build log
```

**Total: ~4,500 lines of custom code (excluding dependencies)**

---

## 21. Demo Scenarios — Baked-In Test Cases

```
┌─────────────────────────────────────────────────────────────────┐
│  SHOP          │ LANGUAGE │ SCENARIO                            │
├─────────────────────────────────────────────────────────────────┤
│ S101 Kannan    │ Tanglish │ Credit tight (₹2,500 available)    │
│ Stores         │          │ Order must not exceed limit         │
│                │          │ Blacklisted: Lux Soap, Vim Bar      │
│                │          │ 8am-10pm call window                │
├─────────────────────────────────────────────────────────────────┤
│ S102 Murugan   │ Tamil    │ Has open complaint (damaged goods)  │
│ Store          │          │ Has pending return (photo_received)  │
│                │          │ Blacklisted: Vim Bar                 │
├─────────────────────────────────────────────────────────────────┤
│ S103 Lakshmi   │ Tamil    │ Clean profile, no issues            │
│ Traders        │          │ Good for basic order flow demo      │
├─────────────────────────────────────────────────────────────────┤
│ S104 Rajesh    │ Hindi    │ Hindi language demo                  │
│ General        │          │ Standard credit/stock               │
├─────────────────────────────────────────────────────────────────┤
│ S105 Priya     │ English  │ English language demo                │
│ Provisions     │          │ Standard credit/stock               │
├─────────────────────────────────────────────────────────────────┤
│                │          │                                     │
│ SPECIAL PRODUCTS:                                               │
│ P006 Surf Excel │ 3 units in stock (below threshold of 5)      │
│                 │ → triggers low stock exception                 │
│ P004 Vim Bar    │ blacklisted for S101 and S102                 │
│ P001 Lux Soap   │ blacklisted for S101                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 22. Phases 0–9 Build Log

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE  │ NAME                          │ DATE      │ STATUS   │
├─────────┼───────────────────────────────┼───────────┼──────────┤
│    0    │ Freeze the Scope              │ 2026-08-16│  ✅ Done │
│    1    │ Build the Data Brain          │ 2026-08-16│  ✅ Done │
│    2    │ Build the Agency Portal       │ 2026-08-16│  ✅ Done │
│    3    │ Build the Voice AI Foundation │ 2026-08-16│  ✅ Done │
│    4    │ Connect Voice to Database     │ 2026-08-16│  ✅ Done │
│    5    │ Add Business Rules            │ 2026-08-16│  ✅ Done │
│    6    │ Add WhatsApp Layer            │ 2026-08-16│  ✅ Done │
│    7    │ Add Memory + Blacklist        │ 2026-08-16│  ✅ Done │
│    8    │ Add Complaint / Return Flow   │ 2026-08-16│  ✅ Done │
│    9    │ Split into Multi-Agent Squad  │ 2026-08-16│  ✅ Done │
│    10   │ Twilio Live Call Integration  │ 2026-08-16│  ✅ Done │
│    11   │ Prepare Demo + Finale Kit     │     —     │  ⏳ Next│
└─────────┴───────────────────────────────┴───────────┴──────────┘

Git Commits:
  665bfa1  Phase 5–9 (business rules, WhatsApp, memory, complaints)
  12d8101  Phase 9 continued (expanded intents)
  e84aeac  Complexity refactor (pre-check extraction, regex precompile)
  a2fe1c6  Twilio live call integration (Deepgram STT + Sarvam TTS)
```

---

> **Lyra 2.0** — Built in a single day. 12 database tables, 15 API routes,
> 12 voice library files, 3 TTS engines, 1 STT engine, 1 state machine,
> 5 demo shops, 15 products, and one very patient AI that speaks Tanglish.
