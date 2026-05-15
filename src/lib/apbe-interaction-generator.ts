/**
 * APBE Interaction Library Generator v2.0
 * Auto-generates interaction templates based on persona settings
 * 
 * IMPORTANT: All templates use {{A.call_to_player}} for consistent namespace
 */

import { APBEConfig } from "@/types/apbe-config";

export interface InteractionTemplate {
  id: string;
  category: InteractionCategory;
  subcategory?: string;
  content: string;
  isEdited: boolean;
  warnings: string[];
}

export type InteractionCategory = 
  | "greeting"
  | "closing"
  | "apology"
  | "empathy"
  | "crisis"
  | "vip"
  | "friendly"
  | "fallback";

export interface InteractionLibrary {
  greeting: InteractionTemplate[];
  closing: InteractionTemplate[];
  apology: InteractionTemplate[];
  empathy: InteractionTemplate[];
  crisis: InteractionTemplate[];
  vip: InteractionTemplate[];
  friendly: InteractionTemplate[];
  fallback: InteractionTemplate[];
}

// Tone style mappings for generation
const TONE_STYLES: Record<string, { particles: string[]; greeting_style: string; closing_style: string }> = {
  friendly: {
    particles: ["ya", "yah", "nih", "dong", "deh"],
    greeting_style: "casual_warm",
    closing_style: "warm_friendly"
  },
  professional: {
    particles: [],
    greeting_style: "formal",
    closing_style: "formal_polite"
  },
  playful: {
    particles: ["nih", "dong", "yuk", "wah"],
    greeting_style: "energetic",
    closing_style: "cheerful"
  },
  empathetic: {
    particles: ["ya", "yah"],
    greeting_style: "warm_caring",
    closing_style: "supportive"
  }
};

// Time-based greeting generators
const generateGreetings = (config: APBEConfig): InteractionTemplate[] => {
  const tone = config.agent?.tone || "friendly";
  const toneStyle = TONE_STYLES[tone] || TONE_STYLES.friendly;
  
  const particle = toneStyle.particles.length > 0 ? ` ${toneStyle.particles[0]}` : "";
  
  const templates: InteractionTemplate[] = [
    {
      id: "greeting_morning",
      category: "greeting",
      subcategory: "morning",
      content: `Selamat pagi${particle}, {{A.call_to_player}}! Saya {{agent.name}} dari {{A.website_name}}. Ada yang bisa saya bantu hari ini?`,
      isEdited: false,
      warnings: []
    },
    {
      id: "greeting_afternoon",
      category: "greeting",
      subcategory: "afternoon",
      content: `Selamat siang${particle}, {{A.call_to_player}}! {{agent.name}} di sini, siap membantu {{A.website_name}}. Ada yang bisa dibantu?`,
      isEdited: false,
      warnings: []
    },
    {
      id: "greeting_evening",
      category: "greeting",
      subcategory: "evening",
      content: `Selamat sore${particle}, {{A.call_to_player}}! Saya {{agent.name}}, dengan senang hati membantu Anda di {{A.website_name}}.`,
      isEdited: false,
      warnings: []
    },
    {
      id: "greeting_night",
      category: "greeting",
      subcategory: "night",
      content: `Selamat malam${particle}, {{A.call_to_player}}! {{agent.name}} dari {{A.website_name}} hadir untuk membantu.`,
      isEdited: false,
      warnings: []
    },
    {
      id: "greeting_general",
      category: "greeting",
      subcategory: "general",
      content: `Halo${particle}, {{A.call_to_player}}! Selamat datang di {{A.website_name}}. Saya {{agent.name}}, ada yang bisa saya bantu?`,
      isEdited: false,
      warnings: []
    }
  ];
  
  return templates;
};

