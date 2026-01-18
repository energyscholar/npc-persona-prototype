# Audit Plan: PC Email System

**Status:** READY FOR GENERATOR
**Date:** 2026-01-17

---

## Objective

NPCs can send emails to PC containing important briefings, documents, and information. PC can check email from main TUI menu. Provides persistent reference for mission-critical details.

---

## Use Cases

1. **Anders sends briefing email** after Scout Office meeting - contains all Highndry details
2. **Minister Greener sends job offer** with payment terms
3. **Gvoudzon sends contact list** with his connections
4. **NPCs send updates** as story progresses
5. **PC reviews old emails** for reference

---

## Data Structure

### Email Schema

```json
{
  "id": "email-001",
  "from": {
    "npcId": "mr-casarii",
    "name": "Anders Casarii",
    "title": "Scout Service Administrator"
  },
  "to": "alex-ryder",
  "subject": "Highndry Recovery Mission - Official Briefing",
  "timestamp": "2026-01-17T10:30:00Z",
  "scene": "scout-office",
  "read": false,
  "priority": "normal",
  "attachments": ["iiss-detached-duty-documents"],
  "body": "Dear Traveller,\n\nAs discussed in our meeting, here are the details of your detached duty assignment...",
  "tags": ["mission", "briefing", "official"]
}
```

### Email Storage

**File:** `data/state/adventures/{adventure}-{pc}/emails.json`

```json
{
  "pcId": "alex-ryder",
  "adventureId": "high-and-dry",
  "inbox": [
    { ...email objects... }
  ],
  "unreadCount": 2
}
```

---

## Deliverables

| # | File | Type | Description |
|---|------|------|-------------|
| D1 | `src/email-system.js` | NEW | Email CRUD operations |
| D2 | `src/chat-tui.js` | MODIFY | Add "Check Email" to main menu |
| D3 | `src/adventure-player.js` | MODIFY | Wire email into session |
| D4 | `data/emails/templates/casarii-briefing.json` | NEW | Anders' briefing email template |
| D5 | `data/emails/templates/greener-job-offer.json` | NEW | Greener's job offer email |
| D6 | `tests/email-system.test.js` | NEW | Email system tests |

---

## D1: Email System Module

**File:** `src/email-system.js`

```javascript
/**
 * PC Email System
 * NPCs send emails, PC reads them
 */

const fs = require('fs');
const path = require('path');

const EMAILS_DIR = path.join(__dirname, '../data/state/adventures');

function getEmailsPath(adventureId, pcId) {
  return path.join(EMAILS_DIR, `${adventureId}-${pcId}`, 'emails.json');
}

function loadEmails(adventureId, pcId) {
  const emailsPath = getEmailsPath(adventureId, pcId);
  if (!fs.existsSync(emailsPath)) {
    return { pcId, adventureId, inbox: [], unreadCount: 0 };
  }
  return JSON.parse(fs.readFileSync(emailsPath, 'utf8'));
}

function saveEmails(adventureId, pcId, emailData) {
  const emailsPath = getEmailsPath(adventureId, pcId);
  const dir = path.dirname(emailsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(emailsPath, JSON.stringify(emailData, null, 2));
}

function sendEmail(session, { from, subject, body, attachments = [], priority = 'normal', tags = [] }) {
  const emailData = loadEmails(session.adventureId, session.pc.id);

  const email = {
    id: `email-${Date.now()}`,
    from: {
      npcId: from.id,
      name: from.name,
      title: from.title || ''
    },
    to: session.pc.id,
    subject,
    body,
    attachments,
    priority,
    tags,
    timestamp: new Date().toISOString(),
    scene: session.storyState?.currentScene || null,
    read: false
  };

  emailData.inbox.unshift(email); // Newest first
  emailData.unreadCount = emailData.inbox.filter(e => !e.read).length;

  saveEmails(session.adventureId, session.pc.id, emailData);
  return email;
}

function markAsRead(session, emailId) {
  const emailData = loadEmails(session.adventureId, session.pc.id);
  const email = emailData.inbox.find(e => e.id === emailId);
  if (email && !email.read) {
    email.read = true;
    emailData.unreadCount = emailData.inbox.filter(e => !e.read).length;
    saveEmails(session.adventureId, session.pc.id, emailData);
  }
  return email;
}

function getUnreadCount(session) {
  const emailData = loadEmails(session.adventureId, session.pc.id);
  return emailData.unreadCount;
}

function getInbox(session) {
  const emailData = loadEmails(session.adventureId, session.pc.id);
  return emailData.inbox;
}

function getEmail(session, emailId) {
  const emailData = loadEmails(session.adventureId, session.pc.id);
  return emailData.inbox.find(e => e.id === emailId);
}

function formatEmailList(emails) {
  return emails.map((e, i) => {
    const unread = e.read ? ' ' : '*';
    const date = new Date(e.timestamp).toLocaleDateString();
    return `${unread} ${i + 1}. [${date}] ${e.from.name}: ${e.subject}`;
  }).join('\n');
}

function formatEmailFull(email) {
  const date = new Date(email.timestamp).toLocaleString();
  let output = `
═══════════════════════════════════════════════════════
From: ${email.from.name}${email.from.title ? ` (${email.from.title})` : ''}
Date: ${date}
Subject: ${email.subject}
═══════════════════════════════════════════════════════

