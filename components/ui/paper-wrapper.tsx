import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  children: ReactNode;
  className?: string;
};

export const PaperWrapper = ({ children, className }: Props) => (
  <div className={cn('rounded-xl border bg-card p-5 shadow-sm', className)}>{children}</div>
);
