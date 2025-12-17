export type TicketStatus = 'pending' | 'approved' | 'declined';

export type TicketCategory = 'general' | 'deposit' | 'withdraw' | 'reward';

export type DeclineReason =
  | 'dana_belum_masuk'
  | 'nama_tidak_sesuai'
  | 'bukti_palsu'
  | 'rekening_salah'
  | 'lainnya';

// Promo ID referencing promo from Knowledge Base
// reward_type is deprecated, use promo_id instead

export interface Ticket {
  id: string;
  ticket_number: string;
  category: TicketCategory;
  status: TicketStatus;
  user_id_player: string;
  user_name?: string;
  amount?: number;
  bank_destination?: string;
  sender_name?: string;
  assigned_to?: string;
  assigned_at?: string;
  resolved_by?: string;
  resolved_at?: string;
  decline_reason?: DeclineReason;
  decline_note?: string;
  admin_note?: string;
  promo_id?: string; // Reference to promo from Knowledge Base
  created_at: string;
  updated_at: string;
  attachments?: TicketAttachment[];
}

export interface TicketAttachment {
  id: string;
  ticket_id: string;
  file_name: string;
  file_url: string;
  file_type?: string;
  uploaded_at: string;
}

export interface TicketHistory {
  id: string;
  ticket_id: string;
  action: string;
  performed_by?: string;
  old_status?: TicketStatus;
  new_status?: TicketStatus;
  notes?: string;
  created_at: string;
}

export const declineReasonLabels: Record<DeclineReason, string> = {
  dana_belum_masuk: 'Dana belum masuk',
  nama_tidak_sesuai: 'Nama pengirim tidak sesuai',
  bukti_palsu: 'Bukti transfer palsu / teredit',
  rekening_salah: 'Rekening tujuan salah',
  lainnya: 'Lainnya'
};

export const statusLabels: Record<TicketStatus, string> = {
  pending: 'Menunggu Verifikasi',
  approved: 'Disetujui',
  declined: 'Ditolak'
};

export const categoryLabels: Record<TicketCategory, string> = {
  general: 'General',
  deposit: 'Deposit',
  withdraw: 'Withdraw',
  reward: 'Claim Reward'
};
