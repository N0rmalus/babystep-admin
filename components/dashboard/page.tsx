import { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

export const Page = ({ children }: Props) => {
  return <div className="flex-1 space-y-4 p-4 pt-4 sm:p-6 sm:pt-6 lg:p-8">{children}</div>;
};
