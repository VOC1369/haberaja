import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ShieldCheck,
  User as UserIcon,
  Mail,
  KeyRound,
  Pencil,
  Save,
  X,
  Eye,
  EyeOff,
  Phone,
  Briefcase,
  Crown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/notify";

interface AccountSectionProps {
  form?: unknown;
  onSave?: () => void;
}

interface LocalProfile {
  fullName: string;
  whatsapp: string;
  position: string;
}

const STORAGE_PREFIX = "voc_account_profile:";

const profileSchema = z.object({
  fullName: z.string().trim().max(100, "Maks 100 karakter"),
  whatsapp: z
    .string()
    .trim()
    .max(20, "Maks 20 karakter")
    .regex(/^(\+?\d[\d\s-]*)?$/, "Format nomor tidak valid")
    .or(z.literal("")),
  position: z.string().trim().max(80, "Maks 80 karakter"),
});

const passwordSchema = z
  .object({
    pwd: z.string().min(6, "Minimal 6 karakter").max(128, "Maks 128 karakter"),
    confirm: z.string().min(6, "Minimal 6 karakter").max(128, "Maks 128 karakter"),
  })
  .refine((d) => d.pwd === d.confirm, { message: "Konfirmasi tidak cocok", path: ["confirm"] });

function readLocal(userId: string): LocalProfile {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + userId);
    if (!raw) return { fullName: "", whatsapp: "", position: "" };
    const parsed = JSON.parse(raw);
    return {
      fullName: typeof parsed.fullName === "string" ? parsed.fullName : "",
      whatsapp: typeof parsed.whatsapp === "string" ? parsed.whatsapp : "",
      position: typeof parsed.position === "string" ? parsed.position : "",
    };
  } catch {
    return { fullName: "", whatsapp: "", position: "" };
  }
}

function writeLocal(userId: string, profile: LocalProfile) {
  localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(profile));
}

function deriveInitials(name: string, email: string): string {
  const src = (name || email || "U").trim();
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  return (
    parts.slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("") || "U"
  );
}

