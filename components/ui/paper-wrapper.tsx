import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  children: ReactNode;
  className?: string;
  borderless?: boolean;
};

export const PaperWrapper = ({ children, className, borderless }: Props) => (
  <div className={cn('rounded-xl bg-card p-5', className, !borderless && 'border')}>{children}</div>
);
