import { useState } from "react";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Calendar,
  Target,
  Gift,
  Megaphone,
  Image,
  Shield,
  CheckSquare,
  Activity,
  FileText,
  Settings,
} from "lucide-react";

import {
  EventHeader,
  EventHeaderData,
  ObjectiveKPI,
  ObjectiveKPIData,
  RewardMechanism,
  RewardMechanismData,
  ChannelActivation,
  ChannelActivationData,
  AssetManager,
  AssetManagerData,
  RulesAntiAbuse,
  RulesAntiAbuseData,
  ExecutionChecklist,
  ExecutionChecklistData,
  LiveMonitoring,
  LiveMonitoringData,
  PostEventSummary,
  PostEventSummaryData,
} from "./event-config";
import { Step3Reward } from "./Step3Reward";
import { PromoFormData } from "./types";

export interface EventConfigData {
  header: EventHeaderData;
  objective: ObjectiveKPIData;
  reward: RewardMechanismData;
  channel: ChannelActivationData;
  asset: AssetManagerData;
  rules: RulesAntiAbuseData;
  checklist: ExecutionChecklistData;
  monitoring: LiveMonitoringData;
  summary: PostEventSummaryData;
}

const initialEventData: EventConfigData = {
  header: {
    nama_event: "",
    tipe_event: "",
    status: "draft",
    periode_start: "",
    periode_end: "",
    owner_event: "",
  },
  objective: {
    tujuan_utama: "",
    kpi_engagement_rate: "",
    kpi_ndp_harian: "",
    kpi_traffic_lift: "",
    catatan_kpi: "",
  },
  reward: {
    tipe_reward: [],
    mekanisme_distribusi: "",
    min_deposit: "",
    turnover: "",
    batas_klaim: "",
    syarat_tambahan: "",
  },
  channel: {
    channels: { telegram: false, whatsapp: false, instagram: false },
    website: { banner: false, popup: false, landing_section: false },
    ads_support: false,
    creative_code: "",
    jadwal_posting: [],
    checklist_status: {
      telegram: false,
      whatsapp: false,
      instagram: false,
      banner: false,
      popup: false,
      landing_section: false,
    },
  },
  asset: {
    assets: [],
  },
  rules: {
    max_klaim_per_user: "",
    excluded_user_types: [],
    ip_device_limitation: false,
    admin_note: "",
  },
  checklist: {
    items: [],
  },
  monitoring: {
    status_event: "",
    estimasi_partisipan: 0,
    klaim_masuk: 0,
    catatan_anomali: "",
  },
  summary: {
    kpi_tercapai: "",
    catatan_performa: "",
    masalah_abuse: "",
    rekomendasi_next: "",
  },
};

interface Step4BEventConfigProps {
  data?: EventConfigData;
  onChange?: (data: EventConfigData) => void;
  // Props for embedded Reward config (writes to formData, not eventData)
  formData?: PromoFormData;
  onFormDataChange?: (data: Partial<PromoFormData>) => void;
}

const SECTIONS = [
  {
    id: "header",
    title: "Identitas Event",
    icon: Calendar,
    description: "Context locking — prevent wrong claims",
  },
  {
    id: "reward_config",
    title: "Konfigurasi Reward",
    icon: Settings,
    description: "Mode reward: Fixed, Dinamis, atau Tier",
  },
  {
    id: "objective",
    title: "Tujuan & KPI",
    icon: Target,
    description: "Clear objectives, not just activity",
  },
  {
    id: "reward",
    title: "Reward & Mekanisme",
    icon: Gift,
    description: "Single source of truth for CS & Community",
  },
  {
    id: "channel",
    title: "Aktivasi Channel",
    icon: Megaphone,
    description: "Event without channel = dead event",
  },
  {
    id: "asset",
    title: "Asset Manager",
    icon: Image,
    description: "Control panel, not gallery",
  },
  {
    id: "rules",
    title: "Rules & Anti-Abuse",
    icon: Shield,
    description: "Crucial for iGaming compliance",
  },
  {
    id: "checklist",
    title: "Checklist Eksekusi",
    icon: CheckSquare,
    description: "Prevent chaos, prevent blame-shifting",
  },
  {
    id: "monitoring",
    title: "Monitoring",
    icon: Activity,
    description: "Simple status display",
  },
  {
    id: "summary",
    title: "Summary Post-Event",
    icon: FileText,
    description: "Learning, not showing off",
  },
];

