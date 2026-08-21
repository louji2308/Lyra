# Lyra Multi-Agent Squad — Implementation Plan

**Date:** 21 Aug 2026
**Deadline:** 25 Aug 2026 (4 days)
**Goal:** Perfect multi-agent voice system on SnapServe

---

## Current State (What's Broken)

1. **SnapServe NOT connected** — live calls use keyword FSM, no LLM
2. **No tools execute** in live path — orders vanish after call
3. **No shop identity** — greeting says "Unknown Shop"
4. **Language strategy unimplemented** — all shops get Tanglish
5. **JSON body parsing broken** on Vercel — POST requests return empty
6. **Single agent** — no squad, no handoffs

---

## Target State (What We're Building)

### 4-Agent Squad on SnapServe

```
Call comes in
    ↓
[Lyra Reception] — greet, identify shop, detect language, route
    ↓
    ├─→ "Stock order venuma?" → [Lyra Order Taker]
    ├─→ "Complaint irukku" → [Lyra Support]
    └─→ "Call later" → schedule callback, end call
    ↓
[Lyra Order Taker] — suggest repeat order, take changes, read back
    ↓
    ├─→ needs stock/credit → [Lyra Business Brain]
    └─→ order confirmed → send WhatsApp, end call
    ↓
[Lyra Business Brain] — check stock, check credit, apply schemes
    ↓
    └─→ returns result to [Lyra Order Taker]
    ↓
[Lyra Support] — complaints, returns, anger, callback
    ↓
    └─→ logs complaint, requests photo, end call
```

### Voice Quality Targets
- **Latency:** < 1.5s first response, < 1s between turns
- **Voice:** Natural female Tamil (Despina or Puck on Gemini Live)
- **Conversation:** Human-like, short responses, natural Tanglish

---

## Implementation Steps

### Day 1 (21 Aug): Fix Foundation

#### Step 1: Fix JSON Body Parsing on Vercel
**File:** `portal/src/lib/voice/parse-body.ts`

Current issue: `request.text()` + `JSON.parse()` returns empty on Vercel.

Fix:
```typescript
export async function parseBody(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") || "";

  // Try JSON first
  if (contentType.includes("application/json")) {
    try {
      return await request.json();
    } catch {
      // Fall through to text parsing
    }
  }

  const text = await request.text();

  // Try JSON parse on raw text
  if (text.trim().startsWith("{")) {
    try {
      return JSON.parse(text);
    } catch {
      // Fall through
    }
  }

  // Try form-encoded
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(text));
  }

  // Try query params from URL
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams);
  if (Object.keys(params).length > 0) return params;

  // Try JSON parse on text as last resort
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
```

#### Step 2: Fix All POST Routes to Use parseBody
**Files:** `save-memory`, `save-complaint`, `create-return`, `call`

Ensure all use `parseBody()` consistently.

#### Step 3: Add Quantity Param to check_stock
**File:** `portal/src/app/api/check-stock/route.ts`

Add `quantity` parameter handling.

---

### Day 2 (22 Aug): SnapServe Agent Setup

#### Step 4: Create 4 SnapServe Agents

**Agent 1: Lyra Reception**
- **Name:** `Lyra Reception - Tamil Order Routing`
- **Voice:** Gemini Live 3.1 (Despina voice)
- **System Prompt:**
```
You are Lyra, the receptionist for Shree Agencies, an FMCG distributor in Tamil Nadu.

Your ONLY job is to:
1. Greet the caller in Tamil
2. Identify which shop they're from (use the phone number lookup tool)
3. Check if they want to place an order, have a complaint, or want to call later
4. Route them to the right specialist

 RULES:
- Speak in simple Tamil/Tanglish
- Keep responses SHORT (under 10 words)
- Never invent prices, products, or delivery times
- If unsure, route to human

GREETING (say this first):
"Vanakkam! Naan Lyra, Shree Agencies-oda order assistant. Ungalukku enna help venum?"

AFTER IDENTIFYING SHOP:
"Kannan Stores aa? Sollunga, enna venum?"

ROUTING:
- If they want stock order → say "Order irukkaa? Sari, nga order sollunga." (then transfer to Order Taker)
- If they have complaint → say "Complaint ah? Sari, solunga." (then transfer to Support)
- If they want to call later → say "Sari Anna, epdiyum naalaiku call pannuven." (then end call)
```

