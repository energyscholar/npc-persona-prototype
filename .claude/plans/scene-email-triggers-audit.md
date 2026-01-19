# Audit Plan: Scene Email Triggers

**Status:** READY FOR GENERATOR
**Date:** 2026-01-17

---

## Objective

When PC completes a scene that triggers email delivery, NPC sends email automatically and UI displays notification. First use case: Anders sends Highndry briefing email when scout-office scene completes.

---

## Requirements

1. **Scene-triggered emails** - Scenes can define emails to send on completion
2. **NPC identity** - Email comes from NPC's official identity (title, not personal)
3. **UI notification** - TUI displays "Email received from [Name]: [Subject]" when email sent
4. **Idempotent** - Email only sent once per scene completion (not on replay)

---

## Data Structure

### Scene Email Trigger

Add to scene JSON:

```json
{
  "on_complete": {
    "emails": [
      {
        "template": "casarii-briefing",
        "from_npc": "mr-casarii"
      }
    ]
  }
}
```

### Email Notification Result

`advanceToScene()` returns:

```javascript
result.emailsTriggered = [
  {
    from: "Anders Casarii",
    subject: "Highndry Recovery Mission - Official Briefing",
    npcId: "mr-casarii"
  }
]
```

---

## Deliverables

| # | File | Type | Description |
|---|------|------|-------------|
| D1 | `src/scene-manager.js` | MODIFY | Import email-system, trigger emails in advanceToScene |
| D2 | `src/adventure-player.js` | MODIFY | Display email notifications on scene transition |
| D3 | `data/adventures/high-and-dry/scenes/scout-office.json` | MODIFY | Add on_complete.emails trigger |
| D4 | `tests/scene-email-triggers.test.js` | NEW | Test email trigger flow |

---

## D1: scene-manager.js Changes

**Add imports:**
```javascript
const { sendEmailFromTemplate } = require('./email-system');
const { loadPersona } = require('./persona');
```

**In advanceToScene(), after marking scene complete (after line ~173):**
```javascript
// Trigger emails on scene completion
if (currentScene.on_complete?.emails) {
  result.emailsTriggered = [];
  for (const emailTrigger of currentScene.on_complete.emails) {
    try {
      const npc = loadPersona(emailTrigger.from_npc);
      const email = sendEmailFromTemplate(session, emailTrigger.template, npc);
      if (email) {
        result.emailsTriggered.push({
          from: npc.name,
          subject: email.subject,
          npcId: npc.id
        });
      }
    } catch (e) {
      console.warn(`Failed to send email: ${emailTrigger.template}`, e.message);
    }
  }
}
```

---

## D2: adventure-player.js Changes

**In handleAgmNarration(), after scene transition handling (~line 182):**
```javascript
// Display email notifications
if (sceneResult.emailsTriggered?.length > 0) {
  for (const emailInfo of sceneResult.emailsTriggered) {
    result.text += `\n\n📧 Email received from ${emailInfo.from}: "${emailInfo.subject}"`;
  }
}
```

---

## D3: scout-office.json Changes

Add `on_complete` block after `npc_opening_behavior`:

```json
"on_complete": {
  "emails": [
    {
      "template": "casarii-briefing",
      "from_npc": "mr-casarii"
    }
  ]
}
```

---

## D4: Test Cases

**File:** `tests/scene-email-triggers.test.js`

```javascript
// TEST T.1: advanceToScene triggers email when on_complete.emails defined
// TEST T.2: emailsTriggered includes from, subject, npcId
// TEST T.3: Email appears in PC inbox after scene transition
// TEST T.4: Email not sent if scene already completed (idempotent)
// TEST T.5: scout-office.json has on_complete.emails with casarii-briefing
// TEST T.6: Missing template logs warning but doesn't break transition
```

---

## Implementation Order

1. D4: Create tests
2. D1: Modify scene-manager.js
3. D3: Add trigger to scout-office.json
4. D2: Add notification display to adventure-player.js
5. Run tests

---

## Verification

```bash
node tests/scene-email-triggers.test.js
node tests/email-system.test.js  # Existing tests still pass
```

---

## Handoff

Generator: Implement `.claude/plans/scene-email-triggers-audit.md` deliverables D1-D4.
