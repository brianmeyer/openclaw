# AI Employee for Solo Federal Contractor
## Product Requirements Document (PRD)

**Version:** 2.0
**Date:** February 2026
**Status:** Bootstrap Edition
**Target:** Solo founder starting a federal contracting company

---

## Executive Summary

A lightweight AI assistant built on OpenClaw to help a solo federal contractor find opportunities, write proposals, and manage their business. The goal is to give one person the capabilities that would normally require a small team — without the overhead.

### Vision

> One founder + AI employees = competitive federal contractor

---

## 1. The Reality of Solo Federal Contracting

### What You Actually Need Day-to-Day

| Task | Time Sink | AI Can Help |
|------|-----------|-------------|
| Finding opportunities on SAM.gov | Hours of searching | Auto-monitor and filter |
| Reading 100-page RFPs | Half a day per RFP | Extract key requirements fast |
| Writing proposal sections | Days per proposal | Draft and iterate quickly |
| Tracking deadlines | Mental overhead | Automated reminders |
| Past performance write-ups | Repetitive writing | Template and customize |
| Compliance questions | Research rabbit holes | Quick FAR/DFARS lookups |
| Pricing/estimating | Spreadsheet hell | Structured calculations |

### What You DON'T Need Yet

- Multi-tenant architecture
- Enterprise security frameworks
- Complex subagent orchestration
- $30K/month infrastructure
- Team collaboration features
- Fancy dashboards

---

## 2. Simplified Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Your AI Employee                   │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │            Single Smart Agent                │    │
│  │                                              │    │
│  │  Skills:                                     │    │
│  │  • Opportunity hunting (SAM.gov)            │    │
│  │  • RFP analysis                             │    │
│  │  • Proposal writing                         │    │
│  │  • Compliance lookup                        │    │
│  │  • Pricing help                             │    │
│  │  • Calendar/deadline tracking               │    │
│  └─────────────────────────────────────────────┘    │
│                        │                             │
│  ┌─────────────────────▼───────────────────────┐    │
│  │              Your Google Drive               │    │
│  │  Proposals/ │ Contracts/ │ Templates/       │    │
│  └─────────────────────────────────────────────┘    │
│                        │                             │
│  ┌─────────────────────▼───────────────────────┐    │
│  │              Free Gov APIs                   │    │
│  │         SAM.gov │ FPDS │ USASpending        │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘

Talk to it via: Gmail │ Google Chat │ Terminal │ Web
```

### Why This Works

OpenClaw already has:
- **Skills system** — Add federal contracting skills
- **Memory** — Remember your past performance, pricing, preferences
- **Google integration** — Gmail monitoring, Drive access
- **Multiple LLM support** — Use Gemini, Claude, or GPT based on cost/quality

---

## 3. Core Capabilities (MVP)

### 3.1 Opportunity Scout

**What it does:**
- Monitor SAM.gov for opportunities matching your NAICS codes
- Daily digest of new opportunities via email/chat
- Quick qualification: "Is this worth pursuing?"

**Example interactions:**
```
You: "Find IT services opportunities under $500K for small business set-asides"

