/**
 * Admin Storage Helper — localStorage Mode
 * 
 * All data stored in localStorage under key: voc_admin_users
 */

const STORAGE_KEY = 'voc_admin_users';

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

function readAll(): AdminUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AdminUser[];
  } catch {
    return [];
  }
}

function writeAll(admins: AdminUser[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(admins));
}

export async function getAdminList(): Promise<AdminUser[]> {
  const admins = readAll();
  if (admins.length === 0) {
    writeAll(defaultAdmins);
    return defaultAdmins;
  }
  return admins;
}

export async function saveAdminList(admins: AdminUser[]): Promise<void> {
  writeAll(admins);
  console.log('[adminStorage] Saved admin list (local)');
}

export async function addAdmin(admin: AdminUser): Promise<boolean> {
  const admins = readAll();
  admins.push(admin);
  writeAll(admins);
  console.log('[adminStorage] Added admin (local):', admin.id);
  return true;
}

export async function updateAdminStatus(id: string, status: string): Promise<boolean> {
  const admins = readAll();
  const idx = admins.findIndex(a => a.id === id);
  if (idx === -1) return false;
  admins[idx].status = status;
  writeAll(admins);
  return true;
}

export async function deleteAdmin(id: string): Promise<boolean> {
  const admins = readAll().filter(a => a.id !== id);
  writeAll(admins);
  console.log('[adminStorage] Deleted admin (local):', id);
  return true;
}

export async function getAdminById(id: string): Promise<AdminUser | undefined> {
  return readAll().find(a => a.id === id);
}

export async function getAdminNames(): Promise<string[]> {
  const admins = await getAdminList();
  return admins.map(a => a.name);
}
