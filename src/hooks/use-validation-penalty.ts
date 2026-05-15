/**
 * useValidationPenalty Hook v1.0
 * 
 * Real-time monitoring of validation score changes.
 * Shows toast notification when score drops (penalty applied).
 * 
 * Usage:
 * const { checkPenalty, lastScore } = useValidationPenalty();
 * 
 * // Call in useEffect when config changes
 * checkPenalty(newConfig);
 */

import { useRef, useCallback } from "react";
import { toast } from "@/lib/notify";
import { APBEConfig } from "@/types/apbe-config";
import { validatePersonaJSON, PersonaValidationResult } from "@/lib/apbe-persona-validator";

export interface PenaltyEvent {
  previousScore: number;
  currentScore: number;
  penalty: number;
  newErrors: string[];
  timestamp: string;
}

export interface UseValidationPenaltyReturn {
  checkPenalty: (config: APBEConfig) => PenaltyEvent | null;
  lastScore: number;
  lastResult: PersonaValidationResult | null;
}

export function useValidationPenalty(): UseValidationPenaltyReturn {
  const lastScoreRef = useRef<number>(100);
  const lastResultRef = useRef<PersonaValidationResult | null>(null);
  const lastErrorsRef = useRef<Set<string>>(new Set());
  const isFirstRunRef = useRef<boolean>(true);
  
  const checkPenalty = useCallback((config: APBEConfig): PenaltyEvent | null => {
    const result = validatePersonaJSON(config);
    const currentScore = result.score;
    const previousScore = lastScoreRef.current;
    
    // Skip toast on first run — just baseline the score silently
    if (isFirstRunRef.current) {
      isFirstRunRef.current = false;
      lastScoreRef.current = currentScore;
      lastResultRef.current = result;
      lastErrorsRef.current = new Set([...result.criticalErrors, ...result.warnings]);
      return null;
    }
    
    // Detect new errors (not previously seen)
    const currentErrors = new Set([...result.criticalErrors, ...result.warnings]);
    const newErrors = [...currentErrors].filter(e => !lastErrorsRef.current.has(e));
    
    // Check if score dropped
    if (currentScore < previousScore) {
      const penalty = previousScore - currentScore;
      
      // Only show toast for significant penalty (>= 5 points)
      if (penalty >= 5) {
        // Determine severity
        const isCritical = result.criticalErrors.length > 0;
        const penaltyText = penalty >= 20 ? "besar" : penalty >= 10 ? "sedang" : "kecil";
        
        // Show toast with penalty info
        if (isCritical) {
          toast.error(`⚠️ Score turun ${penalty} poin`, {
            description: newErrors.length > 0 
              ? newErrors[0] 
              : `Score: ${previousScore}% → ${currentScore}%`,
            duration: 5000,
          });
        } else {
          toast.warning(`📉 Penalty ${penaltyText}: -${penalty} poin`, {
            description: `Score: ${previousScore}% → ${currentScore}%`,
            duration: 4000,
          });
        }
        
        const event: PenaltyEvent = {
          previousScore,
          currentScore,
          penalty,
          newErrors,
          timestamp: new Date().toISOString(),
        };
        
        // Update refs
        lastScoreRef.current = currentScore;
        lastResultRef.current = result;
        lastErrorsRef.current = currentErrors;
        
        return event;
      }
    }
    
    // Score improved or unchanged - still update refs
    if (currentScore > previousScore && previousScore < 100) {
      const improvement = currentScore - previousScore;
      if (improvement >= 10) {
        toast.success(`✅ Score naik +${improvement} poin!`, {
          description: `Score: ${currentScore}%`,
          duration: 3000,
        });
      }
    }
    
    // Update refs
    lastScoreRef.current = currentScore;
    lastResultRef.current = result;
    lastErrorsRef.current = currentErrors;
    
    return null;
  }, []);
  
  return {
    checkPenalty,
    lastScore: lastScoreRef.current,
    lastResult: lastResultRef.current,
  };
}