AI: Found 12 opportunities this week matching your criteria:

    1. VA SSVF IT Support Services - $350K - Due Mar 15
       Set-aside: SDVOSB ✓  NAICS: 541512 ✓
       Quick take: Good fit. VA has funded this annually for 3 years.

    2. DOL Website Maintenance - $200K - Due Mar 22
       Set-aside: 8(a) ✗ (you're not 8(a))
       Quick take: Skip unless you can team.
    ...
```

### 3.2 RFP Analyzer

**What it does:**
- Parse uploaded RFP PDFs
- Extract: requirements, evaluation criteria, deadlines, page limits
- Generate compliance checklist
- Flag potential issues or showstoppers

**Example:**
```
You: [uploads RFP PDF]
     "Analyze this and tell me if I should bid"

AI: ## RFP Summary: DOE Cybersecurity Assessment Services

    **Bid/No-Bid Factors:**
    ✓ Set-aside: Small Business (you qualify)
    ✓ NAICS 541512 (your primary)
    ✓ Value: $400K (in your sweet spot)
    ⚠ Requires TS clearance (do you have this?)
    ✗ Requires 3 past performance refs (you have 2)

    **Recommendation:** Marginal. The past performance gap is a problem.
    Options: (1) Team with someone who has refs, (2) No-bid

    Want me to pull the full requirements matrix?
```

### 3.3 Proposal Writer

**What it does:**
- Draft proposal sections based on RFP requirements
- Maintain your voice and style
- Pull from your past proposals and templates
- Technical approach, management approach, past performance

**Example:**
```
You: "Draft the technical approach for the DOE cyber RFP.
      We'll use our standard vulnerability assessment methodology."

AI: ## Technical Approach (Draft - 3 pages)

    ### 1. Understanding of the Requirement
    [Drafted based on RFP Section C requirements...]

    ### 2. Vulnerability Assessment Methodology
    [Pulled from your previous DHS proposal, adapted for DOE context...]

    ### 3. Staffing Approach
    [Based on your resume and typical team structure...]

    ---
    ⚠ This draft is 3.2 pages. RFP limit is 3 pages.
    Want me to tighten it up?
```

### 3.4 Compliance Helper

**What it does:**
- Quick FAR/DFARS clause lookups
- Explain what clauses mean in plain English
- Check if your business practices comply

**Example:**
```
You: "What does FAR 52.219-14 mean for me?"

AI: **FAR 52.219-14: Limitations on Subcontracting**

    Plain English: As a small business prime, you must perform at least
    50% of the labor cost yourself for services contracts.

    For your $400K DOE bid:
    - You need to perform at least $200K of labor with your own employees
    - Max $200K can go to subcontractors

    ⚠ If you're planning to sub most of the work to a large business
    partner, this is a compliance risk.
```

### 3.5 Deadline Tracker

**What it does:**
- Track proposal deadlines
- Remind you of upcoming due dates
- Sync with Google Calendar

**Example:**
```
AI: [Monday morning email]

    ## This Week's Deadlines

    🔴 URGENT: VA IT Support proposal due Wednesday 5pm ET
       Status: Technical approach done, pricing TBD

    🟡 DOE Cyber RFP questions due Friday
       Status: Haven't started

    🟢 Next week: DOL maintenance proposal (Mar 22)
```

### 3.6 Pricing Assistant

**What it does:**
- Help structure cost proposals
- Calculate labor costs with your rates
- Basic price-to-win guidance

**Example:**
```
You: "Help me price the VA IT Support bid.
      It's 1 FTE for 12 months."

AI: ## Rough Pricing Estimate

    Direct Labor:
    - IT Specialist, 1 FTE x 2080 hrs x $65/hr = $135,200

    With your indirect rates (from last year):
    - Fringe (32%): $43,264
    - Overhead (15%): $20,280
    - G&A (10%): $19,874
    - Subtotal: $218,618
    - Fee (10%): $21,862

    **Total: $240,480**

    This is under the $350K ceiling. You have room for:
    - Adding ODCs (travel, equipment)
    - Adjusting fee up
    - Or bidding lean to be competitive

    Want me to build this out in a Google Sheet?
```

---

## 4. Technical Implementation

### What to Build (Minimal)

| Component | Implementation | Effort |
|-----------|---------------|--------|
| Fed contracting skills | New skill files in `skills/` | 2-3 days |
| SAM.gov search tool | API integration plugin | 1-2 days |
| RFP parser tool | PDF extraction + LLM analysis | 2-3 days |
| Google Drive tool | Already exists in OpenClaw | Config only |
| Gmail integration | Already exists in OpenClaw | Config only |
| Memory for your data | Use existing memory system | Config only |

### What NOT to Build

- Custom web dashboard (use terminal + email)
- Subagent orchestration (single agent is fine)
- Complex approval workflows (it's just you)
- Analytics/reporting (Google Sheets is fine)
- Multi-user auth (it's just you)

### Cost Estimate (Monthly)

| Item | Cost |
|------|------|
| Google Workspace (you probably have this) | $12-18 |
| LLM API (Claude/Gemini) - moderate use | $50-150 |
| Hosting (small VM or local) | $0-20 |
| SAM.gov API | Free |
| **Total** | **~$75-200/month** |

Compare to: Hiring even a part-time proposal coordinator ($2-4K/month)

---

## 5. Your Data (Memory)

The AI needs to know about YOUR business:

### Essential Info to Load

```
MEMORY.md or memory/*.md files:

## Company Info
- Company name, CAGE code, UEI, DUNS
- NAICS codes (primary and secondary)
- Small business certifications (SDVOSB, 8(a), HUBZone, etc.)
- State of incorporation, GSA schedule (if any)

## Past Performance
- Contract 1: [Agency], [Description], [Value], [Period], [POC]
- Contract 2: ...
(Even if you only have 1-2, document them well)

## Key Personnel
- Your resume/bio
- Any regular subcontractors or teammates

## Pricing
- Your labor rates by category
- Indirect rates (fringe, overhead, G&A)
- Standard fee percentage

## Preferences
- Target agencies
- Types of work you want/don't want
- Geographic preferences
- Teaming partners you like working with
```

---

## 6. Day-in-the-Life Scenarios

### Morning Routine
```
You: "What's on my plate today?"

AI: Good morning. Here's your federal contracting status:

    📬 SAM.gov: 3 new opportunities match your profile (summaries below)

    📅 Deadlines:
    - VA proposal: 2 days (pricing section needs work)
    - DOE questions: 4 days (haven't started)

    📝 In Progress:
    - VA technical approach: Done, in Drive
    - VA past performance: Draft ready for your review

    🔔 Action needed:
    - VA pricing: Should we work on this today?
```

### Proposal Crunch Time
```
You: "I need to finish the VA proposal today. Help me power through."

AI: Let's do it. Current status:

    ✅ Technical Approach (3 pages) - Done
    ✅ Management Approach (2 pages) - Done
    ⏳ Past Performance (2 pages) - Draft ready
    ❌ Pricing (10 pages) - Not started
    ❌ Reps & Certs - Need to fill out

    Suggested plan:
    1. Review past performance draft (15 min)
    2. I'll build pricing spreadsheet while you review (30 min)
    3. You fill in final numbers, I'll format (1 hr)
    4. Reps & certs are standard - I'll pre-fill from your SAM.gov (15 min)
    5. Final assembly and compliance check (30 min)

    Ready to start with past performance review?
```

### Quick Research
```
You: "Is there an incumbent on the VA IT contract?"

AI: Checking FPDS...

    Yes. Current incumbent: TechServe Solutions Inc.
    - Contract: 36C10X21C0042
    - Value: $325,000
    - Period: 2021-2024 (expiring)
    - Performance: No negative CPARS found

    They're a small business too. This will be competitive.
    Want me to dig into their past VA work?
```

---

## 7. Getting Started (Phase 1)

### Week 1: Foundation
- [ ] Fork OpenClaw, basic setup
- [ ] Configure Gmail/Google Chat channel
- [ ] Load your company info into memory
- [ ] Test basic interactions

### Week 2: Core Skills
- [ ] Add SAM.gov search skill
- [ ] Add basic RFP analysis skill
- [ ] Add FAR lookup skill
- [ ] Test with a real opportunity

### Week 3: Proposal Support
- [ ] Add proposal writing skill
- [ ] Load your past proposals as templates
- [ ] Add pricing helper skill
- [ ] Do a dry run on a practice proposal

### Week 4: Polish
- [ ] Set up daily opportunity digest
- [ ] Configure deadline reminders
- [ ] Fine-tune based on what's working
- [ ] Start using it for real bids

---

## 8. Growing Later (When You Win Contracts)

Once you're winning work and have revenue, you can add:

| When | Add |
|------|-----|
| First contract win | Contract management skill (deliverables, invoicing) |
| Revenue > $250K | Basic CRM in Google Sheets |
| Hiring first employee | Multi-user access, task assignment |
| Revenue > $500K | Past performance database, better analytics |
| Multiple employees | Consider the enterprise features |

But that's future you's problem. Focus on winning first.

---

## Appendix: Quick Glossary

| Term | What It Means |
|------|---------------|
| SAM.gov | Where all federal opportunities are posted |
| NAICS | Industry codes - yours determines what you can bid on |
| Set-aside | Contracts reserved for small businesses |
| FAR | Federal Acquisition Regulation - the rules |
| FPDS | Database of who won what contracts |
| CAGE | Your company's unique ID for federal work |
| Past Performance | Your track record - critical for winning |
| Pwin | Probability of win - is this worth your time? |

---

*This is the bootstrap version. Keep it simple, win some contracts, then grow.*
