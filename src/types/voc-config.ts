export interface VOCConfig {
  brandProfile: BrandProfile;
  communicationStyle: CommunicationStyle;
  supportEscalation: SupportEscalation;
  safetyCrisis: SafetyCrisis;
  playerBehaviour: PlayerBehaviour;
  account: Account;
  apiData: APIData;
}

export interface BrandProfile {
  brandName: string;
  shortName: string;
  slogan: string;
  agentName: string;
  agentGender: string;
  toneStyle: string;
  defaultCallToPlayer: string;
  emojiPreference: string;
}

export interface CommunicationStyle {
  formalityLevel: number;
  warmthLevel: number;
  humorUsage: string;
  emojiStyle: string;
}

export interface SupportEscalation {
  adminContactMethod: string;
  adminContact: string;
  picActiveHours: string;
  escalationThreshold: string[];
  sopStyle: string;
  defaultEscalationMessage: string;
}

export interface SafetyCrisis {
  crisisToneStyle: string;
  bonusPreventifAllowed: boolean;
  bonusPreventifLimit?: string;
  riskAppetite: number;
  forbiddenPhrases: string;
  allowedSensitiveTerms: string;
  crisisKeywords: string;
  crisisResponseTemplate: string;
}

export interface PlayerBehaviour {
  personalizationLevel: number;
  sentimentalMemory: boolean;
  antiHunterAggressiveness: number;
  silentSniperStyle: string[];
  vipThreshold: string;
  vipTone: string[];
}

export interface Account {
  userName: string;
  whatsappNumber: string;
  email: string;
  position: string;
}

export interface APIData {
  supabaseApi: string;
  chatGptApi: string;
}
