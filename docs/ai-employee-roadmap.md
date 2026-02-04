# FedAI: Build Roadmap
## Ground-Up Implementation in 6 Weeks

**Goal:** Build a working AI employee from scratch on Google Cloud

---

## Overview

```
Week 1        Week 2        Week 3        Week 4        Week 5        Week 6
──────────────────────────────────────────────────────────────────────────────►

Project       Agent         Tools &       Email         Daily Digest  Polish &
Setup         Core          Memory        Channel       & Skills      Launch

~200 LOC      ~600 LOC      ~500 LOC      ~400 LOC      ~300 LOC      Testing
```

**Total code:** ~2,000 lines TypeScript
**Total cost:** ~$50-100 to build, ~$50/month to run

---

## Week 1: Project Setup & Infrastructure

### Goals
- Google Cloud project configured
- Basic Cloud Run service deployed
- Development environment ready

### Day 1-2: Google Cloud Setup

```bash
# Create project
gcloud projects create fedai-prod --name="FedAI"
gcloud config set project fedai-prod

# Enable APIs
gcloud services enable \
  run.googleapis.com \
  firestore.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  aiplatform.googleapis.com \
  gmail.googleapis.com \
  calendar-json.googleapis.com \
  drive.googleapis.com \
  pubsub.googleapis.com \
  cloudscheduler.googleapis.com

# Create Firestore database
gcloud firestore databases create --location=us-central1

# Create Cloud Storage bucket
gcloud storage buckets create gs://fedai-memory --location=us-central1

# Create Pub/Sub topic for Gmail
gcloud pubsub topics create gmail-notifications
```

### Day 3-4: Project Scaffolding

```
fedai/
├── src/
│   ├── index.ts              # Cloud Run entrypoint
│   ├── agent/
│   │   └── .gitkeep
│   ├── tools/
│   │   └── .gitkeep
│   ├── memory/
│   │   └── .gitkeep
│   ├── channels/
│   │   └── .gitkeep
│   └── skills/
│       └── .gitkeep
├── skills/                    # Skill markdown files
│   └── .gitkeep
├── memory/                    # Your company data
│   └── .gitkeep
├── package.json
├── tsconfig.json
├── Dockerfile
└── .env.example
```

**package.json:**
```json
{
  "name": "fedai",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "deploy": "gcloud run deploy fedai --source ."
  },
  "dependencies": {
    "@google-cloud/firestore": "^7.0.0",
    "@google-cloud/storage": "^7.0.0",
    "@google-cloud/secret-manager": "^5.0.0",
    "@google-cloud/aiplatform": "^3.0.0",
    "@google-cloud/pubsub": "^4.0.0",
    "googleapis": "^130.0.0",
    "express": "^4.18.0",
    "gray-matter": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "tsx": "^4.0.0",
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.0"
  }
}
```

**Dockerfile:**
```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
COPY skills/ ./skills/
CMD ["node", "dist/index.js"]
```

### Day 5-7: Basic Cloud Run Service

```typescript
// src/index.ts
import express from 'express';

const app = express();
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'fedai' });
});

// Placeholder for email webhook
app.post('/webhook/gmail', (req, res) => {
  console.log('Gmail webhook received:', req.body);
  res.sendStatus(200);
});

// Placeholder for scheduled jobs
app.post('/jobs/daily-digest', (req, res) => {
  console.log('Daily digest triggered');
  res.sendStatus(200);
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`FedAI listening on port ${port}`);
});
```

**Deploy:**
```bash
npm run build
gcloud run deploy fedai \
  --source . \
  --region us-central1 \
  --allow-unauthenticated  # We'll lock this down later
```

### Week 1 Checklist
- [ ] Google Cloud project created
- [ ] APIs enabled
- [ ] Firestore database created
- [ ] Cloud Storage bucket created
- [ ] Project scaffolded
- [ ] Basic Cloud Run service deployed
- [ ] Can hit health endpoint

---

## Week 2: Agent Core

### Goals
- Agent loop working
- Vertex AI integration
- Basic tool execution

### Day 1-2: Types & Interfaces

```typescript
// src/agent/types.ts

export interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  result: string;
  isError?: boolean;
}

export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (args: Record<string, unknown>) => Promise<string>;
}

export interface AgentConfig {
  model: string;
  systemPrompt: string;
  tools: Tool[];
  maxTurns: number;
}
```