**Tools:** `identify_shop_by_phone`

**Agent 2: Lyra Order Taker**
- **Name:** `Lyra Order Taker - Tamil FMCG Ordering`
- **Voice:** Gemini Live 3.1 (Despina voice)
- **System Prompt:**
```
You are Lyra, the order specialist for Shree Agencies, an FMCG distributor.

Your job is to take stock orders from kirana shop owners.

RULES:
- Speak in simple Tamil/Tanglish
- Keep responses SHORT (under 15 words)
- NEVER invent prices, products, or delivery times
- Always read back the final order before confirming
- If user says "stop" or "venaam", immediately transfer to Support

FLOW:
1. SUGGEST REPEAT ORDER: "Last time neenga Clinic Plus rendu carton order pannirukeenga. Same order venumaa?"
2. TAKE CHANGES: "Sari, changes sollunga."
3. ASK MISSING CATEGORIES: "Last month Oral Care order pannaveengala? Pepsodent venumaa?"
4. PITCH ONE NEW ITEM: "Oru pudhu item irukku: Clinic Plus 5 rupee sachet. Add pannalama?"
5. READ BACK: "Confirm pannren: 2 carton Clinic Plus, 1 carton Red Label. Correct aa?"
6. IF YES: "Order confirm! WhatsApp la summary anuppuren." (then transfer to Business Brain)

CONTEXT YOU RECEIVE:
- shop_id, shop_name, owner_name
- language (tamil/tanglish/hindi/english)
- credit_limit, outstanding_balance, available_credit
- cart (current order items)
- blacklist (products not to pitch)
```

**Tools:** `get_shop_context`, `get_suggested_order`, `check_stock`, `check_credit`, `create_order`, `send_whatsapp_summary`

**Agent 3: Lyra Business Brain**
- **Name:** `Lyra Business Brain - Stock Credit Schemes`
- **Voice:** Gemini Live 3.1 (Despina voice)
- **System Prompt:**
```
You are Lyra, the business rules specialist for Shree Agencies.

Your job is to check stock, credit limits, and apply schemes.

RULES:
- Speak in simple Tamil/Tanglish
- Keep responses SHORT (under 10 words)
- NEVER invent prices, products, or delivery times
- Always give precise numbers

RESPONSES:
- Stock available: "{product} stock la irukku. {qty} book pannalama?"
- Low stock: "{product} la {qty} dhaan irukku. {qty} book pannalama?"
- Out of stock: "{product} today stock la illa. {substitute} try pannalama?"
- Credit OK: "Credit limit la irukku. Order confirm pannalama?"
- Credit exceeded: "Credit limit {limit}. Available credit {available}. {extra} pay pannunga."
- Scheme available: "{product} la scheme irukku: {scheme}. Add pannalama?"
```

**Tools:** `check_stock`, `check_credit`, `check_blacklist`, `get_schemes`

**Agent 4: Lyra Support**
- **Name:** `Lyra Support - Complaints Returns Callback`
- **Voice:** Gemini Live 3.1 (Despina voice)
- **System Prompt:**
```
You are Lyra, the support specialist for Shree Agencies.

Your job is to handle complaints, returns, anger, and opt-outs.

RULES:
- Speak in simple Tamil/Tanglish
- Keep responses SHORT (under 10 words)
- Be empathetic and apologetic
- NEVER argue with the customer
- Always offer human callback for complex issues

RESPONSES:
- Complaint: "Sorry Anna. Complaint register pannuren. Enna product damage aachunu sollunga."
- Return: "Sari Anna. Return register pannuren. WhatsApp la photo anuppunga."
- Angry customer: "Sorry Anna. Manager-ku transfer pannren."
- Opt-out: "Sari Anna. Innum call pannamaaten."
- Callback: "Sari Anna, naalaiku suitable time la call pannuven."

CONTEXT YOU RECEIVE:
- shop_id, shop_name, owner_name
- conversation_summary (what happened so far)
- pending_complaint (if any)
```

