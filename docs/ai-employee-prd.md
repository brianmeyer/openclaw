# FedAI: AI Employee Platform
## Technical PRD - Ground-Up Build

**Version:** 3.0
**Status:** Architecture & Design
**Approach:** Clean implementation inspired by OpenClaw patterns, built cloud-native on Google Cloud

---

## 1. Why Build From Scratch

### Problems with Forking OpenClaw

| Issue | Impact |
|-------|--------|
| **Complexity** | 50K+ lines of code for features you don't need |
| **Consumer-focused** | Built for WhatsApp/Telegram/Discord, not enterprise |
| **Security debt** | Multiple auth flows, credential storage patterns |
| **Dependencies** | Heavy dependency tree with patch requirements |
| **Local-first** | Designed to run on laptops, not cloud-native |

### Benefits of Clean Build

| Benefit | Result |
|---------|--------|
| **Minimal surface area** | Less code = fewer bugs = easier to audit |
| **Cloud-native** | Serverless, scales to zero, no infra management |
| **Your architecture** | Designed for your exact use case |
| **No legacy** | Modern patterns, no backward compatibility |
| **Auditable** | You wrote it, you understand it |

---

## 2. Core Concepts (Borrowed from OpenClaw)

What to take from OpenClaw's design:

### 2.1 Agent Loop Pattern
```
User Message → System Prompt + Tools → LLM → Tool Calls → Results → Response
                     ↑                              │
                     └──────── Memory ◄─────────────┘
```

### 2.2 Skills as Markdown
Skills are just markdown files with instructions. The agent reads them and follows them. Simple, editable, version-controlled.

### 2.3 Memory as Files
Store knowledge in markdown/JSON files. Use vector search when you need semantic retrieval. No complex database required.

### 2.4 Tools as Functions
Tools are just TypeScript functions with JSON schemas. The LLM calls them by name with arguments.

---

## 3. Architecture

### 3.1 High-Level Design

```
┌─────────────────────────────────────────────────────────────────┐
│                        Google Cloud                              │
│                                                                  │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │   Gmail      │     │  Cloud Run   │     │  Vertex AI   │    │
│  │   Trigger    │────▶│    Agent     │────▶│   (Gemini)   │    │
│  │  (Pub/Sub)   │     │   Service    │     │              │    │
│  └──────────────┘     └──────┬───────┘     └──────────────┘    │
│                              │                                   │
│         ┌────────────────────┼────────────────────┐             │
│         │                    │                    │             │
│         ▼                    ▼                    ▼             │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │    Cloud     │     │  Firestore   │     │    Cloud     │    │
│  │   Storage    │     │   (State)    │     │  Scheduler   │    │
│  │  (Files)     │     │              │     │   (Cron)     │    │
│  └──────────────┘     └──────────────┘     └──────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

External APIs: SAM.gov │ FPDS │ Gmail │ Drive │ Calendar
```

### 3.2 Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Agent Service** | Cloud Run | Core agent logic, tool execution |
| **LLM** | Vertex AI (Gemini) | Reasoning, generation |
| **State Store** | Firestore | Conversations, tasks, settings |
| **File Storage** | Cloud Storage | Skills, memory, documents |
| **Scheduler** | Cloud Scheduler | Daily digest, reminders |
| **Email Trigger** | Gmail API + Pub/Sub | Receive messages via email |
| **Secrets** | Secret Manager | API keys, credentials |

### 3.3 Why This Stack

| Choice | Reasoning |
|--------|-----------|
| **Cloud Run** | Serverless, scales to zero, no servers to manage |
| **Firestore** | Serverless NoSQL, free tier generous, real-time |
| **Vertex AI** | Native Google, enterprise SLA, Gemini is good |
| **Pub/Sub** | Decouple email receipt from processing |
| **TypeScript** | Type safety, good Gemini SDK, familiar |

---

## 4. Core Modules

### 4.1 Agent Core (~500 lines)

The heart of the system. Handles the conversation loop.

