/**
 * PC Email System
 * NPCs send emails, PC reads them from TUI
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_EMAILS_DIR = path.join(__dirname, '../data/state/adventures');

/**
 * Get path to emails file for a PC in an adventure
 */
function getEmailsPath(session) {
  const baseDir = session._testEmailDir || DEFAULT_EMAILS_DIR;
  return path.join(baseDir, `${session.adventureId}-${session.pc.id}`, 'emails.json');
}

/**
 * Load emails for a PC
 */
function loadEmails(session) {
  const emailsPath = getEmailsPath(session);
  if (!fs.existsSync(emailsPath)) {
    return {
      pcId: session.pc.id,
      adventureId: session.adventureId,
      inbox: [],
      unreadCount: 0
    };
  }
  return JSON.parse(fs.readFileSync(emailsPath, 'utf8'));
}

/**
 * Save emails for a PC
 */
function saveEmails(session, emailData) {
  const emailsPath = getEmailsPath(session);
  const dir = path.dirname(emailsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(emailsPath, JSON.stringify(emailData, null, 2));
}

/**
 * Send an email to the PC from an NPC
 * @param {Object} session - Adventure session
 * @param {Object} options - Email options
 * @param {Object} options.from - NPC object with id, name, title
 * @param {string} options.subject - Email subject
 * @param {string} options.body - Email body
 * @param {string[]} options.attachments - Item IDs attached
 * @param {string} options.priority - 'normal', 'high', 'low'
 * @param {string[]} options.tags - Tags for categorization
 * @returns {Object} The created email
 */
function sendEmail(session, { from, subject, body, attachments = [], priority = 'normal', tags = [] }) {
  const emailData = loadEmails(session);

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

  saveEmails(session, emailData);
  return email;
}

/**
 * Mark an email as read
 */
function markAsRead(session, emailId) {
  const emailData = loadEmails(session);
  const email = emailData.inbox.find(e => e.id === emailId);
  if (email && !email.read) {
    email.read = true;
    emailData.unreadCount = emailData.inbox.filter(e => !e.read).length;
    saveEmails(session, emailData);
  }
  return email;
}

/**
 * Get count of unread emails
 */
function getUnreadCount(session) {
  const emailData = loadEmails(session);
  return emailData.unreadCount;
}

/**
 * Get all emails in inbox
 */
function getInbox(session) {
  const emailData = loadEmails(session);
  return emailData.inbox;
}

/**
 * Get a specific email by ID
 */
function getEmail(session, emailId) {
  const emailData = loadEmails(session);
  return emailData.inbox.find(e => e.id === emailId);
}

/**
 * Format email list for display
 */
function formatEmailList(emails) {
  if (emails.length === 0) {
    return '  No emails.';
  }

  return emails.map((e, i) => {
    const unread = e.read ? ' ' : '*';
    const date = new Date(e.timestamp).toLocaleDateString();
    return `${unread} ${i + 1}. [${date}] ${e.from.name}: ${e.subject}`;
  }).join('\n');
}

/**
 * Format full email for reading
 */
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

/**
 * Load an email template
 */
function loadEmailTemplate(templateId) {
  const templatePath = path.join(__dirname, '../data/emails/templates', `${templateId}.json`);
  if (!fs.existsSync(templatePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(templatePath, 'utf8'));
}

/**
 * Send email from a template
 */
function sendEmailFromTemplate(session, templateId, npc) {
  const template = loadEmailTemplate(templateId);
  if (!template) {
    console.warn(`Email template not found: ${templateId}`);
    return null;
  }

  return sendEmail(session, {
    from: npc,
    subject: template.subject,
    body: template.body,
    attachments: template.attachments || [],
    priority: template.priority || 'normal',
    tags: template.tags || []
  });
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
  formatEmailFull,
  loadEmailTemplate,
  sendEmailFromTemplate
};
