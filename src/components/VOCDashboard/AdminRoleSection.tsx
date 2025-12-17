import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Circle, MoreHorizontal, Plus, Trash2, Power, Users } from "lucide-react";
import { toast } from "sonner";
import { getAdminList, saveAdminList, AdminUser } from "@/lib/admin-storage";

interface Admin {
  id: string;
  name: string;
  whatsapp: string;
  telegram: string;
  position: string;
  assignedChats: number;
  status: "Standby" | "Break" | "Off";
  isSuperAdmin?: boolean;
}

const COUNTRY_CODES = [
  { code: "+62", country: "Indonesia" },
  { code: "+60", country: "Malaysia" },
  { code: "+65", country: "Singapore" },
  { code: "+66", country: "Thailand" },
  { code: "+855", country: "Cambodia" },
] as const;

const POSITION_OPTIONS = ["Super Admin", "Leader", "Customer Services", "Captain", "Joker"] as const;
const STATUS_OPTIONS: Admin["status"][] = ["Standby", "Break", "Off"];

// Super Admin ID - cannot be deleted
const SUPER_ADMIN_ID = "VOC001";

const sampleAdmins: Admin[] = [
  {
    id: "VOC001",
    name: "Ahmad Yusuf",
    whatsapp: "+62 8123456789",
    telegram: "@ahmad_yusuf",
    position: "Super Admin",
    assignedChats: 15,
    status: "Standby",
    isSuperAdmin: true,
  },
  {
    id: "ADM002",
    name: "Siti Nurhaliza",
    whatsapp: "+62 8134567890",
    telegram: "@siti_nur",
    position: "Customer Services",
    assignedChats: 8,
    status: "Break",
    isSuperAdmin: false,
  },
];

