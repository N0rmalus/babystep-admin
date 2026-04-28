import { CheckedState } from '@radix-ui/react-checkbox';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

type Props = {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
};

export const ProductStatusToggle = ({ label, description, checked, disabled, onCheckedChange }: Props) => {
  const handleCheckedChange = (value: CheckedState) => {
    onCheckedChange(value === true);
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border p-4 transition-colors',
        checked ? 'border-primary/40 bg-primary/5' : 'border-border bg-background',
        disabled && 'opacity-70',
      )}
    >
      <Checkbox checked={checked} disabled={disabled} onCheckedChange={handleCheckedChange} />
      <div className="flex flex-col gap-1">
        <p className="text-sm leading-none font-medium">{label}</p>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
    </div>
  );
};