### Day 3-4: Vertex AI Client

```typescript
// src/agent/gemini.ts

import { VertexAI } from '@google-cloud/aiplatform';

const vertexAI = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT!,
  location: 'us-central1',
});

export async function callGemini(params: {
  model: string;
  systemPrompt: string;
  messages: Message[];
  tools: Tool[];
}): Promise<Message> {
  const generativeModel = vertexAI.getGenerativeModel({
    model: params.model,
    systemInstruction: params.systemPrompt,
  });

  // Convert tools to Gemini format
  const geminiTools = params.tools.map(tool => ({
    functionDeclarations: [{
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }],
  }));

  // Convert messages to Gemini format
  const contents = params.messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const response = await generativeModel.generateContent({
    contents,
    tools: geminiTools,
  });

  const candidate = response.response.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  // Check for function calls
  const functionCalls = parts.filter(p => p.functionCall);
  if (functionCalls.length > 0) {
    return {
      role: 'assistant',
      content: '',
      toolCalls: functionCalls.map((fc, i) => ({
        id: `call_${i}`,
        name: fc.functionCall!.name,
        arguments: fc.functionCall!.args as Record<string, unknown>,
      })),
    };
  }

  // Return text response
  const text = parts.map(p => p.text).join('');
  return {
    role: 'assistant',
    content: text,
  };
}
```

### Day 5-7: Agent Loop

```typescript
// src/agent/core.ts

import { callGemini } from './gemini.js';
import { Message, Tool, AgentConfig, ToolResult } from './types.js';

export async function runAgent(
  config: AgentConfig,
  messages: Message[]
): Promise<Message> {
  const conversationMessages = [...messages];
  let turns = 0;

  while (turns < config.maxTurns) {
    // Call LLM
    const response = await callGemini({
      model: config.model,
      systemPrompt: config.systemPrompt,
      messages: conversationMessages,
      tools: config.tools,
    });

    // If no tool calls, return the response
    if (!response.toolCalls?.length) {
      return response;
    }

    // Execute tool calls
    const toolResults: ToolResult[] = [];
    for (const call of response.toolCalls) {
      const tool = config.tools.find(t => t.name === call.name);
      if (!tool) {
        toolResults.push({
          toolCallId: call.id,
          result: `Error: Unknown tool ${call.name}`,
          isError: true,
        });
        continue;
      }

      try {
        const result = await tool.execute(call.arguments);
        toolResults.push({
          toolCallId: call.id,
          result,
        });
      } catch (error) {
        toolResults.push({
          toolCallId: call.id,
          result: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          isError: true,
        });
      }
    }

    // Add assistant response and tool results to conversation
    conversationMessages.push(response);
    conversationMessages.push({
      role: 'tool',
      content: '',
      toolResults,
    });

    turns++;
  }

  return {
    role: 'assistant',
    content: 'I reached the maximum number of steps. Please try a simpler request.',
  };
}
```

### Week 2 Checklist
- [ ] Types defined
- [ ] Vertex AI client working
- [ ] Agent loop implemented
- [ ] Can run agent with mock tools
- [ ] Tool execution working

---

## Week 3: Tools & Memory

### Goals
- Core tools implemented (SAM.gov, memory, web search)
- Memory system working
- Skills loading

### Day 1-2: Memory System

```typescript
// src/memory/store.ts

import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';

const firestore = new Firestore();
const storage = new Storage();
const bucket = storage.bucket(process.env.MEMORY_BUCKET || 'fedai-memory');

export const memory = {
  // Load a memory file
  async getFile(path: string): Promise<string> {
    const file = bucket.file(path);
    const [content] = await file.download();
    return content.toString('utf-8');
  },

  // Get company info (always loaded)
  async getCompanyInfo(): Promise<string> {
    return this.getFile('company.md');
  },

  // Get past performance
  async getPastPerformance(): Promise<string> {
    return this.getFile('past-performance.md');
  },

  // Get rates
  async getRates(): Promise<string> {
    return this.getFile('rates.md');
  },

  // Save conversation
  async saveConversation(id: string, messages: Message[]): Promise<void> {
    await firestore.collection('conversations').doc(id).set({
      messages,
      updatedAt: new Date(),
    });
  },

  // Load conversation
  async getConversation(id: string): Promise<Message[]> {
    const doc = await firestore.collection('conversations').doc(id).get();
    return doc.exists ? doc.data()?.messages || [] : [];
  },
};
```