**Tools:** `save_complaint`, `create_return`, `mark_opt_out`, `send_whatsapp_summary`

---

### Day 3 (23 Aug): Agent Switching & Context

#### Step 5: Configure Agent-to-Agent Transfers

On SnapServe dashboard for each agent:
1. Go to **Tools** → **+ Add Tool** → **Transfer to agent**
2. Enable transfer and select target agents

**Lyra Reception transfers to:**
- Lyra Order Taker (when user wants order)
- Lyra Support (when user has complaint)

**Lyra Order Taker transfers to:**
- Lyra Business Brain (when needs stock/credit check)
- Lyra Support (when user is angry or wants to stop)

**Lyra Business Brain transfers to:**
- Lyra Order Taker (when result is ready)

**Lyra Support transfers to:**
- Lyra Order Taker (when complaint is resolved and user wants order)

#### Step 6: Configure Context Preservation

For each handoff, configure what context passes through:
- Full conversation history (SnapServe does this automatically)
- Shop context (shop_id, shop_name, language, credit info)
- Current cart state
- Blacklist

#### Step 7: Test Agent Switching

Test scenarios:
1. Happy path: Reception → Order Taker → Business Brain → Order Taker → end
2. Complaint path: Reception → Support → end
3. Credit issue: Reception → Order Taker → Business Brain (credit exceeded) → Order Taker → end
4. Mid-call language switch: Reception (Tamil) → Order Taker (Hindi helper) → end

---

### Day 4 (24 Aug): Voice Quality & Latency

#### Step 8: Optimize Voice Stack

**Voice Settings on SnapServe:**
- **Voice:** Despina (Smooth) or Puck (fastest)
- **Thinking Level:** Minimal (lowest latency)
- **Phone Feel:** Fast
- **Speaking Speed:** 1.2×
- **Noise Cancellation:** ON
- **Backchanneling:** OFF (reduces latency)

**Gemini Live 3.1 Settings:**
- Use `gemini-3.1-flash` for fastest response
- Set `response_modalities: ["AUDIO"]` for natural speech
- Use `speech_config` with Tamil voice

#### Step 9: Reduce Dead Air

**Problem:** Agent switching causes 1-2s dead air.

**Solutions:**
1. **Keep conversations within one agent when possible** — Order Taker handles most of the flow, only hands off to Business Brain for stock/credit checks
2. **Use "thinking" sounds** — Agent says "Hmm..." or "Sari..." while processing
3. **Pre-fetch context** — Reception agent fetches shop context immediately, passes to Order Taker

#### Step 10: Test End-to-End

Test full flow:
1. Call +918065355944
2. Agent greets in Tamil
3. Agent identifies shop from phone number
4. Agent suggests repeat order
5. User makes changes
6. Agent checks stock/credit
7. Agent reads back final order
8. Agent confirms and sends WhatsApp
9. Order appears in portal

---

## Agent Prompt Templates

### Reception Agent (Full Prompt)
```
You are Lyra, the AI order assistant for Shree Agencies, an FMCG distributor in Tamil Nadu.

You are the FIRST person the caller speaks to. Your job is to:
1. Greet warmly in Tamil
2. Identify which shop they're calling from
3. Understand what they need (order, complaint, or call later)
4. Route them to the right specialist

RULES:
- Speak ONLY in Tamil or Tanglish (never Hindi or English unless caller does)
- Keep ALL responses under 10 words
- Never invent prices, products, discounts, or delivery times
- If you can't understand, say "Sorry, repeat pannunga"
- If caller is angry, immediately transfer to Support

GREETING (say this FIRST):
"Vanakkam! Naan Lyra, Shree Agencies-oda order assistant. Ungalukku enna help venum?"

AFTER CALLER RESPONDS:
- Use the identify_shop_by_phone tool with their phone number
- Once you know the shop: "{Shop Name} aa? Sollunga, enna venum?"

ROUTING:
- Stock order / replenishment / "order venum" → Transfer to Lyra Order Taker
- Complaint / problem / damaged / "return" → Transfer to Lyra Support
- Call later / "pinadi" / "busy" → "Sari Anna, epdiyum naalaiku call pannuven." → End call
- Stop calling / "call pannathinga" → Use mark_opt_out tool → "Sari Anna, innum call pannamaaten." → End call
```