// Closing message generators
const generateClosings = (config: APBEConfig): InteractionTemplate[] => {
  const tone = config.agent?.tone || "friendly";
  const toneStyle = TONE_STYLES[tone] || TONE_STYLES.friendly;
  
  const particle = toneStyle.particles.length > 0 ? ` ${toneStyle.particles[0]}` : "";
  
  return [
    {
      id: "closing_normal",
      category: "closing",
      subcategory: "normal",
      content: `Terima kasih sudah menghubungi {{A.website_name}}${particle}, {{A.call_to_player}}! Jika ada pertanyaan lain, jangan ragu untuk menghubungi saya kembali.`,
      isEdited: false,
      warnings: []
    },
    {
      id: "closing_resolved",
      category: "closing",
      subcategory: "resolved",
      content: `Senang bisa membantu {{A.call_to_player}}! Semoga hari {{A.call_to_player}} menyenangkan. Sampai jumpa lagi di {{A.website_name}}!`,
      isEdited: false,
      warnings: []
    },
    {
      id: "closing_angry",
      category: "closing",
      subcategory: "angry",
      content: `Sekali lagi mohon maaf atas ketidaknyamanan yang {{A.call_to_player}} alami. Kami akan terus berusaha memberikan pelayanan yang lebih baik. Terima kasih atas kesabarannya.`,
      isEdited: false,
      warnings: []
    },
    {
      id: "closing_vip",
      category: "closing",
      subcategory: "vip",
      content: `Terima kasih banyak, {{A.call_to_player}}! Sebagai member VIP {{A.website_name}}, kami sangat menghargai kepercayaan Anda. Jika butuh bantuan prioritas, saya selalu siap membantu.`,
      isEdited: false,
      warnings: []
    },
    {
      id: "closing_followup",
      category: "closing",
      subcategory: "followup",
      content: `Baik {{A.call_to_player}}, jika ada update atau pertanyaan lanjutan, langsung hubungi saya ya. {{agent.name}} dari {{A.website_name}} siap membantu kapan saja!`,
      isEdited: false,
      warnings: []
    }
  ];
};

// Apology message generators
const generateApologies = (config: APBEConfig): InteractionTemplate[] => {
  return [
    {
      id: "apology_mild",
      category: "apology",
      subcategory: "mild",
      content: `Mohon maaf ya {{A.call_to_player}}, sepertinya ada sedikit kendala. Saya akan bantu selesaikan sekarang.`,
      isEdited: false,
      warnings: []
    },
    {
      id: "apology_medium",
      category: "apology",
      subcategory: "medium",
      content: `Mohon maaf atas ketidaknyamanan ini, {{A.call_to_player}}. Kami dari {{A.website_name}} sedang berusaha menyelesaikan masalah ini secepat mungkin.`,
      isEdited: false,
      warnings: []
    },
    {
      id: "apology_severe",
      category: "apology",
      subcategory: "severe",
      content: `Kami sangat menyesal atas pengalaman yang tidak menyenangkan ini, {{A.call_to_player}}. Tim {{A.website_name}} akan memprioritaskan penyelesaian masalah Anda dan memastikan hal ini tidak terulang.`,
      isEdited: false,
      warnings: []
    }
  ];
};

// Empathy phrase generators
const generateEmpathyPhrases = (config: APBEConfig): InteractionTemplate[] => {
  const empathyLevel = config.C?.empathy || 5;
  
  const baseTemplates: InteractionTemplate[] = [
    {
      id: "empathy_understanding",
      category: "empathy",
      subcategory: "understanding",
      content: `Saya sangat memahami perasaan {{A.call_to_player}}. Siapapun pasti akan merasa sama dalam situasi ini.`,
      isEdited: false,
      warnings: []
    },
    {
      id: "empathy_validation",
      category: "empathy",
      subcategory: "validation",
      content: `Perasaan {{A.call_to_player}} sangat valid. Wajar sekali jika {{A.call_to_player}} merasa kecewa dengan situasi ini.`,
      isEdited: false,
      warnings: []
    },
    {
      id: "empathy_support",
      category: "empathy",
      subcategory: "support",
      content: `{{A.call_to_player}} tidak sendirian. Saya di sini untuk membantu menyelesaikan masalah ini bersama-sama.`,
      isEdited: false,
      warnings: []
    }
  ];
  
  // Add more empathy phrases for high empathy level
  if (empathyLevel >= 7) {
    baseTemplates.push({
      id: "empathy_deep",
      category: "empathy",
      subcategory: "deep",
      content: `Saya benar-benar bisa merasakan betapa frustrasinya situasi ini untuk {{A.call_to_player}}. Mari kita cari jalan keluarnya bersama.`,
      isEdited: false,
      warnings: []
    });
  }
  
  return baseTemplates;
};

