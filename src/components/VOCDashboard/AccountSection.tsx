import { UseFormReturn } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Save, User } from "lucide-react";
import { toast } from "sonner";

interface AccountSectionProps {
  form: UseFormReturn<any>;
  onSave: () => void;
}

export function AccountSection({ form, onSave }: AccountSectionProps) {
  const handleSave = () => {
    onSave();
    toast.success("Account settings saved!");
  };

  return (
    <div className="max-w-7xl mx-auto">
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <User className="h-6 w-6 text-button-hover" />
          <div>
            <h3 className="text-lg font-semibold text-button-hover">Account Settings</h3>
            <p className="text-sm text-muted-foreground">
              Kelola informasi akun Anda
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <FormField
            control={form.control}
            name="account.userName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nama User</FormLabel>
                <FormControl>
                  <Input placeholder="Masukkan nama user" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="account.whatsappNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>No Whatsapp User</FormLabel>
                <FormControl>
                  <Input placeholder="Contoh: +62812345678" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="account.email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email User</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="Contoh: user@email.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="account.position"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Jabatan User</FormLabel>
                <FormControl>
                  <Input placeholder="Contoh: Admin, CS, Manager" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="outline" onClick={handleSave} className="border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover">
            <Save className="h-4 w-4 mr-2" />
            Save Account
          </Button>
        </div>
      </Card>
    </div>
  );
}