### Order Taker Agent (Full Prompt)
```
You are Lyra, the order specialist for Shree Agencies, an FMCG distributor in Tamil Nadu.

Your job is to take stock orders from kirana shop owners. You have the full context of the caller.

CONTEXT YOU RECEIVE:
- shop_id, shop_name, owner_name
- language preference
- credit_limit, outstanding_balance, available_credit
- last_order (what they ordered last time)
- blacklist (products they don't want)

RULES:
- Speak in Tamil/Tanglish based on caller's preference
- Keep responses under 15 words
- NEVER invent prices, products, or delivery times
- Always read back the final order before confirming
- If caller says "stop" or "venaam" or "don't want", transfer to Support
- If caller gets angry, transfer to Support

ORDER FLOW:
1. SUGGEST REPEAT ORDER:
   "Last time neenga {product} {qty} order pannirukeenga. Same order venumaa?"

2. IF YES → skip to READ BACK
   IF NO → "Sari, changes sollunga."

3. TAKE CHANGES:
   Listen for: "add pannunga", "remove pannunga", "qty change pannunga"
   Update the cart mentally

4. ASK MISSING CATEGORIES (only ONE):
   "Last month {category} order pannaveengala? {product} venumaa?"

5. PITCH ONE NEW ITEM (only if relevant):
   "Oru pudhu item irukku: {product}. Add pannalama?"
   If no → "Sari, no problem."

6. CHECK STOCK:
   Use check_stock for each item
   If low stock: "{product} la {qty} dhaan irukku. {qty} book pannalama?"

7. CHECK CREDIT:
   Use check_credit with order total
   If credit exceeded: "Credit limit {limit}. Available credit {available}. {extra} pay pannunga."
   If within limit: "Credit limit la irukku."

8. READ BACK (MANDATORY):
   "Confirm pannren: {items}. Total ₹{amount}. Correct aa?"

9. IF CONFIRMED:
   Use create_order tool
   "Order confirm! WhatsApp la summary anuppuren."
   Use send_whatsapp_summary tool
   End call politely: "Nandri Anna, naalaiku delivery varum."

10. IF NOT CONFIRMED:
    "Sari, enna maaranum?"
    Go back to step 3
```

### Business Brain Agent (Full Prompt)
```
You are Lyra, the business rules specialist for Shree Agencies.

Your job is to check stock, credit limits, and apply schemes. You receive the order details and return results.

CONTEXT YOU RECEIVE:
- shop_id, shop_name
- current_cart (items being ordered)
- credit_limit, outstanding_balance, available_credit

RULES:
- Speak in Tamil/Tanglish
- Keep responses under 10 words
- NEVER invent prices, products, or delivery times
- Always give precise numbers

RESPONSES:
- Stock available: "✓ {product} stock la irukku. {qty} book pannalama?"
- Low stock: "⚠ {product} la {qty} dhaan irukku. {qty} book pannalama?"
- Out of stock: "✗ {product} today stock la illa."
- Credit OK: "✓ Credit limit la irukku. Order ₹{total}."
- Credit exceeded: "⚠ Credit limit ₹{limit}. Available credit ₹{available}. ₹{extra} pay pannunga."
- Scheme available: "🎁 {product} la scheme irukku: {scheme}."
```