### Day 3-4: Core Tools

```typescript
// src/tools/sam-gov.ts

import { Tool } from '../agent/types.js';

const SAM_API_KEY = process.env.SAM_API_KEY;
const SAM_BASE_URL = 'https://api.sam.gov/opportunities/v2/search';

export const samSearchTool: Tool = {
  name: 'sam_search',
  description: 'Search SAM.gov for federal contracting opportunities',
  parameters: {
    type: 'object',
    properties: {
      keyword: { type: 'string', description: 'Keyword to search for' },
      naicsCode: { type: 'string', description: 'NAICS code to filter by' },
      setAside: { type: 'string', description: 'Set-aside type (SBA, SDVOSB, 8A, etc)' },
      postedFrom: { type: 'string', description: 'Posted after date (MM/DD/YYYY)' },
      limit: { type: 'number', description: 'Max results (default 10)' },
    },
  },
  async execute(args) {
    const params = new URLSearchParams({
      api_key: SAM_API_KEY!,
      limit: String(args.limit || 10),
      postedFrom: args.postedFrom as string || getLastWeekDate(),
    });

    if (args.keyword) params.append('keyword', args.keyword as string);
    if (args.naicsCode) params.append('naicsCode', args.naicsCode as string);
    if (args.setAside) params.append('typeOfSetAside', args.setAside as string);

    const response = await fetch(`${SAM_BASE_URL}?${params}`);
    const data = await response.json();

    if (!data.opportunitiesData?.length) {
      return 'No opportunities found matching your criteria.';
    }

    const opportunities = data.opportunitiesData.map((opp: any) => ({
      title: opp.title,
      solicitationNumber: opp.solicitationNumber,
      agency: opp.department,
      postedDate: opp.postedDate,
      responseDeadline: opp.responseDeadLine,
      setAside: opp.typeOfSetAside,
      naicsCode: opp.naicsCode,
    }));

    return JSON.stringify(opportunities, null, 2);
  },
};

function getLastWeekDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}
```

```typescript
// src/tools/memory.ts

import { Tool } from '../agent/types.js';
import { memory } from '../memory/store.js';

export const memoryReadTool: Tool = {
  name: 'memory_read',
  description: 'Read a file from memory (company info, past performance, rates, etc)',
  parameters: {
    type: 'object',
    properties: {
      file: {
        type: 'string',
        description: 'File to read: company, past-performance, rates, or a custom path',
      },
    },
    required: ['file'],
  },
  async execute(args) {
    const file = args.file as string;

    switch (file) {
      case 'company':
        return memory.getCompanyInfo();
      case 'past-performance':
        return memory.getPastPerformance();
      case 'rates':
        return memory.getRates();
      default:
        return memory.getFile(file);
    }
  },
};
```

```typescript
// src/tools/web-search.ts

import { Tool } from '../agent/types.js';

// Using Serper.dev - $50 for 2500 searches
const SERPER_API_KEY = process.env.SERPER_API_KEY;

export const webSearchTool: Tool = {
  name: 'web_search',
  description: 'Search the web for information',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      num: { type: 'number', description: 'Number of results (default 5)' },
    },
    required: ['query'],
  },
  async execute(args) {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: args.query,
        num: args.num || 5,
      }),
    });

    const data = await response.json();
    const results = data.organic?.map((r: any) => ({
      title: r.title,
      snippet: r.snippet,
      link: r.link,
    }));

    return JSON.stringify(results, null, 2);
  },
};
```

### Day 5-6: Skills Loader

