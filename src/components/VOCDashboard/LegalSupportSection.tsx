import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Scale, HelpCircle, Shield, FileText, MessageCircle, Mail, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSection {
  title: string;
  icon: typeof Scale;
  items: FAQItem[];
}

const faqSections: FAQSection[] = [
  {
    title: "Kebijakan Privasi",
    icon: Shield,
    items: [
      {
        question: "Bagaimana data pengguna disimpan dan dilindungi?",
        answer: "Semua data pengguna disimpan dengan enkripsi end-to-end menggunakan standar AES-256. Data disimpan di server yang terletak di Indonesia dan memenuhi standar keamanan ISO 27001. Kami menerapkan prinsip minimal data collection - hanya mengumpulkan data yang diperlukan untuk operasional sistem."
      },
      {
        question: "Apakah data dapat dihapus sesuai permintaan pengguna?",
        answer: "Ya, sesuai dengan regulasi perlindungan data, pengguna berhak meminta penghapusan data mereka (right to be forgotten). Permintaan dapat diajukan melalui menu Account Settings atau menghubungi tim support. Proses penghapusan akan selesai dalam 30 hari kerja."
      },
      {
        question: "Bagaimana kebijakan retensi data kami?",
        answer: "Data aktif disimpan selama akun aktif. Data transaksi disimpan selama 5 tahun sesuai regulasi keuangan. Data log sistem disimpan selama 90 hari untuk keperluan troubleshooting. Setelah periode retensi, data akan dihapus secara permanen."
      },
    ]
  },
  {
    title: "Syarat & Ketentuan",
    icon: FileText,
    items: [
      {
        question: "Apa saja yang dilarang dalam penggunaan layanan?",
        answer: "Pengguna dilarang: (1) Menggunakan layanan untuk aktivitas ilegal, (2) Melakukan spam atau abuse terhadap sistem, (3) Mencoba mengakses data pengguna lain tanpa izin, (4) Memodifikasi atau reverse-engineer sistem, (5) Menjual kembali akses layanan tanpa izin tertulis."
      },
      {
        question: "Bagaimana proses dispute resolution?",
        answer: "Dispute pertama-tama akan diselesaikan melalui negosiasi internal dengan tim Customer Success. Jika tidak tercapai kesepakatan dalam 14 hari, dapat dilanjutkan ke mediasi oleh pihak ketiga yang disepakati. Arbitrase menjadi opsi terakhir dengan BANI sebagai lembaga arbitrase."
      },
      {
        question: "Apakah ada batasan penggunaan API?",
        answer: "Ya, setiap tier subscription memiliki rate limit berbeda. Free tier: 100 requests/menit. Pro tier: 1000 requests/menit. Enterprise tier: unlimited dengan fair use policy. Exceeding limits akan menghasilkan HTTP 429 response."
      },
    ]
  },
  {
    title: "Bantuan Teknis",
    icon: HelpCircle,
    items: [
      {
        question: "Bagaimana cara menghubungi tim support?",
        answer: "Tim support dapat dihubungi melalui: (1) Live Chat di dashboard - tersedia 24/7, (2) Email: support@vaultofcodex.com - response time 4-8 jam kerja, (3) Ticket system di menu Ticket - untuk issue yang memerlukan investigasi mendalam."
      },
      {
        question: "Apa saja yang termasuk dalam SLA support?",
        answer: "Critical issues (sistem down): Response time 15 menit, Resolution target 2 jam. High priority (fitur utama error): Response time 1 jam, Resolution target 8 jam. Medium priority (bug minor): Response time 4 jam, Resolution target 24 jam. Low priority (enhancement request): Response time 24 jam."
      },
      {
        question: "Bagaimana proses eskalasi jika issue tidak terselesaikan?",
        answer: "Level 1: AI Support & Frontline CS. Level 2: Technical Support Specialist (auto-escalate jika tidak resolved dalam 4 jam). Level 3: Senior Engineer (eskalasi manual atau untuk critical issues). Level 4: Engineering Lead (untuk systemic issues yang memerlukan architectural changes)."
      },
      {
        question: "Apakah tersedia dokumentasi API?",
        answer: "Ya, dokumentasi lengkap tersedia di docs.vaultofcodex.com termasuk: API Reference dengan contoh request/response, SDK documentation untuk JavaScript, Python, dan PHP, Postman collection untuk testing, serta Changelog untuk tracking perubahan API."
      },
    ]
  },
  {
    title: "Lisensi & Penggunaan",
    icon: Scale,
    items: [
      {
        question: "Tipe lisensi apa yang berlaku untuk produk ini?",
        answer: "Produk ini menggunakan lisensi SaaS (Software as a Service) subscription-based. Lisensi bersifat non-transferable dan non-exclusive. Penggunaan dibatasi sesuai tier subscription yang dipilih. Enterprise tier dapat memiliki custom license agreement."
      },
      {
        question: "Apakah boleh white-label produk ini?",
        answer: "White-labeling tersedia untuk Enterprise tier dengan addon khusus. Meliputi: custom branding, custom domain, removal of 'Powered by' badge. Diperlukan perjanjian tambahan dan biaya setup terpisah. Hubungi sales@vaultofcodex.com untuk detail."
      },
      {
        question: "Bagaimana kebijakan pembatalan subscription?",
        answer: "Subscription dapat dibatalkan kapan saja tanpa penalty. Akses akan tetap aktif hingga akhir periode billing yang sudah dibayar. Tidak ada refund untuk periode yang sudah berjalan. Data dapat di-export sebelum pembatalan melalui menu Account > Export Data."
      },
    ]
  },
];