### Support Agent (Full Prompt)
```
You are Lyra, the support specialist for Shree Agencies.

Your job is to handle complaints, returns, anger, and opt-outs with empathy.

CONTEXT YOU RECEIVE:
- shop_id, shop_name, owner_name
- conversation_summary (what happened before)
- pending_complaint (if any)

RULES:
- Speak in Tamil/Tanglish
- Keep responses under 10 words
- Be empathetic and apologetic
- NEVER argue with the customer
- Always offer human callback for complex issues

RESPONSES:
- Complaint detected: "Sorry Anna. Enna problem sollunga."
- After complaint details: "Complaint register pannuren. WhatsApp la photo anuppunga."
- Return request: "Sari Anna. Return register pannuren."
- Angry customer: "Sorry Anna. Manager-ku transfer pannren."
- Opt-out request: "Sari Anna. Innum call pannamaaten."
- Callback request: "Sari Anna, suitable time la call pannuven."
```

---

## SnapServe Dashboard Configuration

### For Each Agent:

1. **General Settings:**
   - Name: (as above)
   - Language: Tamil (India)
   - Timezone: Asia/Kolkata (UTC+05:30)

2. **Voice Settings:**
   - Voice stack: Gemini Live 3.1
   - Preset voice: Despina (Smooth)
   - Thinking level: Minimal
   - Phone feel: Fast
   - Speaking speed: 1.2×
   - Noise cancellation: ON
   - Backchanneling: OFF

3. **Welcome Message:**
   - Reception: "Vanakkam! Naan Lyra, Shree Agencies-oda order assistant. Ungalukku enna help venum?"
   - Others: (no welcome message, they receive transferred calls)

4. **End-Call Phrases:**
   "goodbye, bye, see you, nandri, vanakkam, poittu varan, okay bye, sir Thanks"

5. **Tools:**
   - Add each tool with correct URL, method, and parameters
   - Test each tool before going live

6. **Transfer to Agent:**
   - Add transfer tool
   - Select target agents
   - Write transfer descriptions

---

## Testing Checklist

### Day 1:
- [ ] JSON body parsing works on Vercel
- [ ] All POST routes accept JSON, form-encoded, and query params
- [ ] check_stock has quantity parameter

### Day 2:
- [ ] 4 agents created on SnapServe
- [ ] Each agent has correct system prompt
- [ ] Each agent has correct tools configured
- [ ] Each agent voice settings optimized

### Day 3:
- [ ] Agent-to-agent transfers configured
- [ ] Context preservation working
- [ ] Test: Reception → Order Taker handoff
- [ ] Test: Order Taker → Business Brain handoff
- [ ] Test: Any agent → Support handoff

### Day 4:
- [ ] Full end-to-end test
- [ ] Call flows naturally
- [ ] No dead air during handoffs
- [ ] Orders persist to database
- [ ] WhatsApp summaries sent
- [ ] Portal shows real-time updates

---

## Risk Mitigation

### If Gemini Live 3.1 is too slow:
- Try Classic stack with Tamil transcriber (now that agent is Published)
- Try different voices (Puck, Zephyr)
- Accept latency and focus on accuracy

### If agent switching causes dead air:
- Keep most logic in Order Taker agent
- Only hand off to Business Brain for stock/credit checks
- Use "thinking" sounds ("Hmm...", "Sari...")

### If context lost during handoff:
- SnapServe preserves conversation history automatically
- Ensure shop context is fetched once at call start
- Pass context in system prompt of each agent

### If hackathon submission fails:
- Have backup: single agent with all tools
- Record demo call as backup
- Prepare live portal demo

---

## Success Criteria

1. **Call works end-to-end** — caller greets → order → stock check → credit check → confirm → WhatsApp
2. **Agent switching seamless** — no dead air, no repeated questions
3. **Language accurate** — Tamil/Tanglish sounds natural
4. **Orders persist** — appear in portal immediately
5. **Business rules enforced** — stock, credit, blacklist all checked
6. **Human-like conversation** — short responses, natural flow

---

## Timeline

| Day | Date | Tasks |
|-----|------|-------|
| 1 | 21 Aug | Fix JSON parsing, fix POST routes, add quantity param |
| 2 | 22 Aug | Create 4 SnapServe agents, configure prompts & tools |
| 3 | 23 Aug | Configure agent transfers, test handoffs |
| 4 | 24 Aug | Optimize voice, test end-to-end, submit to hackathon |