export function Step4BEventConfig({
  data: externalData,
  onChange,
  formData,
  onFormDataChange,
}: Step4BEventConfigProps) {
  const [internalData, setInternalData] =
    useState<EventConfigData>(initialEventData);
  const data = externalData || internalData;

  const [openSections, setOpenSections] = useState<string[]>(["header"]);

  const handleUpdate = <K extends keyof EventConfigData>(
    section: K,
    updates: Partial<EventConfigData[K]>
  ) => {
    const newData = {
      ...data,
      [section]: { ...data[section], ...updates },
    };
    if (onChange) {
      onChange(newData);
    } else {
      setInternalData(newData);
    }
  };

  const handleCloneEvent = () => {
    toast.success("Event berhasil di-clone! Silakan edit data untuk event baru.");
  };

  // Sync monitoring status with header status
  const monitoringData: LiveMonitoringData = {
    ...data.monitoring,
    status_event: data.header.status === "active" ? "Live" : 
                  data.header.status === "paused" ? "Paused" :
                  data.header.status === "ended" ? "Ended" : "Draft",
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">
          Konfigurasi Event Program
        </h2>
        <p className="text-sm text-muted-foreground">
          Atur detail event, mekanisme reward, channel aktivasi, dan checklist
          eksekusi.
        </p>
      </div>

      {/* Accordion Sections */}
      <Accordion
        type="multiple"
        value={openSections}
        onValueChange={setOpenSections}
        className="space-y-4"
      >
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <AccordionItem
              key={section.id}
              value={section.id}
              className="border border-border rounded-xl overflow-hidden bg-card"
            >
              <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-button-hover/20 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-5 w-5 text-button-hover" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-base font-medium text-foreground">
                      {section.title}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {section.description}
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                {section.id === "header" && (
                  <EventHeader
                    data={data.header}
                    onChange={(updates) => handleUpdate("header", updates)}
                  />
                )}
                {section.id === "reward_config" && formData && onFormDataChange && (
                  <Step3Reward
                    data={formData}
                    onChange={onFormDataChange}
                  />
                )}
                {section.id === "objective" && (
                  <ObjectiveKPI
                    data={data.objective}
                    onChange={(updates) => handleUpdate("objective", updates)}
                  />
                )}
                {section.id === "reward" && (
                  <RewardMechanism
                    data={data.reward}
                    onChange={(updates) => handleUpdate("reward", updates)}
                  />
                )}
                {section.id === "channel" && (
                  <ChannelActivation
                    data={data.channel}
                    onChange={(updates) => handleUpdate("channel", updates)}
                  />
                )}
                {section.id === "asset" && (
                  <AssetManager
                    data={data.asset}
                    onChange={(updates) => handleUpdate("asset", updates)}
                  />
                )}
                {section.id === "rules" && (
                  <RulesAntiAbuse
                    data={data.rules}
                    onChange={(updates) => handleUpdate("rules", updates)}
                  />
                )}
                {section.id === "checklist" && (
                  <ExecutionChecklist
                    data={data.checklist}
                    onChange={(updates) => handleUpdate("checklist", updates)}
                  />
                )}
                {section.id === "monitoring" && (
                  <LiveMonitoring
                    data={monitoringData}
                    onChange={(updates) => handleUpdate("monitoring", updates)}
                  />
                )}
                {section.id === "summary" && (
                  <PostEventSummary
                    data={data.summary}
                    onChange={(updates) => handleUpdate("summary", updates)}
                    onCloneEvent={handleCloneEvent}
                  />
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

export { initialEventData };