```typescript
// src/agent/core.ts

interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

interface AgentConfig {
  model: string;
  systemPrompt: string;
  tools: Tool[];
  maxTurns: number;
}

async function runAgent(
  config: AgentConfig,
  messages: Message[],
  context: AgentContext
): Promise<Message> {

  let turns = 0;

  while (turns < config.maxTurns) {
    // Call LLM
    const response = await callGemini({
      model: config.model,
      systemPrompt: config.systemPrompt,
      messages,
      tools: config.tools,
    });

    // If no tool calls, we're done
    if (!response.toolCalls?.length) {
      return response;
    }

    // Execute tool calls
    const toolResults = await executeTools(response.toolCalls, context);

    // Add to conversation
    messages.push(response);
    messages.push({ role: 'tool', toolResults });

    turns++;
  }

  throw new Error('Max turns exceeded');
}
```

### 4.2 Tool System (~300 lines)

Simple tool definition and execution.

```typescript
// src/tools/types.ts

interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute: (args: unknown, context: AgentContext) => Promise<string>;
}

// src/tools/sam-gov.ts

export const samSearchTool: Tool = {
  name: 'sam_search',
  description: 'Search SAM.gov for federal contracting opportunities',
  parameters: {
    type: 'object',
    properties: {
      naics: { type: 'string', description: 'NAICS code to filter by' },
      setAside: { type: 'string', description: 'Set-aside type (SDVOSB, 8a, etc)' },
      maxValue: { type: 'number', description: 'Maximum contract value' },
      keyword: { type: 'string', description: 'Keyword search' },
    },
  },
  async execute(args, context) {
    const opportunities = await samGovApi.search(args);
    return JSON.stringify(opportunities, null, 2);
  },
};
```

### 4.3 Memory System (~400 lines)

File-based memory with optional vector search.

```typescript
// src/memory/store.ts

interface MemoryStore {
  // Core files (always loaded into context)
  getCompanyInfo(): Promise<string>;
  getPastPerformance(): Promise<string>;
  getRates(): Promise<string>;

  // Search (for larger knowledge bases)
  search(query: string, limit?: number): Promise<SearchResult[]>;

  // Conversation history
  getConversation(id: string): Promise<Message[]>;
  saveConversation(id: string, messages: Message[]): Promise<void>;
}

// Implementation using Cloud Storage + Firestore
class CloudMemoryStore implements MemoryStore {
  constructor(
    private storage: Storage,
    private firestore: Firestore,
    private embeddings: EmbeddingsClient,
  ) {}

  async getCompanyInfo() {
    return this.storage.bucket('memory').file('company.md').download();
  }

  async search(query: string, limit = 5) {
    const embedding = await this.embeddings.embed(query);
    // Query Firestore vector index
    return this.firestore
      .collection('embeddings')
      .findNearest('embedding', embedding, { limit });
  }
}
```

### 4.4 Skills System (~200 lines)

Load markdown skill files and inject into system prompt.

```typescript
// src/skills/loader.ts

interface Skill {
  name: string;
  description: string;
  content: string;
}

async function loadSkills(bucket: Bucket): Promise<Skill[]> {
  const files = await bucket.getFiles({ prefix: 'skills/' });

  return Promise.all(
    files.map(async (file) => {
      const content = await file.download();
      const { data, content: body } = parseFrontmatter(content);
      return {
        name: data.name,
        description: data.description,
        content: body,
      };
    })
  );
}

function buildSystemPrompt(skills: Skill[], memory: string): string {
  return `
You are a federal contracting assistant for a small business.

## Your Knowledge
${memory}

## Skills
${skills.map(s => `### ${s.name}\n${s.content}`).join('\n\n')}

## Guidelines
- Be concise and actionable
- Cite specific sources (RFP sections, FAR clauses)
- Flag risks and compliance issues
- Ask clarifying questions when needed
`;
}
```

### 4.5 Email Channel (~300 lines)

Receive and send emails via Gmail API.