export function AccountSection(_props: AccountSectionProps) {
  const [userId, setUserId] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [profile, setProfile] = useState<LocalProfile>({ fullName: "", whatsapp: "", position: "" });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<LocalProfile>(profile);
  const [errors, setErrors] = useState<Partial<Record<keyof LocalProfile, string>>>({});

  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);
  const [pwErrors, setPwErrors] = useState<{ pwd?: string; confirm?: string }>({});
  const [pwSaving, setPwSaving] = useState(false);

  // Load auth + local profile
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      const u = data.user;
      const id = u?.id ?? "";
      const mail = u?.email ?? "";
      setUserId(id);
      setEmail(mail);
      if (id) {
        const local = readLocal(id);
        setProfile(local);
        setDraft(local);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const initials = deriveInitials(profile.fullName, email);
  const displayName = profile.fullName || (email ? email.split("@")[0] : "User");
  const isSuperAdmin = email.toLowerCase() === "vaultofcodex@gmail.com";

  const handleEdit = () => {
    setDraft(profile);
    setErrors({});
    setEditing(true);
  };

  const handleCancel = () => {
    setDraft(profile);
    setErrors({});
    setEditing(false);
  };

  const handleSaveProfile = () => {
    const result = profileSchema.safeParse(draft);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof LocalProfile, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof LocalProfile;
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    if (!userId) {
      toast.error("Sesi tidak ditemukan", { description: "Silakan login ulang." });
      return;
    }
    const clean: LocalProfile = {
      fullName: result.data.fullName ?? "",
      whatsapp: result.data.whatsapp ?? "",
      position: result.data.position ?? "",
    };
    writeLocal(userId, clean);
    setProfile(clean);
    setEditing(false);
    setErrors({});
    toast.success("Profil tersimpan");
  };

  const handleChangePassword = async () => {
    const result = passwordSchema.safeParse({ pwd: pw, confirm: pwConfirm });
    if (!result.success) {
      const fieldErrors: { pwd?: string; confirm?: string } = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as "pwd" | "confirm";
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setPwErrors(fieldErrors);
      return;
    }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: result.data.pwd });
    setPwSaving(false);
    if (error) {
      toast.error("Gagal ganti password", { description: error.message });
      return;
    }
    toast.success("Password berhasil diganti");
    setPw("");
    setPwConfirm("");
    setPwErrors({});
    setPwOpen(false);
  };

  return (
    <div className="page-wrapper">
      <Card className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-button-hover" />
            <div>
              <h3 className="text-lg font-semibold text-button-hover">Profil Akun</h3>
              <p className="text-sm text-muted-foreground">
                Kelola informasi profil dan keamanan akun Anda
              </p>
            </div>
          </div>
          {!editing ? (
            <Button variant="outline" size="sm" onClick={handleEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          ) : null}
        </div>

        {/* Identity card */}
        <div className="rounded-lg border border-border bg-muted/30 p-4 mb-6 flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-button-hover text-button-hover-foreground font-semibold text-lg">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-semibold text-foreground truncate">
                {displayName}
              </span>
              {isSuperAdmin ? (
                <Badge className="border-0 bg-button-hover/15 text-button-hover gap-1 hover:bg-button-hover/15">
                  <Crown className="h-3 w-3" />
                  The Creator
                </Badge>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground truncate">{email || "—"}</p>
            {isSuperAdmin ? (
              <p className="text-xs text-muted-foreground mt-0.5">Akses penuh ke semua fitur</p>
            ) : null}
          </div>
        </div>

        {/* Profile fields */}
        {!editing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mb-6">
            <FieldDisplay icon={UserIcon} label="Nama Lengkap" value={profile.fullName || "—"} />
            <FieldDisplay icon={Mail} label="Email" value={email || "—"} />
            <FieldDisplay icon={Phone} label="No Whatsapp" value={profile.whatsapp || "—"} />
            <FieldDisplay icon={Briefcase} label="Jabatan" value={profile.position || "—"} />
          </div>
        ) : (
          <div className="space-y-4 mb-6">
            <FieldEdit
              icon={UserIcon}
              label="Nama Lengkap"
              value={draft.fullName}
              onChange={(v) => setDraft({ ...draft, fullName: v })}
              placeholder="Masukkan nama lengkap"
              error={errors.fullName}
              maxLength={100}
            />
            <div>
              <Label className="flex items-center gap-2 text-sm mb-1.5">
                <Mail className="h-4 w-4" />
                Email
              </Label>
              <Input value={email} disabled readOnly />
              <p className="text-xs text-muted-foreground mt-1">Email tidak dapat diubah</p>
            </div>
            <FieldEdit
              icon={Phone}
              label="No Whatsapp"
              value={draft.whatsapp}
              onChange={(v) => setDraft({ ...draft, whatsapp: v })}
              placeholder="Contoh: +62812345678"
              error={errors.whatsapp}
              maxLength={20}
            />
            <FieldEdit
              icon={Briefcase}
              label="Jabatan"
              value={draft.position}
              onChange={(v) => setDraft({ ...draft, position: v })}
              placeholder="Contoh: Admin, CS, Manager"
              error={errors.position}
              maxLength={80}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleCancel}>
                <X className="h-4 w-4 mr-2" />
                Batal
              </Button>
              <Button
                onClick={handleSaveProfile}
                className="bg-button-hover text-button-hover-foreground hover:bg-button-hover/90"
              >
                <Save className="h-4 w-4 mr-2" />
                Simpan
              </Button>
            </div>
          </div>
        )}

        {/* Password section */}
        <div className="border-t border-border pt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <KeyRound className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-foreground">Password</p>
              <p className="text-xs text-muted-foreground">Ganti password Anda secara berkala</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setPwOpen(true)}>
            <KeyRound className="h-4 w-4 mr-2" />
            Ganti Password
          </Button>
        </div>
      </Card>

      {/* Change password dialog */}
      <Dialog open={pwOpen} onOpenChange={(open) => {
        setPwOpen(open);
        if (!open) {
          setPw("");
          setPwConfirm("");
          setPwErrors({});
          setShowPw(false);
          setShowPwConfirm(false);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-button-hover" />
              Ganti Password
            </DialogTitle>
            <DialogDescription>
              Masukkan password baru Anda (minimal 6 karakter)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-sm mb-1.5 block">Password Baru</Label>
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  maxLength={128}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="toggle password"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {pwErrors.pwd ? (
                <p className="text-xs text-destructive mt-1">{pwErrors.pwd}</p>
              ) : null}
            </div>

            <div>
              <Label className="text-sm mb-1.5 block">Konfirmasi Password Baru</Label>
              <div className="relative">
                <Input
                  type={showPwConfirm ? "text" : "password"}
                  value={pwConfirm}
                  onChange={(e) => setPwConfirm(e.target.value)}
                  maxLength={128}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwConfirm((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="toggle confirm password"
                >
                  {showPwConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {pwErrors.confirm ? (
                <p className="text-xs text-destructive mt-1">{pwErrors.confirm}</p>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPwOpen(false)} disabled={pwSaving}>
              <X className="h-4 w-4 mr-2" />
              Batal
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={pwSaving || !pw || !pwConfirm}
              className="bg-button-hover text-button-hover-foreground hover:bg-button-hover/90"
            >
              <Save className="h-4 w-4 mr-2" />
              {pwSaving ? "Menyimpan..." : "Simpan Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FieldDisplay({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserIcon;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="text-sm font-medium text-foreground truncate">{value}</p>
    </div>
  );
}

function FieldEdit({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
  error,
  maxLength,
}: {
  icon: typeof UserIcon;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <Label className="flex items-center gap-2 text-sm mb-1.5">
        <Icon className="h-4 w-4" />
        {label}
      </Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
      />
      {error ? <p className="text-xs text-destructive mt-1">{error}</p> : null}
    </div>
  );
}
