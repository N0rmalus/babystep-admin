import useMounted from '@/hooks/use-mounted';

export const useOrigin = () => {
  const mounted = useMounted();

  return mounted ? window.location.origin : '';
};
