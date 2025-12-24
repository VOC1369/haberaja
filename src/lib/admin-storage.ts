/**
 * Admin Storage Helper
 * 
 * Supabase-backed storage for admin list
 * Table: voc_admin_users
 */

import { supabase, DEFAULT_CLIENT_ID, logSupabaseError } from '@/lib/supabase-client';

export interface AdminUser {
  id: string;
  name: string;
  telegram?: string;
  position: string;
  status?: string;
  whatsapp?: string;
  assigned_chats?: number;
  is_super_admin?: boolean;
}

// Default admins for initialization
const defaultAdmins: AdminUser[] = [
  {
    id: "VOC001",
    name: "Ahmad Yusuf",
    telegram: "@ahmad_yusuf",
    position: "Super Admin",
    is_super_admin: true,
  },
  {
    id: "ADM002",
    name: "Siti Nurhaliza",
    telegram: "@siti_nur",
    position: "Customer Services",
  },
];

/**
 * Get all admins from Supabase
 */
export async function getAdminList(): Promise<AdminUser[]> {
  try {
    const { data, error } = await supabase
      .from('voc_admin_users')
      .select('*')
      .eq('client_id', DEFAULT_CLIENT_ID)
      .order('created_at', { ascending: true });

    if (error) {
      logSupabaseError('getAdminList', error);
      return defaultAdmins;
    }

    if (!data || data.length === 0) {
      // Initialize with defaults if empty
      await initializeDefaultAdmins();
      return defaultAdmins;
    }

    return data.map(row => ({
      id: row.id,
      name: row.name,
      telegram: row.telegram,
      position: row.position,
      status: row.status,
      whatsapp: row.whatsapp,
      assigned_chats: row.assigned_chats,
      is_super_admin: row.is_super_admin,
    }));
  } catch (error) {
    logSupabaseError('getAdminList', error);
    return defaultAdmins;
  }
}

/**
 * Initialize default admins in database
 */
async function initializeDefaultAdmins(): Promise<void> {
  try {
    const rows = defaultAdmins.map(admin => ({
      id: admin.id,
      client_id: DEFAULT_CLIENT_ID,
      name: admin.name,
      telegram: admin.telegram,
      position: admin.position,
      status: 'Standby',
      is_super_admin: admin.is_super_admin || false,
      created_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('voc_admin_users')
      .upsert(rows, { onConflict: 'id' });

    if (error) {
      logSupabaseError('initializeDefaultAdmins', error);
    } else {
      console.log('[adminStorage] Initialized default admins');
    }
  } catch (error) {
    logSupabaseError('initializeDefaultAdmins', error);
  }
}

/**
 * Save/update admin list to Supabase
 */
export async function saveAdminList(admins: AdminUser[]): Promise<void> {
  try {
    const rows = admins.map(admin => ({
      id: admin.id,
      client_id: DEFAULT_CLIENT_ID,
      name: admin.name,
      telegram: admin.telegram || null,
      position: admin.position,
      status: admin.status || 'Standby',
      whatsapp: admin.whatsapp || null,
      assigned_chats: admin.assigned_chats || 0,
      is_super_admin: admin.is_super_admin || false,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('voc_admin_users')
      .upsert(rows, { onConflict: 'id' });

    if (error) {
      logSupabaseError('saveAdminList', error);
    } else {
      console.log('[adminStorage] Saved admin list');
    }
  } catch (error) {
    logSupabaseError('saveAdminList', error);
  }
}

/**
 * Add a single admin
 */
export async function addAdmin(admin: AdminUser): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('voc_admin_users')
      .insert({
        id: admin.id,
        client_id: DEFAULT_CLIENT_ID,
        name: admin.name,
        telegram: admin.telegram || null,
        position: admin.position,
        status: admin.status || 'Standby',
        whatsapp: admin.whatsapp || null,
        assigned_chats: 0,
        is_super_admin: admin.is_super_admin || false,
        created_at: new Date().toISOString(),
      });

    if (error) {
      logSupabaseError('addAdmin', error);
      return false;
    }

    console.log('[adminStorage] Added admin:', admin.id);
    return true;
  } catch (error) {
    logSupabaseError('addAdmin', error);
    return false;
  }
}

/**
 * Update admin status
 */
export async function updateAdminStatus(id: string, status: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('voc_admin_users')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      logSupabaseError('updateAdminStatus', error);
      return false;
    }

    return true;
  } catch (error) {
    logSupabaseError('updateAdminStatus', error);
    return false;
  }
}

/**
 * Delete admin by ID
 */
export async function deleteAdmin(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('voc_admin_users')
      .delete()
      .eq('id', id);

    if (error) {
      logSupabaseError('deleteAdmin', error);
      return false;
    }

    console.log('[adminStorage] Deleted admin:', id);
    return true;
  } catch (error) {
    logSupabaseError('deleteAdmin', error);
    return false;
  }
}

/**
 * Get admin by ID
 */
export async function getAdminById(id: string): Promise<AdminUser | undefined> {
  try {
    const { data, error } = await supabase
      .from('voc_admin_users')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      if (error) logSupabaseError('getAdminById', error);
      return undefined;
    }

    return {
      id: data.id,
      name: data.name,
      telegram: data.telegram,
      position: data.position,
      status: data.status,
      whatsapp: data.whatsapp,
      assigned_chats: data.assigned_chats,
      is_super_admin: data.is_super_admin,
    };
  } catch (error) {
    logSupabaseError('getAdminById', error);
    return undefined;
  }
}

/**
 * Get admin names for dropdown selection
 */
export async function getAdminNames(): Promise<string[]> {
  const admins = await getAdminList();
  return admins.map(admin => admin.name);
}