```typescript
// src/skills/loader.ts

import { Storage } from '@google-cloud/storage';
import matter from 'gray-matter';

const storage = new Storage();
const bucket = storage.bucket(process.env.MEMORY_BUCKET || 'fedai-memory');

export interface Skill {
  name: string;
  description: string;
  content: string;
}

export async function loadSkills(): Promise<Skill[]> {
  const [files] = await bucket.getFiles({ prefix: 'skills/' });

  const skills: Skill[] = [];
  for (const file of files) {
    if (!file.name.endsWith('.md')) continue;

    const [content] = await file.download();
    const { data, content: body } = matter(content.toString('utf-8'));

    skills.push({
      name: data.name || file.name,
      description: data.description || '',
      content: body,
    });
  }

  return skills;
}

export function buildSystemPrompt(skills: Skill[], companyInfo: string): string {
  const skillsSection = skills
    .map(s => `### ${s.name}\n${s.content}`)
    .join('\n\n');

  return `You are FedAI, a federal contracting assistant.

## Your Company
${companyInfo}

## Your Skills
${skillsSection}

## Guidelines
- Be concise and actionable
- Always check memory for company-specific information before answering
- Cite specific sources (RFP section numbers, FAR clauses)
- Flag compliance risks and concerns
- Ask clarifying questions when requirements are ambiguous
- When analyzing opportunities, compare against company qualifications
`;
}
```

### Day 7: Tool Registry

```typescript
// src/tools/index.ts

import { Tool } from '../agent/types.js';
import { samSearchTool } from './sam-gov.js';
import { memoryReadTool } from './memory.js';
import { webSearchTool } from './web-search.js';

export const tools: Tool[] = [
  samSearchTool,
  memoryReadTool,
  webSearchTool,
];

export function getTools(): Tool[] {
  return tools;
}
```

### Week 3 Checklist
- [ ] Memory system working
- [ ] SAM.gov search tool working
- [ ] Web search tool working
- [ ] Skills loader working
- [ ] System prompt builder working
- [ ] Tools integrated with agent

---

## Week 4: Email Channel

### Goals
- Gmail API integration
- Receive emails via Pub/Sub
- Send reply emails
- Conversation threading

### Day 1-2: Gmail OAuth Setup

```bash
# In Google Cloud Console:
# 1. Create OAuth 2.0 credentials
# 2. Add your email as a test user
# 3. Download credentials.json

# Get refresh token (run locally once)
npx ts-node scripts/gmail-auth.ts
```

```typescript
// scripts/gmail-auth.ts
import { google } from 'googleapis';
import http from 'http';
import open from 'open';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:3000/callback'
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify',
  ],
});

console.log('Opening browser for auth...');
open(authUrl);

const server = http.createServer(async (req, res) => {
  if (req.url?.startsWith('/callback')) {
    const code = new URL(req.url, 'http://localhost:3000').searchParams.get('code');
    const { tokens } = await oauth2Client.getToken(code!);
    console.log('\nRefresh token:', tokens.refresh_token);
    console.log('\nAdd this to Secret Manager as GMAIL_REFRESH_TOKEN');
    res.end('Done! Check your terminal.');
    server.close();
  }
});

server.listen(3000);
```

### Day 3-4: Gmail Client

```typescript
// src/channels/gmail.ts

import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

oauth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN,
});

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

export async function getEmail(messageId: string) {
  const response = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const headers = response.data.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value;

  // Decode body
  let body = '';
  const payload = response.data.payload;
  if (payload?.body?.data) {
    body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
  } else if (payload?.parts) {
    const textPart = payload.parts.find(p => p.mimeType === 'text/plain');
    if (textPart?.body?.data) {
      body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
    }
  }

  return {
    id: response.data.id!,
    threadId: response.data.threadId!,
    from: getHeader('From'),
    to: getHeader('To'),
    subject: getHeader('Subject'),
    date: getHeader('Date'),
    body: body.trim(),
  };
}

export async function sendReply(params: {
  threadId: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
}) {
  const message = [
    `To: ${params.to}`,
    `Subject: Re: ${params.subject.replace(/^Re:\s*/i, '')}`,
    params.inReplyTo ? `In-Reply-To: ${params.inReplyTo}` : '',
    params.inReplyTo ? `References: ${params.inReplyTo}` : '',
    'Content-Type: text/plain; charset=utf-8',
    '',
    params.body,
  ].filter(Boolean).join('\r\n');

  const encodedMessage = Buffer.from(message).toString('base64url');

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
      threadId: params.threadId,
    },
  });
}

export async function watchInbox() {
  await gmail.users.watch({
    userId: 'me',
    requestBody: {
      topicName: `projects/${process.env.GOOGLE_CLOUD_PROJECT}/topics/gmail-notifications`,
      labelIds: ['INBOX'],
    },
  });
}
```

### Day 5-6: Email Handler

```typescript
// src/channels/email-handler.ts