// Crisis response generators
const generateCrisisResponses = (config: APBEConfig): InteractionTemplate[] => {
  return [
    {
      id: "crisis_angry_player",
      category: "crisis",
      subcategory: "angry_player",
      content: `Kami sangat memahami perasaan {{A.call_to_player}}. Tenang dulu ya, kami pastikan akan membantu menyelesaikan masalah ini dengan baik. Mari kita cari solusi terbaik bersama-sama.`,
      isEdited: false,
      warnings: []
    },
    {
      id: "crisis_system_error",
      category: "crisis",
      subcategory: "system_error",
      content: `Mohon maaf atas ketidaknyamanannya, {{A.call_to_player}}. Tim teknis {{A.website_name}} sedang menangani masalah ini. Sistem akan segera pulih dan kami akan update perkembangannya.`,
      isEdited: false,
      warnings: []
    },
    {
      id: "crisis_payment",
      category: "crisis",
      subcategory: "payment_issue",
      content: `Kami mengerti kekhawatiran {{A.call_to_player}} soal transaksi ini. Jangan khawatir, kami akan cek detail transaksi dan memastikan semuanya terproses dengan benar.`,
      isEdited: false,
      warnings: []
    },
    {
      id: "crisis_account_locked",
      category: "crisis",
      subcategory: "account_locked",
      content: `Akun {{A.call_to_player}} sedang dalam proses verifikasi untuk keamanan. Ini prosedur standar dan tidak perlu khawatir. Kami akan bantu {{A.call_to_player}} melewati proses ini dengan lancar.`,
      isEdited: false,
      warnings: []
    },
    {
      id: "crisis_fraud",
      category: "crisis",
      subcategory: "fraud_detected",
      content: `Demi keamanan akun {{A.call_to_player}}, kami perlu melakukan verifikasi tambahan. Ini untuk melindungi {{A.call_to_player}}. Prosesnya tidak lama dan kami akan dampingi.`,
      isEdited: false,
      warnings: []
    }
  ];
};

// VIP template generators
const generateVIPTemplates = (config: APBEConfig): InteractionTemplate[] => {
  return [
    {
      id: "vip_greeting",
      category: "vip",
      subcategory: "greeting",
      content: `Selamat datang kembali, {{A.call_to_player}}! Sebagai member VIP {{A.website_name}}, Anda mendapatkan prioritas layanan dari saya, {{agent.name}}. Ada yang bisa saya bantu hari ini?`,
      isEdited: false,
      warnings: []
    },
    {
      id: "vip_appreciation",
      category: "vip",
      subcategory: "appreciation",
      content: `Terima kasih atas kepercayaan {{A.call_to_player}} selama ini sebagai member VIP kami. {{A.website_name}} sangat menghargai loyalitas Anda.`,
      isEdited: false,
      warnings: []
    },
    {
      id: "vip_priority",
      category: "vip",
      subcategory: "priority",
      content: `Tentu, {{A.call_to_player}}! Sebagai VIP, permintaan Anda akan saya prioritaskan. Mohon tunggu sebentar ya.`,
      isEdited: false,
      warnings: []
    }
  ];
};

// Friendly short phrases
const generateFriendlyPhrases = (config: APBEConfig): InteractionTemplate[] => {
  const style = config.agent?.style || "friendly";
  
  if (style === "professional" || style === "formal") {
    return []; // Professional/formal style doesn't use casual phrases
  }
  
  return [
    {
      id: "friendly_acknowledge",
      category: "friendly",
      subcategory: "acknowledge",
      content: `Baik, {{A.call_to_player}}! Saya mengerti.`,
      isEdited: false,
      warnings: []
    },
    {
      id: "friendly_confirm",
      category: "friendly",
      subcategory: "confirm",
      content: `Siap, {{A.call_to_player}}! Saya proses sekarang ya.`,
      isEdited: false,
      warnings: []
    },
    {
      id: "friendly_wait",
      category: "friendly",
      subcategory: "wait",
      content: `Mohon tunggu sebentar ya, {{A.call_to_player}}. Saya cek dulu.`,
      isEdited: false,
      warnings: []
    }
  ];
};

// Fallback message generators
const generateFallbacks = (config: APBEConfig): InteractionTemplate[] => {
  return [
    {
      id: "fallback_unclear",
      category: "fallback",
      subcategory: "unclear",
      content: `Mohon maaf {{A.call_to_player}}, saya kurang memahami maksudnya. Bisa dijelaskan lebih detail?`,
      isEdited: false,
      warnings: []
    },
    {
      id: "fallback_outofscope",
      category: "fallback",
      subcategory: "out_of_scope",
      content: `Mohon maaf {{A.call_to_player}}, pertanyaan tersebut di luar cakupan yang bisa saya bantu. Silakan hubungi admin {{A.website_name}} untuk bantuan lebih lanjut.`,
      isEdited: false,
      warnings: []
    },
    {
      id: "fallback_transfer",
      category: "fallback",
      subcategory: "transfer",
      content: `{{A.call_to_player}}, untuk masalah ini saya perlu menghubungkan Anda dengan tim yang lebih tepat. Mohon tunggu sebentar ya.`,
      isEdited: false,
      warnings: []
    }
  ];
};

/**
 * Generate complete Interaction Library from APBE config
 */
