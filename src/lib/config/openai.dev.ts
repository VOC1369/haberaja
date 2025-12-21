/**
 * DEV MODE API KEY CONFIGURATION
 * ⚠️ MUST BE REMOVED/REPLACED BEFORE PRODUCTION
 */

export const IS_DEV_MODE = true; // MUST BE REMOVED BEFORE PROD

export const DEV_OPENAI_API_KEY = "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";

// DEV MODE ASSERTION - throws if flag is wrong
export function assertDevMode() {
  if (!IS_DEV_MODE) {
    throw new Error("DEV API KEY USED IN NON-DEV MODE — CRITICAL SECURITY ISSUE");
  }
}

export function getOpenAIKey(): string {
  assertDevMode();
  return DEV_OPENAI_API_KEY;
}