```typescript
// src/channels/gmail.ts

// Pub/Sub handler for incoming emails
export async function handleEmailPush(message: PubSubMessage) {
  const { emailId } = JSON.parse(message.data);

  // Fetch email content
  const email = await gmail.users.messages.get({
    userId: 'me',
    id: emailId,
  });

  // Extract text content
  const userMessage = extractEmailBody(email);
  const conversationId = extractConversationId(email);

  // Load conversation history
  const history = await memory.getConversation(conversationId);

  // Run agent
  const response = await runAgent(config, [...history, {
    role: 'user',
    content: userMessage,
  }], context);

  // Save updated conversation
  await memory.saveConversation(conversationId, [...history, response]);

  // Send reply
  await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      threadId: email.threadId,
      raw: buildReplyEmail(email, response.content),
    },
  });
}
```

---

## 5. File Structure

```
fedai/
├── src/
│   ├── agent/
│   │   ├── core.ts           # Agent loop
│   │   ├── gemini.ts         # Vertex AI client
│   │   └── types.ts          # Core types
│   ├── tools/
│   │   ├── index.ts          # Tool registry
│   │   ├── types.ts          # Tool interface
│   │   ├── sam-gov.ts        # SAM.gov search
│   │   ├── fpds.ts           # FPDS lookup
│   │   ├── drive.ts          # Google Drive ops
│   │   ├── calendar.ts       # Calendar ops
│   │   └── web-search.ts     # Web search
│   ├── memory/
│   │   ├── store.ts          # Memory interface
│   │   ├── cloud-store.ts    # Cloud Storage impl
│   │   └── embeddings.ts     # Vector search
│   ├── skills/
│   │   └── loader.ts         # Skill loading
│   ├── channels/
│   │   ├── gmail.ts          # Email channel
│   │   └── http.ts           # HTTP API (optional)
│   └── index.ts              # Cloud Run entrypoint
├── skills/                    # Skill markdown files
│   ├── opportunity-search.md
│   ├── rfp-analysis.md
│   ├── proposal-writing.md
│   ├── pricing.md
│   └── compliance.md
├── memory/                    # Memory files (synced to Cloud Storage)
│   ├── company.md
│   ├── past-performance.md
│   ├── rates.md
│   └── templates/
├── infrastructure/            # Terraform/Pulumi
│   ├── main.tf
│   └── variables.tf
├── package.json
├── tsconfig.json
└── Dockerfile
```

