'use client';

import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import useMounted from '@/hooks/use-mounted';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}

export const AlertModal: React.FC<AlertModalProps> = ({ isOpen, onClose, onConfirm, loading }) => {
  const isMounted = useMounted();

  if (!isMounted) {
    return null;
  }

  return (
    <Modal
      title="Ar esate tikri?"
      description="Šio veiksmo nebus galima grąžinti atgal."
      isOpen={isOpen}
      onClose={onClose}
    >
      <div className="flex w-full items-center justify-end space-x-2 pt-6">
        <Button type="button" disabled={loading} variant="outline" onClick={onClose}>
          Atšaukti
        </Button>
        <Button type="button" disabled={loading} variant="destructive" onClick={onConfirm}>
          Tęsti
        </Button>
      </div>
    </Modal>
  );
};
