import type { V10WizardState } from "../state";

export type StepProps = {
  state: V10WizardState;
  update: <K extends keyof V10WizardState>(key: K, patch: Partial<V10WizardState[K]>) => void;
};
