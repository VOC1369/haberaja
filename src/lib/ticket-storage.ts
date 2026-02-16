/**
 * Ticket Storage Bridge for Livechat Escalation
 * Creates tickets from livechat and manages status feedback
 */

import type { Ticket, TicketCategory, TicketStatus } from '@/types/ticket';

const CHAT_TICKETS_KEY = 'voc_chat_tickets';
const TICKET_STATUS_KEY = 'voc_ticket_statuses';

// Category prefix map
const CATEGORY_PREFIX: Record<TicketCategory, string> = {
  deposit: 'D',
  withdraw: 'W',
  reward: 'R',
  general: 'G',
};

function generateTicketNumber(category: TicketCategory): string {
  const prefix = CATEGORY_PREFIX[category];
  const now = new Date();
  const dateStr = now.toISOString().replace(/[-T:\.Z]/g, '').slice(0, 14);
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}${dateStr}${rand}`;
}

export function createTicketFromChat(
  category: TicketCategory,
  summary: string,
  playerId: string = 'PLAYER_LIVECHAT',
): Ticket {
  const ticket: Ticket = {
    id: `chat_${crypto.randomUUID()}`,
    ticket_number: generateTicketNumber(category),
    category,
    status: 'pending',
    user_id_player: playerId,
    user_name: 'Livechat Player',
    source: 'livechat',
    chat_summary: summary,
    admin_note: summary,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Save to localStorage
  const existing = getChatTickets();
  existing.push(ticket);
  localStorage.setItem(CHAT_TICKETS_KEY, JSON.stringify(existing));

  return ticket;
}

export function getChatTickets(): Ticket[] {
  const stored = localStorage.getItem(CHAT_TICKETS_KEY);
  return stored ? JSON.parse(stored) : [];
}

/**
 * Check if any chat tickets have been resolved (approved/declined) since last check.
 * Returns tickets whose status changed.
 */
export function getTicketUpdates(): { ticket: Ticket; newStatus: TicketStatus }[] {
  const chatTickets = getChatTickets();
  if (chatTickets.length === 0) return [];

  const storedStatuses = localStorage.getItem(TICKET_STATUS_KEY);
  const statusMap: Record<string, { status: TicketStatus }> = storedStatuses ? JSON.parse(storedStatuses) : {};

  const updates: { ticket: Ticket; newStatus: TicketStatus }[] = [];

  for (const ticket of chatTickets) {
    const stored = statusMap[ticket.id];
    if (stored && stored.status !== ticket.status && stored.status !== 'pending') {
      updates.push({ ticket, newStatus: stored.status });
    }
  }

  return updates;
}

/**
 * Build context string for injecting ticket status feedback into system prompt
 */
export function buildTicketFeedbackContext(): string | null {
  const updates = getTicketUpdates();
  if (updates.length === 0) return null;

  const lines = updates.map(u => {
    const statusLabel = u.newStatus === 'approved' ? 'DISETUJUI' : 'DITOLAK';
    return `- Ticket ${u.ticket.ticket_number} (${u.ticket.chat_summary}) telah ${statusLabel} oleh admin.`;
  });

  return `# TICKET STATUS UPDATE — INFORMASIKAN KE PLAYER
${lines.join('\n')}

Sampaikan informasi ini ke player secara natural saat mereka mengirim pesan berikutnya. Jika disetujui, kasih konfirmasi positif. Jika ditolak, jelaskan dengan empati.`;
}
