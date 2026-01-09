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
