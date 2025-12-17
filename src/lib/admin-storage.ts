/**
 * Admin Storage Helper
 * Manages admin list in localStorage for use across components
 */

export interface AdminUser {
  id: string;
  name: string;
  telegram?: string;
  position: string;
}

const ADMIN_STORAGE_KEY = "voc_admin_list";

// Default admins
const defaultAdmins: AdminUser[] = [
  {
    id: "VOC001",
    name: "Ahmad Yusuf",
    telegram: "@ahmad_yusuf",
    position: "Super Admin",
  },
  {
    id: "ADM002",
    name: "Siti Nurhaliza",
    telegram: "@siti_nur",
    position: "Customer Services",
  },
];

/**
 * Get all admins from localStorage
 */
export function getAdminList(): AdminUser[] {
  try {
    const stored = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    // Initialize with defaults if empty
    saveAdminList(defaultAdmins);
    return defaultAdmins;
  } catch {
    return defaultAdmins;
  }
}

/**
 * Save admin list to localStorage
 */
export function saveAdminList(admins: AdminUser[]): void {
  try {
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(admins));
  } catch (error) {
    console.error("Failed to save admin list:", error);
  }
}

/**
 * Get admin by ID
 */
export function getAdminById(id: string): AdminUser | undefined {
  const admins = getAdminList();
  return admins.find(admin => admin.id === id);
}

/**
 * Get admin names for dropdown selection
 */
export function getAdminNames(): string[] {
  const admins = getAdminList();
  return admins.map(admin => admin.name);
}
