import { z } from 'zod';

import { NEXT_ORDER_NUMBER_INVALID_MESSAGE } from '@/lib/store-settings';

export const settingsFormSchema = z.object({
  name: z.string().min(1),
  nextOrderNumber: z.coerce
    .number({ invalid_type_error: NEXT_ORDER_NUMBER_INVALID_MESSAGE })
    .int(NEXT_ORDER_NUMBER_INVALID_MESSAGE)
    .min(1, NEXT_ORDER_NUMBER_INVALID_MESSAGE),
});

export type SettingsFormValues = z.infer<typeof settingsFormSchema>;