${email.body}
`;

  if (email.attachments && email.attachments.length > 0) {
    output += `\nAttachments: ${email.attachments.join(', ')}`;
  }

  return output;
}

module.exports = {
  loadEmails,
  saveEmails,
  sendEmail,
  markAsRead,
  getUnreadCount,
  getInbox,
  getEmail,
  formatEmailList,
  formatEmailFull
};
```

---

## D2: TUI Integration

**File:** `src/chat-tui.js`

Add to main menu:

```javascript
// In main menu display, add:
║  6. Check Email ${unreadCount > 0 ? `(${unreadCount} new)` : ''}  ║

// Add menu handler:
case '6':
  return checkEmailMenu(rl, session);
```

Email menu function:

```javascript
async function checkEmailMenu(rl, session) {
  const { system: sysColor, npc: npcColor, reset } = TUI_CONFIG.colors;
  const emails = getInbox(session);
  const unread = getUnreadCount(session);

  console.log(`\n${sysColor}═══════════════════════════════════════════════════════${reset}`);
  console.log(`${sysColor}  INBOX ${unread > 0 ? `(${unread} unread)` : ''}${reset}`);
  console.log(`${sysColor}═══════════════════════════════════════════════════════${reset}\n`);

  if (emails.length === 0) {
    console.log('  No emails.\n');
    return main();
  }

  console.log(formatEmailList(emails));
  console.log('\n  Enter number to read, or B to go back\n');

  const answer = await promptInput(rl, '  Select: ');

  if (answer.toLowerCase() === 'b') {
    return main();
  }

  const num = parseInt(answer);
  if (!isNaN(num) && num >= 1 && num <= emails.length) {
    const email = emails[num - 1];
    markAsRead(session, email.id);
    console.log(formatEmailFull(email));
    await promptInput(rl, '\n  Press Enter to continue...');
    return checkEmailMenu(rl, session);
  }

  return checkEmailMenu(rl, session);
}
```

---

## D4: Anders Briefing Email Template

**File:** `data/emails/templates/casarii-briefing.json`

```json
{
  "id": "casarii-briefing",
  "trigger": "after_scout_office_briefing",
  "from": "mr-casarii",
  "subject": "Highndry Recovery Mission - Official Briefing",
  "priority": "high",
  "tags": ["mission", "briefing", "official"],
  "attachments": ["iiss-detached-duty-documents"],
  "body": "Dear Traveller,\n\nAs discussed in our meeting, here is the official briefing for your detached duty assignment.\n\n=== THE SHIP ===\nHighndry is a Type S Scout/Courier, standard configuration. She is currently stranded somewhere on Walston. The previous crew disabled her control electronics before abandoning ship. We don't have precise coordinates - you'll need to investigate when you arrive.\n\n=== YOUR STATUS ===\nThis is a one-year renewable lease under detached duty terms. The Scout Service retains ownership; you operate under our terms. Renewal is based on performance and compliance.\n\n=== EQUIPMENT ===\nYour repair kit includes:\n- Three flight cases of circuit panels and tools\n- Portable diagnostic unit with temporary control software\n- Container of general spares\n\nThe diagnostic unit can upload a software patch good for three months.\n\n=== TRAVEL ===\nPassage booked on the Autumn Gold, departing tomorrow.\n- Jump to 567-908 (Scout waystation) - ~1 week\n- Layover for cargo/refueling - 1 day\n- Jump to Walston - ~1 week\n\n=== EXPENSES ===\nCr1000 per traveller credited for incidentals. Life support and fuel costs during mission are covered. Additional Cr1000 available after Highndry passes post-recovery checkout.\n\nGood luck with your recovery.\n\nAnders Casarii\nScout Service Administrator\nFlammarion Highport"
}
```

---

## D5: Greener Job Offer Email

**File:** `data/emails/templates/greener-job-offer.json`

```json
{
  "id": "greener-job-offer",
  "trigger": "after_greener_meeting",
  "from": "minister-greener",
  "subject": "Proposal: Data Recovery from Mount Salbarii",
  "priority": "normal",
  "tags": ["job", "offer", "walston"],
  "body": "To the crew of the scout vessel,\n\nFurther to our discussion, I am writing to formalize the offer of employment.\n\n=== THE JOB ===\nRecover scientific data from a monitoring station on Mount Salbarii. A geologist was conducting research there when the volcano became active. The data is valuable to Walston's future.\n\n=== PAYMENT ===\nCr3000 in cash, payable upon delivery of the data.\n\nI understand this coincides with your own business on the mountain. Perhaps we can be of mutual assistance.\n\nYours faithfully,\n\nAlan Greener\nMinister of Affairs\nGovernment of Walston"
}
```

---

## D6: Test Cases

```javascript
// TEST E.1: sendEmail creates email in inbox
// TEST E.2: getUnreadCount returns correct count
// TEST E.3: markAsRead updates read status
// TEST E.4: formatEmailList shows unread indicator
// TEST E.5: Email templates exist
// TEST E.6: Email persists to file
```

---

## Implementation Order

1. D6: Create tests
2. D1: Create email-system.js
3. D4-D5: Create email templates
4. D2: Add to TUI main menu
5. D3: Wire into adventure-player session
6. Run tests

---

## Verification

```bash
node tests/email-system.test.js
npm run tui  # Check main menu shows "Check Email"
```

---

## Future: NPC Sends Email Automatically

After scene completion, trigger emails:

```javascript
// In scene transition logic:
if (scene.id === 'scout-office' && scene.completed) {
  const template = loadEmailTemplate('casarii-briefing');
  sendEmailFromTemplate(session, template);
}
```
