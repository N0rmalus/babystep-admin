'use client';

// Global imports
import toast from 'react-hot-toast';
import { Copy, Server } from 'lucide-react';

// Personal imports
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge, BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ApiAlertProps {
  title: string;
  description: string;
  variant: 'public' | 'admin';
}

const textMap: Record<ApiAlertProps['variant'], string> = {
  public: 'Viešas',
  admin: 'Privatus',
};

const variantMap: Record<ApiAlertProps['variant'], BadgeProps['variant']> = {
  public: 'secondary',
  admin: 'destructive',
};

export const ApiAlert: React.FC<ApiAlertProps> = ({ title, description, variant = 'public' }) => {
  const onCopy = () => {
    navigator.clipboard.writeText(description);
    toast.success('API maršrutas nukopijuotas į iškarpinę.');
  };

  return (
    <Alert className="mb-4">
      <Server className="h-5 w-4" />
      <AlertTitle className="flex flex-wrap items-center gap-2 px-8 pr-2">
        {title}
        <Badge variant={variantMap[variant]}> {textMap[variant]} </Badge>
      </AlertTitle>
      <AlertDescription className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <code className="block max-w-full overflow-x-auto rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold whitespace-nowrap">
          {' '}
          {description}{' '}
        </code>
        <Button variant="outline" size="icon" className="shrink-0 self-start" onClick={onCopy}>
          <Copy className="h-4 w-4" />
        </Button>
      </AlertDescription>
    </Alert>
  );
};
