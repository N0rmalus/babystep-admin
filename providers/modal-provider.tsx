'use client';

// Global imports
import { useEffect, useState } from 'react';

// Personal imports
import { StoreModal } from '@/components/modals/store-modal';

export const ModalProvider = () => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <>
      <StoreModal />
    </>
  );
};
