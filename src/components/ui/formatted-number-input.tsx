import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { formatNumberWithSeparator, parseFormattedNumber, cn } from '@/lib/utils';

interface FormattedNumberInputProps {
  value: number | string;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  min?: number;
}

export function FormattedNumberInput({
  value,
  onChange,
  placeholder = "0",
  className,
  min = 0
}: FormattedNumberInputProps) {
  const [display, setDisplay] = useState(() => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return numValue > 0 ? formatNumberWithSeparator(numValue) : '';
  });

  // Sync display when value changes externally
  useEffect(() => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (numValue > 0) {
      setDisplay(formatNumberWithSeparator(numValue));
    } else {
      setDisplay('');
    }
  }, [value]);

  return (
    <Input
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      value={display}
      className={cn(className)}
      onChange={(e) => {
        const raw = e.target.value;
        // Allow numbers and dots only (or empty string)
        if (/^[\d.]*$/.test(raw)) {
          setDisplay(raw);
          // Only update parent if there's actual value
          if (raw !== '') {
            const parsed = parseFormattedNumber(raw);
            if (!isNaN(parsed) && parsed >= min) {
              onChange(parsed);
            }
          }
        }
      }}
      onBlur={() => {
        // Auto-format on blur
        const parsed = parseFormattedNumber(display);
        if (!isNaN(parsed) && parsed > 0) {
          setDisplay(formatNumberWithSeparator(parsed));
        } else {
          setDisplay('');
          onChange(0);
        }
      }}
    />
  );
}