export function LegalSupportSection() {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const toggleSection = (sectionTitle: string) => {
    setOpenSections(prev => ({
      ...prev,
      [sectionTitle]: !prev[sectionTitle]
    }));
  };

  const toggleItem = (itemKey: string) => {
    setOpenItems(prev => ({
      ...prev,
      [itemKey]: !prev[itemKey]
    }));
  };

  return (
    <div className="page-wrapper space-y-8">
      {/* Header Card */}
      <Card className="form-card">
        <div className="form-card-header">
          <div className="icon-circle">
            <Scale className="icon-circle-icon" />
          </div>
          <div>
            <h1 className="form-card-title">Legal & Support</h1>
            <p className="form-card-description">Kebijakan, syarat ketentuan, dan bantuan teknis</p>
          </div>
        </div>
      </Card>

      {/* FAQ Sections */}
      <div className="space-y-6">
        {faqSections.map((section) => {
          const SectionIcon = section.icon;
          const isSectionOpen = openSections[section.title] ?? false;

          return (
            <Card key={section.title} className="form-card overflow-hidden">
              <Collapsible open={isSectionOpen} onOpenChange={() => toggleSection(section.title)}>
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between p-6 cursor-pointer hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="icon-circle">
                        <SectionIcon className="icon-circle-icon" />
                      </div>
                      <div className="text-left">
                        <h2 className="text-lg font-semibold text-button-hover">{section.title}</h2>
                        <p className="text-sm text-muted-foreground">
                          {section.items.length} pertanyaan umum
                        </p>
                      </div>
                    </div>
                    <div className={cn(
                      "h-10 w-10 rounded-lg bg-muted flex items-center justify-center transition-transform duration-200",
                      isSectionOpen && "rotate-180"
                    )}>
                      <ChevronDown className="h-5 w-5 text-foreground" />
                    </div>
                  </div>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <div className="border-t border-border">
                    {section.items.map((item, idx) => {
                      const itemKey = `${section.title}-${idx}`;
                      const isItemOpen = openItems[itemKey] ?? false;

                      return (
                        <Collapsible key={itemKey} open={isItemOpen} onOpenChange={() => toggleItem(itemKey)}>
                          <CollapsibleTrigger className="w-full">
                            <div className={cn(
                              "flex items-center justify-between p-6 cursor-pointer hover:bg-muted/20 transition-colors",
                              idx !== section.items.length - 1 && !isItemOpen && "border-b border-border"
                            )}>
                              <span className="text-left text-foreground font-medium pr-4">{item.question}</span>
                              <div className={cn(
                                "h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0 transition-transform duration-200",
                                isItemOpen && "rotate-180"
                              )}>
                                <ChevronDown className="h-4 w-4 text-foreground" />
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className={cn(
                              "px-6 pb-6 pt-0",
                              idx !== section.items.length - 1 && "border-b border-border"
                            )}>
                              <div className="bg-muted rounded-lg p-4">
                                <p className="text-muted-foreground text-sm leading-relaxed">{item.answer}</p>
                              </div>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>

      {/* Contact Section */}
      <Card className="form-card">
        <div className="form-card-header">
          <div className="icon-circle">
            <HelpCircle className="icon-circle-icon" />
          </div>
          <div>
            <h2 className="form-card-title">Butuh Bantuan Lebih Lanjut?</h2>
            <p className="form-card-description">Tim support kami siap membantu 24/7</p>
          </div>
        </div>
        <CardContent className="form-section pt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-muted rounded-xl p-6 text-center hover:bg-muted/80 transition-colors cursor-pointer group">
              <div className="icon-circle mx-auto mb-4 group-hover:bg-button-hover/30 transition-colors">
                <MessageCircle className="icon-circle-icon" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Live Chat</h3>
              <p className="text-sm text-muted-foreground">Tersedia 24/7 di dashboard</p>
            </div>
            <div className="bg-muted rounded-xl p-6 text-center hover:bg-muted/80 transition-colors cursor-pointer group">
              <div className="icon-circle mx-auto mb-4 group-hover:bg-button-hover/30 transition-colors">
                <Mail className="icon-circle-icon" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Email</h3>
              <p className="text-sm text-muted-foreground">support@vaultofcodex.com</p>
            </div>
            <div className="bg-muted rounded-xl p-6 text-center hover:bg-muted/80 transition-colors cursor-pointer group">
              <div className="icon-circle mx-auto mb-4 group-hover:bg-button-hover/30 transition-colors">
                <Ticket className="icon-circle-icon" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Ticket</h3>
              <p className="text-sm text-muted-foreground">Menu Ticket di sidebar</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}