import { runAgent } from '../agent/core.js';
import { getTools } from '../tools/index.js';
import { loadSkills, buildSystemPrompt } from '../skills/loader.js';
import { memory } from '../memory/store.js';
import { getEmail, sendReply } from './gmail.js';

// Your email address - only process emails TO this address
const MY_EMAIL = process.env.MY_EMAIL;

export async function handleEmailNotification(data: { emailId: string }) {
  // Get email details
  const email = await getEmail(data.emailId);

  // Only process emails sent TO you (not FROM you)
  if (!email.to?.includes(MY_EMAIL!)) {
    console.log('Skipping email not addressed to me');
    return;
  }

  // Use thread ID as conversation ID
  const conversationId = email.threadId;

  // Load conversation history
  const history = await memory.getConversation(conversationId);

  // Load skills and build system prompt
  const skills = await loadSkills();
  const companyInfo = await memory.getCompanyInfo();
  const systemPrompt = buildSystemPrompt(skills, companyInfo);

  // Run agent
  const response = await runAgent(
    {
      model: 'gemini-1.5-flash',
      systemPrompt,
      tools: getTools(),
      maxTurns: 10,
    },
    [...history, { role: 'user', content: email.body }]
  );

  // Save conversation
  await memory.saveConversation(conversationId, [
    ...history,
    { role: 'user', content: email.body },
    response,
  ]);

  // Send reply
  await sendReply({
    threadId: email.threadId,
    to: email.from!,
    subject: email.subject!,
    body: response.content,
    inReplyTo: email.id,
  });

  console.log(`Replied to email ${email.id}`);
}
```

### Day 7: Wire Up Webhook

```typescript
// src/index.ts - update webhook handler

import { handleEmailNotification } from './channels/email-handler.js';

app.post('/webhook/gmail', async (req, res) => {
  try {
    // Decode Pub/Sub message
    const message = req.body.message;
    const data = JSON.parse(
      Buffer.from(message.data, 'base64').toString('utf-8')
    );

    await handleEmailNotification({ emailId: data.emailId });
    res.sendStatus(200);
  } catch (error) {
    console.error('Error handling email:', error);
    res.sendStatus(500);
  }
});
```

### Week 4 Checklist
- [ ] Gmail OAuth working
- [ ] Can read emails
- [ ] Can send reply emails
- [ ] Pub/Sub webhook receiving notifications
- [ ] Conversation threading working
- [ ] End-to-end email → agent → reply working

---

## Week 5: Daily Digest & Skills

### Goals
- Scheduled daily digest
- Core skills written
- Calendar integration

### Day 1-2: Cloud Scheduler Setup

```bash
# Create scheduler job for daily digest
gcloud scheduler jobs create http daily-digest \
  --location us-central1 \
  --schedule "0 7 * * 1-5" \
  --uri "https://fedai-xxxxx.run.app/jobs/daily-digest" \
  --http-method POST \
  --oidc-service-account-email fedai@fedai-prod.iam.gserviceaccount.com
```

```typescript
// src/jobs/daily-digest.ts

import { samSearchTool } from '../tools/sam-gov.js';
import { memory } from '../memory/store.js';
import { sendEmail } from '../channels/gmail.js';

export async function runDailyDigest() {
  // Load company info to get NAICS codes and set-asides
  const companyInfo = await memory.getCompanyInfo();

  // Extract NAICS codes (you'd parse this from your company.md)
  const naicsCodes = ['541512', '541511']; // Example
  const setAsides = ['SDVOSB', 'SBA'];

  // Search for opportunities
  const opportunities = [];
  for (const naics of naicsCodes) {
    for (const setAside of setAsides) {
      const results = await samSearchTool.execute({
        naicsCode: naics,
        setAside,
        limit: 5,
      });
      opportunities.push(...JSON.parse(results));
    }
  }

  // Deduplicate
  const unique = [...new Map(
    opportunities.map(o => [o.solicitationNumber, o])
  ).values()];

  // Format email
  const body = formatDigestEmail(unique);

  // Send
  await sendEmail({
    to: process.env.MY_EMAIL!,
    subject: `Daily Federal Contracting Brief - ${new Date().toLocaleDateString()}`,
    body,
  });
}

