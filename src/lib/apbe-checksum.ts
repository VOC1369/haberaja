/**
 * APBE Config Checksum Utility v1.0
 * 
 * Generates and validates checksums for APBE configurations.
 * Used to detect tampering or corruption in exported/imported configs.
 * 
 * Algorithm: Simple hash based on JSON string content
 */

import { APBEConfig } from "@/types/apbe-config";

/**
 * Generate a simple hash checksum from config object
 * Uses DJB2 algorithm for fast, reasonably collision-resistant hashing
 */
export function generateChecksum(config: APBEConfig): string {
  // Create deterministic JSON string (sorted keys)
  const jsonString = JSON.stringify(config, Object.keys(config).sort());
  
  // DJB2 hash algorithm
  let hash = 5381;
  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString.charCodeAt(i);
    hash = ((hash << 5) + hash) + char; // hash * 33 + char
  }
  
  // Convert to hex string with fixed length
  const hexHash = (hash >>> 0).toString(16).padStart(8, "0");
  
  // Add length checksum for extra validation
  const lengthCheck = jsonString.length.toString(16).padStart(4, "0");
  
  return `${hexHash}-${lengthCheck}`;
}

/**
 * Validate checksum against config
 */
export function validateChecksum(config: APBEConfig, checksum: string): boolean {
  const expectedChecksum = generateChecksum(config);
  return expectedChecksum === checksum;
}

/**
 * Generate full integrity object for export
 */
export interface IntegrityData {
  checksum: string;
  generated_at: string;
  config_hash_length: number;
  version: string;
}

export function generateIntegrityData(config: APBEConfig): IntegrityData {
  const jsonString = JSON.stringify(config, Object.keys(config).sort());
  
  return {
    checksum: generateChecksum(config),
    generated_at: new Date().toISOString(),
    config_hash_length: jsonString.length,
    version: "1.0.0",
  };
}

/**
 * Validate integrity data against config
 */
export interface IntegrityValidationResult {
  isValid: boolean;
  checksumMatch: boolean;
  lengthMatch: boolean;
  errors: string[];
}

export function validateIntegrity(
  config: APBEConfig, 
  integrityData: IntegrityData
): IntegrityValidationResult {
  const errors: string[] = [];
  const jsonString = JSON.stringify(config, Object.keys(config).sort());
  
  // Check checksum
  const expectedChecksum = generateChecksum(config);
  const checksumMatch = expectedChecksum === integrityData.checksum;
  if (!checksumMatch) {
    errors.push(`Checksum mismatch: expected ${expectedChecksum}, got ${integrityData.checksum}`);
  }
  
  // Check length
  const lengthMatch = jsonString.length === integrityData.config_hash_length;
  if (!lengthMatch) {
    errors.push(`Length mismatch: expected ${integrityData.config_hash_length}, got ${jsonString.length}`);
  }
  
  return {
    isValid: checksumMatch && lengthMatch,
    checksumMatch,
    lengthMatch,
    errors,
  };
}

// ============================================================
// VERSION
// ============================================================

export const CHECKSUM_VERSION = "1.2.0" as const;
