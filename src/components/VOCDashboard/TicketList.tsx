import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileText, DollarSign, Banknote, Gift, Search, Clock, CheckCircle, XCircle, Filter, User, Calendar, CreditCard, MessageSquare } from "lucide-react";
import { Ticket, TicketStatus, TicketCategory, statusLabels, categoryLabels } from "@/types/ticket";
import { PromoItem, getPromoDrafts } from "./PromoFormWizard/types";
import { useToast } from "@/hooks/use-toast";

// LocalStorage key for ticket status updates
const TICKET_STATUS_KEY = "voc_ticket_statuses";

interface TicketListProps {
  category: TicketCategory;
}

// Base mock tickets without reward tickets - reward tickets will be generated dynamically
const baseMockTickets: Ticket[] = [
  {
    id: "1",
    ticket_number: "D202511260001",
    category: "deposit",
    status: "pending",
    user_id_player: "PLAYER001",
    user_name: "Ahmad Yusuf",
    amount: 500000,
    bank_destination: "BCA",
    sender_name: "Ahmad Yusuf",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "2",
    ticket_number: "W202511260002",
    category: "withdraw",
    status: "approved",
    user_id_player: "PLAYER002",
    user_name: "Siti Nurhaliza",
    amount: 1000000,
    bank_destination: "Mandiri",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "3",
    ticket_number: "G202511260003",
    category: "general",
    status: "declined",
    user_id_player: "PLAYER003",
    user_name: "Budi Santoso",
    admin_note: "Keluhan tentang loading lambat",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Generate sample reward tickets linked to actual promos
function generateRewardTickets(promos: PromoItem[]): Ticket[] {
  if (promos.length === 0) return [];
  
  const players = [
    { id: "PLAYER004", name: "Dewi Lestari" },
    { id: "PLAYER005", name: "Eko Prasetyo" },
    { id: "PLAYER006", name: "Fitri Handayani" },
  ];
  const statuses: TicketStatus[] = ["pending", "approved", "declined"];
  
  return promos.slice(0, 3).map((promo, index) => ({
    id: `reward_${index + 4}`,
    ticket_number: `R20251126000${index + 4}`,
    category: "reward" as TicketCategory,
    status: statuses[index % 3],
    user_id_player: players[index % 3].id,
    user_name: players[index % 3].name,
    promo_id: promo.id,
    admin_note: `Klaim promo ${promo.promo_name}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
}

// Helper functions for localStorage ticket status management
function getStoredTicketStatuses(): Record<string, { status: TicketStatus; updated_at: string }> {
  const stored = localStorage.getItem(TICKET_STATUS_KEY);
  return stored ? JSON.parse(stored) : {};
}

function saveTicketStatus(ticketId: string, status: TicketStatus) {
  const statuses = getStoredTicketStatuses();
  statuses[ticketId] = { status, updated_at: new Date().toISOString() };
  localStorage.setItem(TICKET_STATUS_KEY, JSON.stringify(statuses));
}

export function TicketList({ category }: TicketListProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [promoFilter, setPromoFilter] = useState<string>("all");
  const [promos, setPromos] = useState<PromoItem[]>([]);
  const [rewardTickets, setRewardTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [ticketStatuses, setTicketStatuses] = useState<Record<string, { status: TicketStatus; updated_at: string }>>({});

  const handleOpenDetail = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setIsDetailOpen(true);
  };

  const handleUpdateStatus = (ticketId: string, newStatus: TicketStatus) => {
    saveTicketStatus(ticketId, newStatus);
    setTicketStatuses(getStoredTicketStatuses());
    
    // Update selected ticket if it's the one being changed
    if (selectedTicket && selectedTicket.id === ticketId) {
      setSelectedTicket({
        ...selectedTicket,
        status: newStatus,
        updated_at: new Date().toISOString()
      });
    }
    
    toast({
      title: newStatus === "approved" ? "Ticket Disetujui" : "Ticket Ditolak",
      description: `Status ticket berhasil diubah menjadi ${statusLabels[newStatus]}`,
    });
    
    setIsDetailOpen(false);
  };

  // Load promos and ticket statuses from Supabase
  useEffect(() => {
    const loadData = async () => {
      const loadedPromos = await getPromoDrafts();
      setPromos(loadedPromos);
      setRewardTickets(generateRewardTickets(loadedPromos));
      setTicketStatuses(getStoredTicketStatuses());
    };
    loadData();
  }, []);

  // Combine base tickets with dynamically generated reward tickets and apply stored statuses
  const allTickets = [...baseMockTickets, ...rewardTickets].map(ticket => {
    const storedStatus = ticketStatuses[ticket.id];
    if (storedStatus) {
      return { ...ticket, status: storedStatus.status, updated_at: storedStatus.updated_at };
    }
    return ticket;
  });

  const filteredTickets = allTickets.filter(ticket => {
    const matchCategory = category === "general" || ticket.category === category;
    const matchStatus = statusFilter === "all" || ticket.status === statusFilter;
    const matchPromo = category !== "reward" || promoFilter === "all" || ticket.promo_id === promoFilter;
    const matchSearch = ticket.ticket_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.user_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchStatus && matchPromo && matchSearch;
  });

  // Get promo name by ID
  const getPromoName = (promoId?: string) => {
    if (!promoId) return "-";
    const promo = promos.find(p => p.id === promoId);
    return promo?.promo_name || "-";
  };

  const getStatusBadge = (status: TicketStatus) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30"><Clock className="h-3 w-3 mr-1" />{statusLabels[status]}</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-success/10 text-success border-success/30"><CheckCircle className="h-3 w-3 mr-1" />{statusLabels[status]}</Badge>;
      case "declined":
        return <Badge variant="outline" className="bg-declined/10 text-declined border-declined/30"><XCircle className="h-3 w-3 mr-1" />{statusLabels[status]}</Badge>;
    }
  };

  const getCategoryIcon = (cat: TicketCategory) => {
    switch (cat) {
      case "general": return FileText;
      case "deposit": return DollarSign;
      case "withdraw": return Banknote;
      case "reward": return Gift;
    }
  };

  const CategoryIcon = getCategoryIcon(category);

  return (
    <div className="page-wrapper">
      <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-button-hover/20 flex items-center justify-center">
            <CategoryIcon className="h-6 w-6 text-button-hover" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-button-hover">{categoryLabels[category]} Tickets</h3>
            <p className="text-sm text-muted-foreground">
              Kelola tiket {categoryLabels[category].toLowerCase()}
            </p>
          </div>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari ticket..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-11"
          />
        </div>
      </div>

      <div className="-mt-4 flex items-center gap-4">
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as TicketStatus | "all")}>
          <TabsList>
            <TabsTrigger value="all">Semua</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="declined">Declined</TabsTrigger>
          </TabsList>
        </Tabs>

        {category === "reward" && (
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={promoFilter} onValueChange={setPromoFilter}>
              <SelectTrigger className="w-[220px] h-10 rounded-full border-border">
                <SelectValue placeholder="Filter Promo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Promo</SelectItem>
                {promos.length > 0 ? (
                  promos.map((promo) => (
                    <SelectItem key={promo.id} value={promo.id}>
                      {promo.promo_name || "Untitled Promo"}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-promo" disabled>
                    Belum ada promo
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              <TableHead className="w-[160px]">Ticket No</TableHead>
              <TableHead className="w-[200px]">Player</TableHead>
              {category === "reward" && <TableHead className="w-[180px]">Promo</TableHead>}
              {category !== "reward" && <TableHead className="w-[130px]">Category</TableHead>}
              {(category === "deposit" || category === "withdraw") && <TableHead className="w-[150px]">Amount</TableHead>}
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[130px]">Tanggal</TableHead>
              <TableHead className="w-[100px]">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTickets.map((ticket) => {
              const Icon = getCategoryIcon(ticket.category);
              return (
                <TableRow key={ticket.id} className="hover:bg-card">
                  <TableCell className="text-sm w-[160px]">{ticket.ticket_number}</TableCell>
                  <TableCell className="w-[200px]">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-button-hover/20 text-button-hover">
                          {ticket.user_name?.split(" ").map(n => n[0]).join("") || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{ticket.user_name}</div>
                        <div className="text-xs text-muted-foreground/50 mt-1">{ticket.user_id_player}</div>
                      </div>
                    </div>
                  </TableCell>
                  {category === "reward" && (
                    <TableCell className="text-sm w-[180px]">
                      <Badge variant="outline" className="bg-button-hover/10 text-button-hover border-button-hover/30">
                        {getPromoName(ticket.promo_id)}
                      </Badge>
                    </TableCell>
                  )}
                  {category !== "reward" && (
                    <TableCell className="text-sm w-[130px]">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        {categoryLabels[ticket.category]}
                      </div>
                    </TableCell>
                  )}
                  {(category === "deposit" || category === "withdraw") && (
                    <TableCell className="text-sm w-[150px]">
                      {ticket.amount ? `Rp ${ticket.amount.toLocaleString()}` : "-"}
                    </TableCell>
                  )}
                  <TableCell className="w-[120px]">{getStatusBadge(ticket.status)}</TableCell>
                  <TableCell className="text-sm w-[130px]">
                    {new Date(ticket.created_at).toLocaleDateString("id-ID")}
                  </TableCell>
                  <TableCell className="w-[100px]">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleOpenDetail(ticket)}
                      className="h-9 px-4 rounded-full border-border text-muted-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover"
                    >
                      Detail
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {filteredTickets.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Tidak ada ticket ditemukan
          </div>
        )}
      </div>

      {/* Ticket Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-button-hover">
              {selectedTicket && (() => {
                const Icon = getCategoryIcon(selectedTicket.category);
                return <Icon className="h-5 w-5" />;
              })()}
              Detail Ticket
            </DialogTitle>
          </DialogHeader>
          
          {selectedTicket && (
            <div className="space-y-6 pt-2">
              {/* Ticket Number & Status */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Nomor Ticket</p>
                  <p className="font-mono text-lg font-semibold">{selectedTicket.ticket_number}</p>
                </div>
                {getStatusBadge(selectedTicket.status)}
              </div>

              {/* Player Info */}
              <div className="bg-muted rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Informasi Player</span>
                </div>
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-button-hover/20 text-button-hover font-semibold">
                      {selectedTicket.user_name?.split(" ").map(n => n[0]).join("") || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-foreground">{selectedTicket.user_name}</p>
                    <p className="text-sm text-muted-foreground">{selectedTicket.user_id_player}</p>
                  </div>
                </div>
              </div>

              {/* Category & Amount (for deposit/withdraw) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {(() => {
                      const Icon = getCategoryIcon(selectedTicket.category);
                      return <Icon className="h-4 w-4 text-muted-foreground" />;
                    })()}
                    <span className="text-sm text-muted-foreground">Kategori</span>
                  </div>
                  <p className="font-medium">{categoryLabels[selectedTicket.category]}</p>
                </div>
                
                {(selectedTicket.category === "deposit" || selectedTicket.category === "withdraw") && (
                  <div className="bg-muted rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Jumlah</span>
                    </div>
                    <p className="font-medium text-button-hover">
                      Rp {selectedTicket.amount?.toLocaleString() || "0"}
                    </p>
                  </div>
                )}

                {selectedTicket.category === "reward" && (
                  <div className="bg-muted rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Gift className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Promo</span>
                    </div>
                    <Badge variant="outline" className="bg-button-hover/10 text-button-hover border-button-hover/30">
                      {getPromoName(selectedTicket.promo_id)}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Bank Info (for deposit/withdraw) */}
              {(selectedTicket.category === "deposit" || selectedTicket.category === "withdraw") && selectedTicket.bank_destination && (
                <div className="bg-muted rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Banknote className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Bank Tujuan</span>
                  </div>
                  <p className="font-medium">{selectedTicket.bank_destination}</p>
                  {selectedTicket.sender_name && (
                    <p className="text-sm text-muted-foreground mt-1">Pengirim: {selectedTicket.sender_name}</p>
                  )}
                </div>
              )}

              {/* Admin Note */}
              {selectedTicket.admin_note && (
                <div className="bg-muted rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Catatan</span>
                  </div>
                  <p className="text-sm">{selectedTicket.admin_note}</p>
                </div>
              )}

              {/* Timestamps */}
              <div className="bg-muted rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Waktu</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Dibuat</p>
                    <p className="font-medium">{new Date(selectedTicket.created_at).toLocaleString("id-ID")}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Diperbarui</p>
                    <p className="font-medium">{new Date(selectedTicket.updated_at).toLocaleString("id-ID")}</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                {selectedTicket.status === "pending" && (
                  <>
                    <Button 
                      className="flex-1 bg-success hover:bg-success/90 text-white rounded-full"
                      onClick={() => handleUpdateStatus(selectedTicket.id, "approved")}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button 
                      variant="outline"
                      className="flex-1 border-declined text-declined hover:bg-declined hover:text-white rounded-full"
                      onClick={() => handleUpdateStatus(selectedTicket.id, "declined")}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Decline
                    </Button>
                  </>
                )}
                <Button 
                  variant="outline" 
                  onClick={() => setIsDetailOpen(false)}
                  className="flex-1 rounded-full border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover"
                >
                  Tutup
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
