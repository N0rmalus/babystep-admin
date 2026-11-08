'use client';

import type { ImageTagOption } from '@/lib/product-images';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Props = {
  // "Spalva: Avižų": the values the product's active variants use
  options: ImageTagOption[];
  value: string | null;
  isDisabled: boolean;
  onChange: (optionValueId: string | null) => void;
};

// Radix Select can't use an empty string as an item value
const NO_TAG_VALUE = 'no-tag';
const NO_TAG_LABEL = 'Be žymos';
const TAG_LABEL = 'Nuotraukos žyma';

export const ImageTagSelect = ({ options, value, isDisabled, onChange }: Props) => {
  const isKnownValue = options.some(({ id }) => id === value);

  return (
    <Select
      disabled={isDisabled}
      value={value && isKnownValue ? value : NO_TAG_VALUE}
      onValueChange={(selected) => onChange(selected === NO_TAG_VALUE ? null : selected)}
    >
      <SelectTrigger className="w-full" aria-label={TAG_LABEL}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_TAG_VALUE}>{NO_TAG_LABEL}</SelectItem>
        {options.map(({ id, label }) => (
          <SelectItem key={id} value={id}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
