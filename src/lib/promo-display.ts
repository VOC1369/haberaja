// Shared display helpers for promo / game restriction data.

const GAME_TYPE_LABEL_SYNONYMS: Record<string, string> = {
  cockfight: "Sabung Ayam",
  "sabung ayam": "Sabung Ayam",
  sabung_ayam: "Sabung Ayam",

  fish_shooting: "Tembak Ikan",
  "fish shooting": "Tembak Ikan",
  tembak_ikan: "Tembak Ikan",

  lottery: "Togel",
  togel: "Togel",

  sportsbook: "Sportsbook",
  sports_betting: "Sportsbook",
  "sports betting": "Sportsbook",

  slot: "Slot",
  casino: "Casino",

  arcade: "Arcade",
  arcade_games: "Arcade",
};

const normalizeKey = (value: string) => value.trim().toLowerCase();

const toTitleCase = (value: string) => {
  return value
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
};

/**
 * Convert a raw game type (legacy or new) into a consistent Indonesian/platform label.
 */
export const formatGameTypeLabel = (rawType: string): string => {
  if (!rawType) return "-";

  const normalized = normalizeKey(rawType);
  const mapped = GAME_TYPE_LABEL_SYNONYMS[normalized];
  if (mapped) return mapped;

  // generic fallback: snake_case -> words, then Title Case
  const cleaned = rawType.replace(/_/g, " ");
  return toTitleCase(cleaned);
};

export const formatGameTypesList = (types?: string[] | null): string => {
  if (!types?.length) return "-";
  return types.map(formatGameTypeLabel).join(", ");
};

/**
 * Provider display rules:
 * - If eligible_providers exists, show it (platform/provider eligibility)
 * - Else show game_providers EXCEPT when it contains "ALL" (treat as unspecified)
 */
export const formatProvidersDisplay = (params: {
  eligible_providers?: string[] | null;
  game_providers?: string[] | null;
}): string => {
  const eligible = params.eligible_providers?.filter(Boolean) ?? [];
  if (eligible.length > 0) return eligible.join(", ");

  const gameProviders = params.game_providers?.filter(Boolean) ?? [];
  if (gameProviders.length === 0) return "-";
  if (gameProviders.some((p) => normalizeKey(p) === "all")) return "-";
  return gameProviders.join(", ");
};
