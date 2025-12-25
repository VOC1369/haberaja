import { Step3Reward } from "./Step3Reward";
import { PromoFormData } from "./types";

interface Step4BEventConfigProps {
  formData?: PromoFormData;
  onFormDataChange?: (data: Partial<PromoFormData>) => void;
  isEditingFromReview?: boolean;
  onSaveAndReturn?: () => void;
}

export function Step4BEventConfig({
  formData,
  onFormDataChange,
  isEditingFromReview,
  onSaveAndReturn,
}: Step4BEventConfigProps) {
  if (!formData || !onFormDataChange) return null;

  return (
    <Step3Reward
      data={formData}
      onChange={onFormDataChange}
      isEditingFromReview={isEditingFromReview}
      onSaveAndReturn={onSaveAndReturn}
      stepNumber={4}
      stepTitle="Konfigurasi Event"
    />
  );
}

export default Step4BEventConfig;