export const generateInteractionLibrary = (config: APBEConfig): InteractionLibrary => {
  return {
    greeting: generateGreetings(config),
    closing: generateClosings(config),
    apology: generateApologies(config),
    empathy: generateEmpathyPhrases(config),
    crisis: generateCrisisResponses(config),
    vip: generateVIPTemplates(config),
    friendly: generateFriendlyPhrases(config),
    fallback: generateFallbacks(config)
  };
};

/**
 * Generate escalation message based on persona config
 */
export const generateEscalationMessage = (config: APBEConfig): string => {
  const tone = config.agent?.tone || "friendly";
  const style = config.agent?.style || "casual";
  const callToPlayer = config.A?.call_to_player || "Kak";
  const agentName = config.agent?.name || "AI Assistant";
  const websiteName = config.A?.website_name || "kami";
  
  const toneStyle = TONE_STYLES[tone] || TONE_STYLES.friendly;
  const particle = toneStyle.particles.length > 0 ? ` ${toneStyle.particles[0]}` : "";
  
  // Generate variations based on tone
  const templates: Record<string, string[]> = {
    friendly: [
      `Mohon maaf${particle} ${callToPlayer}, untuk memastikan masalah ini tertangani dengan baik, saya akan hubungkan dengan tim ${websiteName} yang lebih berpengalaman ya 🙏`,
      `Baik ${callToPlayer}, agar kendala ini bisa diselesaikan dengan optimal, saya akan teruskan ke tim ahli kami${particle}. Mohon tunggu sebentar ya 💪`,
      `${callToPlayer}, untuk memberikan solusi terbaik, saya perlu menghubungkan dengan rekan tim yang lebih senior${particle}. Terima kasih atas kesabarannya 🙏`
    ],
    professional: [
      `Terima kasih atas kesabarannya, ${callToPlayer}. Untuk memastikan penanganan optimal, saya akan menghubungkan Anda dengan tim senior ${websiteName}.`,
      `Baik ${callToPlayer}, permasalahan ini memerlukan penanganan khusus. Mohon menunggu, saya akan menghubungkan Anda dengan tim yang lebih berpengalaman.`,
      `${callToPlayer}, izinkan saya untuk menghubungkan Anda dengan tim spesialis kami untuk penanganan lebih lanjut.`
    ],
    playful: [
      `Wah ${callToPlayer}, sepertinya butuh bantuan superhero kita nih! 🦸 Sebentar ya, saya panggilkan tim jagoan ${websiteName}!`,
      `Oke ${callToPlayer}! Biar masalah ini cepat kelar, saya hubungkan sama tim expert kita ya 💪✨`,
      `${callToPlayer}, tenang aja! Tim andalan ${websiteName} siap membantu. Sebentar ya, saya panggilkan dulu 🚀`
    ],
    empathetic: [
      `Saya paham ${callToPlayer}, dan saya ingin memastikan masalah ini ditangani dengan sebaik-baiknya. Izinkan saya menghubungkan dengan tim yang dapat membantu lebih lanjut ya 🙏`,
      `Terima kasih sudah berbagi ${callToPlayer}. Agar bisa memberikan solusi terbaik, saya akan hubungkan dengan rekan tim yang lebih berpengalaman ya 💙`,
      `${callToPlayer}, saya mengerti situasinya. Untuk penanganan yang lebih baik, izinkan saya teruskan ke tim senior kami yang siap membantu 🙏`
    ]
  };
  
  const toneTemplates = templates[tone] || templates.friendly;
  // Pick a random template from the available options
  const randomIndex = Math.floor(Math.random() * toneTemplates.length);
  return toneTemplates[randomIndex];
};

/**
 * Get category display info
 */
export const CATEGORY_INFO: Record<InteractionCategory, { label: string; description: string; required: boolean; minCount: number }> = {
  greeting: { label: "Greeting", description: "Sapaan berdasarkan waktu", required: true, minCount: 5 },
  closing: { label: "Closing", description: "Penutup percakapan", required: true, minCount: 5 },
  apology: { label: "Apologies", description: "Template permintaan maaf", required: true, minCount: 3 },
  empathy: { label: "Empathy Phrases", description: "Kalimat empati", required: true, minCount: 3 },
  crisis: { label: "Crisis Templates", description: "Respon situasi krisis", required: true, minCount: 5 },
  vip: { label: "VIP Templates", description: "Template khusus VIP", required: true, minCount: 2 },
  friendly: { label: "Friendly Phrases", description: "Kalimat pendek ramah", required: false, minCount: 0 },
  fallback: { label: "Fallback Lines", description: "Respon default", required: true, minCount: 3 }
};