export function AdminRoleSection() {
  const [admins, setAdmins] = useState<Admin[]>(sampleAdmins);

  // Sync admins to localStorage for use in other components
  useEffect(() => {
    const adminUsers: AdminUser[] = admins.map(a => ({
      id: a.id,
      name: a.name,
      telegram: a.telegram,
      position: a.position,
    }));
    saveAdminList(adminUsers);
  }, [admins]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newAdmin, setNewAdmin] = useState({
    name: "",
    countryCode: "+62",
    phoneNumber: "",
    telegram: "",
    position: "",
  });

  const handleAddAdmin = () => {
    if (!newAdmin.name || !newAdmin.position) {
      toast.error("Lengkapi semua field wajib");
      return;
    }

    // Validate phone number if provided
    if (newAdmin.phoneNumber && !/^\d{8,15}$/.test(newAdmin.phoneNumber)) {
      toast.error("Nomor telepon tidak valid (hanya angka, min 8 digit)");
      return;
    }

    // Validate telegram if provided
    if (newAdmin.telegram && !newAdmin.telegram.startsWith("@")) {
      toast.error("Username Telegram harus diawali dengan @");
      return;
    }

    const whatsapp = newAdmin.phoneNumber 
      ? `${newAdmin.countryCode} ${newAdmin.phoneNumber}` 
      : "";

    const admin: Admin = {
      id: `ADM${String(admins.length + 1).padStart(3, "0")}`,
      name: newAdmin.name,
      whatsapp,
      telegram: newAdmin.telegram,
      position: newAdmin.position,
      assignedChats: 0,
      status: "Standby",
    };

    setAdmins([...admins, admin]);
    setNewAdmin({ name: "", countryCode: "+62", phoneNumber: "", telegram: "", position: "" });
    setIsDialogOpen(false);
    toast.success("Admin berhasil ditambahkan!");
  };

  const handleStatusChange = (adminId: string, newStatus: Admin["status"]) => {
    setAdmins(admins.map(admin => 
      admin.id === adminId ? { ...admin, status: newStatus } : admin
    ));
    toast.success(`Status berhasil diubah ke ${newStatus}`);
  };

  const handleDeleteAdmin = (adminId: string) => {
    const admin = admins.find(a => a.id === adminId);
    if (admin?.isSuperAdmin) {
      toast.error("Super Admin tidak dapat dihapus");
      return;
    }
    setAdmins(admins.filter(admin => admin.id !== adminId));
    toast.success("Admin berhasil dihapus");
  };

  return (
    <div className="page-wrapper">
      <div className="space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-button-hover/20 flex items-center justify-center">
            <Users className="h-6 w-6 text-button-hover" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-button-hover">Admin Role Management</h2>
            <p className="text-sm text-muted-foreground">
              Kelola admin dan role dalam sistem
            </p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="h-11 px-6 rounded-full border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover">
              <Plus className="h-4 w-4 mr-2" />
              Tambah Admin
            </Button>
          </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tambah Admin Baru</DialogTitle>
                <DialogDescription>
                  Masukkan data admin yang akan ditambahkan
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>Nama</Label>
                  <Input
                    value={newAdmin.name}
                    onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                    placeholder="Nama lengkap"
                  />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Label>WhatsApp</Label>
                  <div className="flex gap-2">
                    <Select
                      value={newAdmin.countryCode}
                      onValueChange={(v) => setNewAdmin({ ...newAdmin, countryCode: v })}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue>
                          {COUNTRY_CODES.find(c => c.code === newAdmin.countryCode)?.code} ({COUNTRY_CODES.find(c => c.code === newAdmin.countryCode)?.country})
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {COUNTRY_CODES.map((cc) => (
                          <SelectItem key={cc.code} value={cc.code}>
                            {cc.code} ({cc.country})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={newAdmin.phoneNumber}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        setNewAdmin({ ...newAdmin, phoneNumber: val });
                      }}
                      placeholder="8123456789"
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Telegram</Label>
                  <Input
                    value={newAdmin.telegram}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (val && !val.startsWith("@")) val = "@" + val;
                      setNewAdmin({ ...newAdmin, telegram: val });
                    }}
                    placeholder="@username"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Position</Label>
                  <Select
                    value={newAdmin.position}
                    onValueChange={(v) => setNewAdmin({ ...newAdmin, position: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih posisi" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {POSITION_OPTIONS.map((pos) => (
                        <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover">Batal</Button>
                <Button variant="outline" onClick={handleAddAdmin} className="border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover">
                  Tambah
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              <TableHead className="w-[100px]">ID</TableHead>
              <TableHead className="w-[200px]">Admin</TableHead>
              <TableHead className="w-[140px]">WhatsApp</TableHead>
              <TableHead className="w-[120px]">Telegram</TableHead>
              <TableHead className="w-[150px]">Position</TableHead>
              <TableHead className="w-[130px] text-center">Assigned Chats</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.map((admin) => (
              <TableRow key={admin.id} className="hover:bg-card">
                <TableCell className="text-sm w-[100px]">{admin.id}</TableCell>
                <TableCell className="w-[200px]">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-button-hover/20 text-button-hover">
                        {admin.name.split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="font-medium">{admin.name}</div>
                  </div>
                </TableCell>
                <TableCell className="text-sm w-[140px]">{admin.whatsapp || "-"}</TableCell>
                <TableCell className="text-sm w-[120px]">{admin.telegram || "-"}</TableCell>
                <TableCell className="w-[150px]">
                  <Badge 
                    variant="outline" 
                    className={admin.isSuperAdmin 
                      ? "bg-purple-500/10 text-purple-400 border-purple-500/30" 
                      : "bg-button-hover/10 text-button-hover border-button-hover/30"
                    }
                  >
                    {admin.position}
                  </Badge>
                </TableCell>
                <TableCell className="text-center w-[130px]">{admin.assignedChats}</TableCell>
                <TableCell className="w-[120px]">
                  {admin.status === "Standby" ? (
                    <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Standby
                    </Badge>
                  ) : admin.status === "Break" ? (
                    <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                      <Circle className="h-3 w-3 mr-1" />
                      Break
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-muted-foreground/10 text-muted-foreground border-muted-foreground/30">
                      <Power className="h-3 w-3 mr-1" />
                      Off
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                      {STATUS_OPTIONS.filter(s => s !== admin.status).map((status) => (
                        <DropdownMenuItem 
                          key={status}
                          onClick={() => handleStatusChange(admin.id, status)}
                          className="cursor-pointer gap-3 py-2.5"
                        >
                          <span className={`h-6 w-6 rounded-full flex items-center justify-center ${
                            status === "Standby" ? "bg-success/20" : 
                            status === "Break" ? "bg-warning/20" : "bg-muted"
                          }`}>
                            {status === "Standby" && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
                            {status === "Break" && <Circle className="h-3.5 w-3.5 text-warning" />}
                            {status === "Off" && <Power className="h-3.5 w-3.5 text-muted-foreground" />}
                          </span>
                          Set {status}
                        </DropdownMenuItem>
                      ))}
                      {!admin.isSuperAdmin && (
                        <>
                          <DropdownMenuSeparator className="bg-border" />
                          <DropdownMenuItem 
                            onClick={() => handleDeleteAdmin(admin.id)}
                            className="cursor-pointer gap-3 py-2.5 text-destructive focus:text-destructive"
                          >
                            <span className="h-6 w-6 rounded-full bg-destructive/20 flex items-center justify-center">
                              <Trash2 className="h-3.5 w-3.5" />
                            </span>
                            Hapus Admin
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </div>
    </div>
  );
}