**Total estimated code: ~2,000 lines** (vs OpenClaw's 50K+)

---

## 6. Tools to Build

### 6.1 MVP Tools (Week 1-2)

| Tool | Purpose | API |
|------|---------|-----|
| `sam_search` | Find opportunities | SAM.gov API (free) |
| `fpds_lookup` | Research incumbents | FPDS API (free) |
| `web_search` | General research | Google Search API or Serper |
| `memory_search` | Search your knowledge | Internal |
| `memory_read` | Read specific files | Internal |

### 6.2 Google Workspace Tools (Week 3)

| Tool | Purpose | API |
|------|---------|-----|
| `drive_list` | List files in folder | Drive API |
| `drive_read` | Read document content | Drive API |
| `drive_write` | Create/update documents | Drive API |
| `calendar_create` | Add deadlines | Calendar API |
| `calendar_list` | Check schedule | Calendar API |
| `sheets_read` | Read spreadsheet data | Sheets API |
| `sheets_write` | Update spreadsheets | Sheets API |

### 6.3 Later Tools (When Needed)

| Tool | Purpose | When |
|------|---------|------|
| `send_email` | Outbound emails | When you need to reach out |
| `pdf_parse` | Extract RFP text | When analyzing RFPs |
| `price_calculate` | Pricing formulas | When your rates are complex |

---

## 7. Skills to Write

### 7.1 Core Skills

```markdown
# skills/opportunity-search.md
---
name: opportunity-search
description: Find and qualify federal opportunities
---

When the user asks about opportunities, use these steps:

1. **Search SAM.gov** using the sam_search tool
   - Filter by their NAICS codes (from memory)
   - Filter by set-aside type (from memory)
   - Filter by reasonable contract value

2. **Qualify each opportunity**
   - Check: Do we meet the set-aside requirements?
   - Check: Is the NAICS code a match?
   - Check: Are there showstopper requirements (clearances, etc)?
   - Check: Is the timeline reasonable?

3. **Present results** with:
   - Solicitation number and title
   - Agency
   - Due date
   - Estimated value
   - Set-aside type
   - Quick assessment: Good fit / Maybe / Skip

Always reference the user's company profile from memory.
```

```markdown
# skills/rfp-analysis.md
---
name: rfp-analysis
description: Analyze RFPs and extract key information
---

When given an RFP document:

1. **Extract basics**
   - Solicitation number
   - Title
   - Agency / Contracting Office
   - Response deadline
   - Set-aside type
   - NAICS code
   - Estimated value

2. **Find evaluation criteria** (Section M)
   - List each factor
   - Note relative importance/weights
   - Identify discriminators

3. **Find instructions** (Section L)
   - Page limits per volume
   - Required sections
   - Format requirements
   - Submission instructions

4. **Identify requirements** (Section C/SOW)
   - Key deliverables
   - Performance standards
   - Required certifications/clearances
   - Location requirements

5. **Bid/No-Bid assessment**
   Compare against user's profile:
   - Do we qualify? (set-aside, NAICS)
   - Do we have relevant past performance?
   - Can we meet special requirements?
   - Is timeline achievable?

Provide clear recommendation with reasoning.
```

```markdown
# skills/proposal-writing.md
---
name: proposal-writing
description: Help draft proposal sections
---

When drafting proposal content:

## Style Guidelines
- Active voice ("We will deliver..." not "Services will be delivered...")
- Specific metrics and outcomes
- Reference RFP requirements by section number
- Short paragraphs (3-4 sentences max)
- Bold key points for skimmability

## Section Structures

### Technical Approach
1. Understanding (prove you get the problem)
2. Solution (how you'll solve it)
3. Methodology (your process)
4. Staffing (who does what)
5. Tools/Technology (what you'll use)

### Past Performance
1. Contract info (number, agency, value, period)
2. Relevance (why this matters for current bid)
3. Accomplishments (specific, quantified)
4. Customer contact

### Management Approach
1. Organization structure
2. Key personnel
3. Quality control
4. Risk management
5. Communication plan

## Process
1. Review RFP requirements
2. Check memory for relevant past work
3. Draft section following structure
4. Check page limits
5. Flag any compliance concerns
```

---

## 8. Security Model

### 8.1 Authentication & Access

| Layer | Method |
|-------|--------|
| **Cloud Run** | IAM - only Gmail push can invoke |
| **Gmail** | OAuth - your Google account only |
| **APIs** | Service account with minimal permissions |
| **Secrets** | Secret Manager - no secrets in code |

### 8.2 Data Protection

| Data | Protection |
|------|------------|
| **Conversations** | Firestore - encrypted at rest |
| **Memory files** | Cloud Storage - encrypted at rest |
| **API keys** | Secret Manager - never logged |
| **Emails** | Processed in memory, not stored long-term |

### 8.3 What We DON'T Do

- No storing credentials in files
- No complex multi-tenant auth
- No session tokens to manage
- No multiple auth providers
- No webhook URLs to secure

---

## 9. Cost Model

### 9.1 Google Cloud (Free Tier Covers Most)

| Service | Free Tier | Your Usage | Cost |
|---------|-----------|------------|------|
| Cloud Run | 2M requests/month | ~1K/month | $0 |
| Firestore | 1GB storage, 50K reads/day | Minimal | $0 |
| Cloud Storage | 5GB | ~100MB | $0 |
| Pub/Sub | 10GB/month | Minimal | $0 |
| Secret Manager | 6 active versions | ~5 secrets | $0 |
| **Cloud Total** | | | **~$0-5/month** |

### 9.2 Vertex AI (Gemini)

| Model | Input | Output | Estimate |
|-------|-------|--------|----------|
| Gemini 1.5 Flash | $0.075/1M tokens | $0.30/1M tokens | ~$20-50/month |
| Gemini 1.5 Pro | $1.25/1M tokens | $5.00/1M tokens | ~$50-150/month |

**Recommendation:** Use Flash for most tasks, Pro for complex analysis.

### 9.3 External APIs

| API | Cost |
|-----|------|
| SAM.gov | Free |
| FPDS | Free |
| Google Workspace | $12-18/month (you have this) |
| **Total** | **$0** |

### 9.4 Total Monthly Cost

| Scenario | Cost |
|----------|------|
| Light usage (10 conversations/day) | ~$25-40/month |
| Moderate usage (30 conversations/day) | ~$50-80/month |
| Heavy usage (100 conversations/day) | ~$100-150/month |

---

## 10. What You're NOT Building

Keep it simple. Don't build:

| Feature | Why Not |
|---------|---------|
| Web dashboard | Email is your interface |
| User authentication | It's just you |
| Multi-agent orchestration | One agent is enough |
| Custom vector database | Firestore vector search is fine |
| Real-time streaming | Email doesn't need it |
| Plugin system | Hardcode your tools |
| Multiple channels | Email + maybe HTTP API |
| Approval workflows | You approve by replying |
| Analytics dashboard | Check Firestore when curious |

You can add any of these later. Start without them.

---

## 11. Example Interactions

### Morning Briefing (Scheduled)

```
From: FedAI <fedai@yourdomain.com>
To: you@yourdomain.com
Subject: Daily Federal Contracting Brief - Feb 5

Good morning! Here's what's new:

## New Opportunities (3 matches)

1. **VA IT Helpdesk Support**
   - Solicitation: 36C10X24R0089
   - Value: $280K | Due: Feb 28
   - Set-aside: SDVOSB ✓
   - Assessment: Good fit. Matches your NAICS and set-aside.

2. **DOE Cybersecurity Assessment**
   - Solicitation: DE-SOL-0012345
   - Value: $500K | Due: Mar 15
   - Set-aside: Small Business ✓
   - Assessment: Check clearance requirement (Secret).

3. **HHS Data Analytics**
   - Solicitation: HHS-NIH-2024-001
   - Value: $1.2M | Due: Mar 22
   - Set-aside: 8(a) ✗
   - Assessment: Not eligible unless teaming.

## Deadlines
No proposals due this week.

---
Reply to this email to discuss any opportunity.
```

### RFP Analysis

```
From: you@yourdomain.com
To: fedai@yourdomain.com
Subject: Re: Daily Federal Contracting Brief

[Attached: VA-IT-Helpdesk-RFP.pdf]

Analyze this RFP and tell me if we should bid.

---

From: FedAI <fedai@yourdomain.com>

## RFP Analysis: VA IT Helpdesk Support

### Basics
- Solicitation: 36C10X24R0089
- Agency: Department of Veterans Affairs
- Due: February 28, 2024, 2:00 PM ET
- Value: $280,000 (Firm Fixed Price)
- Period: Base + 2 Option Years
- Set-aside: SDVOSB

### Evaluation Criteria (Section M)
1. Technical Approach (Most Important)
2. Past Performance (Important)
3. Price (Less Important than Technical/PP)

LPTA: No. Best Value.

### Page Limits
- Technical: 10 pages
- Past Performance: 5 pages
- Price: No limit

### Key Requirements
- Help desk support for VA regional office
- 8x5 coverage (not 24/7 ✓)
- 2 FTEs required
- No clearance required ✓
- Location: Remote acceptable ✓

### Bid/No-Bid Assessment

✅ **Recommend: BID**

Reasons:
- You qualify (SDVOSB, NAICS 541512)
- No clearance barrier
- Remote work allowed
- Value is in your sweet spot
- You have relevant help desk past performance

Concerns:
- Need 2 past performance refs (you have 2 ✓)
- Tight timeline (23 days)

Want me to start drafting the technical approach?
```

---

## Appendix: Key Differences from OpenClaw

| Aspect | OpenClaw | FedAI (Your Build) |
|--------|----------|-------------------|
| **Lines of code** | 50,000+ | ~2,000 |
| **Deployment** | Local/VM | Cloud Run (serverless) |
| **State** | SQLite + files | Firestore |
| **LLM** | Multi-provider | Vertex AI only |
| **Channels** | 10+ (WhatsApp, Telegram, etc) | Email only |
| **Auth** | Complex multi-provider | Google IAM |
| **Tools** | Plugin system | Hardcoded |
| **Skills** | Bundled + workspace | Your skills only |
| **Cost** | Server + multiple APIs | ~$50/month |
| **Maintenance** | Track upstream | You own it |

---

*Build only what you need. Add more when you need it.*
