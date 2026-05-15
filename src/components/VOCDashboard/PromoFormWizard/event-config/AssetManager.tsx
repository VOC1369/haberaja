import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Image as ImageIcon } from "lucide-react";

export interface Asset {
  id: string;
  nama: string;
  tipe: string;
  versi: string;
  status: string;
  pic_approval: string;
  thumbnail?: string;
}

export interface AssetManagerData {
  assets: Asset[];
}

interface AssetManagerProps {
  data: AssetManagerData;
  onChange: (updates: Partial<AssetManagerData>) => void;
}

const ASSET_TYPES = ["Poster", "Banner", "Copy", "Video"];
const ASSET_STATUSES = ["Draft", "Approved", "Live"];

export function AssetManager({ data, onChange }: AssetManagerProps) {
  const [newAsset, setNewAsset] = useState<Partial<Asset>>({
    nama: "",
    tipe: "",
    versi: "v1",
    status: "Draft",
    pic_approval: "",
  });

  const addAsset = () => {
    if (newAsset.nama && newAsset.tipe) {
      const asset: Asset = {
        id: Date.now().toString(),
        nama: newAsset.nama || "",
        tipe: newAsset.tipe || "",
        versi: newAsset.versi || "v1",
        status: newAsset.status || "Draft",
        pic_approval: newAsset.pic_approval || "",
      };
      onChange({
        assets: [...(data.assets || []), asset],
      });
      setNewAsset({
        nama: "",
        tipe: "",
        versi: "v1",
        status: "Draft",
        pic_approval: "",
      });
    }
  };

  const removeAsset = (id: string) => {
    onChange({
      assets: (data.assets || []).filter((a) => a.id !== id),
    });
  };

  const updateAsset = (id: string, updates: Partial<Asset>) => {
    onChange({
      assets: (data.assets || []).map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Live":
        return "bg-success text-success-foreground";
      case "Approved":
        return "bg-button-hover text-button-hover-foreground";
      default:
        return "";
    }
  };

  return (
    <div className="space-y-6">
      {/* Add New Asset Form */}
      <Card className="p-6 bg-card border-border">
        <h4 className="text-sm font-semibold text-foreground mb-4">
          Tambah Asset Baru
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="space-y-2">
            <Label className="text-sm">Nama Asset</Label>
            <Input
              value={newAsset.nama}
              onChange={(e) =>
                setNewAsset({ ...newAsset, nama: e.target.value })
              }
              placeholder="Nama asset"
              className="bg-muted"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Tipe</Label>
            <Select
              value={newAsset.tipe}
              onValueChange={(value) =>
                setNewAsset({ ...newAsset, tipe: value })
              }
            >
              <SelectTrigger className="bg-muted">
                <SelectValue placeholder="Pilih tipe" />
              </SelectTrigger>
              <SelectContent>
                {ASSET_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Versi</Label>
            <Input
              value={newAsset.versi}
              onChange={(e) =>
                setNewAsset({ ...newAsset, versi: e.target.value })
              }
              placeholder="v1"
              className="bg-muted"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">PIC Approval</Label>
            <Input
              value={newAsset.pic_approval}
              onChange={(e) =>
                setNewAsset({ ...newAsset, pic_approval: e.target.value })
              }
              placeholder="Nama PIC"
              className="bg-muted"
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="golden"
              onClick={addAsset}
              className="w-full rounded-lg"
            >
              <Plus className="h-4 w-4 mr-2" />
              Tambah
            </Button>
          </div>
        </div>
      </Card>

      {/* Asset Table */}
      {(data.assets || []).length > 0 ? (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-card hover:bg-card">
                <TableHead className="w-12"></TableHead>
                <TableHead>Nama Asset</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Versi</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>PIC Approval</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.assets || []).map((asset) => (
                <TableRow key={asset.id} className="hover:bg-muted">
                  <TableCell>
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{asset.nama}</TableCell>
                  <TableCell>{asset.tipe}</TableCell>
                  <TableCell>{asset.versi}</TableCell>
                  <TableCell>
                    <Select
                      value={asset.status}
                      onValueChange={(value) =>
                        updateAsset(asset.id, { status: value })
                      }
                    >
                      <SelectTrigger className="w-28 h-8">
                        <Badge
                          variant="secondary"
                          className={getStatusColor(asset.status)}
                        >
                          {asset.status}
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        {ASSET_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{asset.pic_approval}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeAsset(asset.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Card className="p-8 bg-card border-border">
          <div className="text-center text-muted-foreground">
            <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Belum ada asset. Tambahkan asset pertama.</p>
          </div>
        </Card>
      )}
    </div>
  );
}
