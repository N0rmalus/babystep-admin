import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { PaperWrapper } from '@/components/ui/paper-wrapper';

type Props = {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  borderless?: boolean;
};

export const FormSection = ({ title, description, children, className, contentClassName, borderless }: Props) => {
  return (
    <PaperWrapper className="flex flex-col gap-4" borderless={borderless}>
      {(title || description) && (
        <div className="flex flex-col">
          {title && <h3 className="text-base font-semibold tracking-tight">{title}</h3>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      <div className={cn('space-y-4', contentClassName)}>{children}</div>
    </PaperWrapper>
  );
};