function formatDigestEmail(opportunities: any[]): string {
  if (opportunities.length === 0) {
    return 'No new opportunities matching your criteria today.';
  }

  const lines = ['Good morning! Here are today\'s matching opportunities:\n'];

  for (const opp of opportunities) {
    lines.push(`**${opp.title}**`);
    lines.push(`- Solicitation: ${opp.solicitationNumber}`);
    lines.push(`- Agency: ${opp.agency}`);
    lines.push(`- Due: ${opp.responseDeadline}`);
    lines.push(`- Set-aside: ${opp.setAside}`);
    lines.push('');
  }

  lines.push('---');
  lines.push('Reply to this email to discuss any opportunity.');

  return lines.join('\n');
}
```

### Day 3-5: Write Core Skills

Upload these to Cloud Storage under `skills/`:

**skills/opportunity-search.md** - (see PRD for content)

**skills/rfp-analysis.md** - (see PRD for content)

**skills/proposal-writing.md** - (see PRD for content)

**skills/pricing.md:**
```markdown
---
name: pricing
description: Help with cost proposal pricing
---

When helping with pricing:

1. **Get the user's rates** from memory (memory_read: rates)

2. **Calculate labor costs**
   - Hours = FTEs × 2080 (or actual hours if part-time)
   - Direct labor = Hours × hourly rate

3. **Apply indirect rates** (from user's rate file)
   - Fringe benefits (typically 25-35%)
   - Overhead (typically 10-20%)
   - G&A (typically 8-15%)

4. **Add fee/profit** (typically 8-15% for FFP)

5. **Present clearly**
   - Show the math
   - Total by year if multi-year
   - Compare to ceiling/budget if known

Always ask about:
- Contract type (FFP, T&M, CPFF)
- Period of performance
- Number and level of staff
- ODCs (travel, equipment, etc.)
```

**skills/compliance.md:**
```markdown
---
name: compliance
description: FAR/DFARS compliance guidance
---

When asked about compliance:

1. **For FAR clause questions**
   - Search web for the specific clause
   - Explain in plain English
   - Note key requirements
   - Flag what the user needs to do

2. **Common clauses to know**
   - FAR 52.219-14: Limitations on Subcontracting
   - FAR 52.204-7: System for Award Management
   - FAR 52.222-50: Combating Trafficking in Persons
   - DFARS 252.204-7012: Safeguarding Covered Defense Info

3. **For bid compliance**
   - Check set-aside eligibility
   - Verify NAICS code match
   - Note clearance requirements
   - Check past performance requirements

Always cite the specific regulation.
```

### Day 6-7: Calendar Integration

```typescript
// src/tools/calendar.ts

import { google } from 'googleapis';
import { Tool } from '../agent/types.js';

const oauth2Client = /* same as gmail */;
const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

export const calendarAddTool: Tool = {
  name: 'calendar_add',
  description: 'Add a deadline or event to Google Calendar',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Event title' },
      date: { type: 'string', description: 'Date (YYYY-MM-DD)' },
      time: { type: 'string', description: 'Time (HH:MM) - optional' },
      description: { type: 'string', description: 'Event description' },
    },
    required: ['title', 'date'],
  },
  async execute(args) {
    const startDate = args.time
      ? `${args.date}T${args.time}:00`
      : args.date;

    await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: args.title as string,
        description: args.description as string,
        start: args.time
          ? { dateTime: startDate, timeZone: 'America/New_York' }
          : { date: args.date as string },
        end: args.time
          ? { dateTime: startDate, timeZone: 'America/New_York' }
          : { date: args.date as string },
      },
    });

    return `Added "${args.title}" to calendar for ${args.date}`;
  },
};
```

### Week 5 Checklist
- [ ] Daily digest job scheduled
- [ ] Digest email sending correctly
- [ ] All core skills uploaded
- [ ] Calendar tool working
- [ ] Skills loading into system prompt

---

## Week 6: Polish & Launch

### Goals
- Security lockdown
- Error handling
- Testing
- Deploy to production

### Day 1-2: Security

```typescript
// Verify Pub/Sub requests
import { OAuth2Client } from 'google-auth-library';

const authClient = new OAuth2Client();

async function verifyPubSubToken(req: Request): Promise<boolean> {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return false;

  try {
    await authClient.verifyIdToken({
      idToken: token,
      audience: process.env.CLOUD_RUN_URL,
    });
    return true;
  } catch {
    return false;
  }
}
```

```bash
# Lock down Cloud Run to require authentication
gcloud run services update fedai \
  --ingress internal-and-cloud-load-balancing \
  --no-allow-unauthenticated

# Grant Pub/Sub permission to invoke
gcloud run services add-iam-policy-binding fedai \
  --member="serviceAccount:service-PROJECT_NUM@gcp-sa-pubsub.iam.gserviceaccount.com" \
  --role="roles/run.invoker"

# Grant Cloud Scheduler permission to invoke
gcloud run services add-iam-policy-binding fedai \
  --member="serviceAccount:fedai@fedai-prod.iam.gserviceaccount.com" \
  --role="roles/run.invoker"
```

### Day 3-4: Error Handling & Logging

```typescript
// src/utils/errors.ts

export class FedAIError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'FedAIError';
  }
}

// Wrap handler with error handling
export function withErrorHandling(
  handler: (req: Request, res: Response) => Promise<void>
) {
  return async (req: Request, res: Response) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error('Handler error:', error);

      if (error instanceof FedAIError && error.recoverable) {
        // Log but return 200 to prevent Pub/Sub retries
        res.sendStatus(200);
      } else {
        // Return 500 to trigger retry
        res.sendStatus(500);
      }
    }
  };
}
```

### Day 5-6: Testing

```typescript
// Test locally
async function testAgent() {
  const skills = await loadSkills();
  const companyInfo = await memory.getCompanyInfo();
  const systemPrompt = buildSystemPrompt(skills, companyInfo);

  const response = await runAgent(
    {
      model: 'gemini-1.5-flash',
      systemPrompt,
      tools: getTools(),
      maxTurns: 5,
    },
    [{ role: 'user', content: 'Search for SDVOSB IT opportunities under $500K' }]
  );

  console.log('Response:', response.content);
}

testAgent();
```

### Day 7: Launch

```bash
# Final deploy
npm run build
gcloud run deploy fedai --source . --region us-central1

# Start Gmail watch
curl -X POST https://fedai-xxxxx.run.app/admin/start-watch \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)"

# Test daily digest
curl -X POST https://fedai-xxxxx.run.app/jobs/daily-digest \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)"

# Send test email to yourself
echo "Test: Search for IT opportunities" | mail -s "Test" fedai@yourdomain.com
```

### Week 6 Checklist
- [ ] Cloud Run locked down
- [ ] Pub/Sub auth working
- [ ] Error handling in place
- [ ] Logging working
- [ ] Local tests passing
- [ ] Gmail watch started
- [ ] Daily digest running
- [ ] End-to-end test complete
- [ ] **LAUNCHED!**

---

## Total Investment

### Time
| Week | Hours |
|------|-------|
| Week 1: Setup | 10-15 |
| Week 2: Agent | 15-20 |
| Week 3: Tools | 15-20 |
| Week 4: Email | 15-20 |
| Week 5: Skills | 10-15 |
| Week 6: Polish | 10-15 |
| **Total** | **75-105 hours** |

### Code
| Module | Lines |
|--------|-------|
| Agent core | ~500 |
| Tools | ~400 |
| Memory | ~200 |
| Skills loader | ~100 |
| Email channel | ~400 |
| Jobs | ~200 |
| Utils | ~200 |
| **Total** | **~2,000** |

### Cost
| Item | Setup | Monthly |
|------|-------|---------|
| Development time | Your time | - |
| Google Cloud | $0 | $0-5 |
| Vertex AI (Gemini) | ~$20 | $30-80 |
| Domain (optional) | $12/year | - |
| **Total** | **~$20** | **~$30-80** |

---

## What You'll Have

```
✅ AI assistant that knows your federal contracting business
✅ Email-based interface (reply to interact)
✅ Daily opportunity digest from SAM.gov
✅ RFP analysis and bid/no-bid recommendations
✅ Proposal drafting assistance
✅ Pricing calculations with your rates
✅ FAR/DFARS compliance guidance
✅ Calendar integration for deadlines
✅ Conversation memory across threads
✅ Fully serverless (scales to zero)
✅ You own every line of code
```

---

*You built it. You own it. Now go win some contracts.*
