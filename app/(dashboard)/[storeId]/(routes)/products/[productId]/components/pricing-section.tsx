'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form/form';
import { FormSection } from '@/components/ui/form/form-section';
import { Input } from '@/components/ui/input';
import { getProductSaleStatus, hasSubmittedValue, SaleStatus } from '@/lib/product-pricing';
import { formatVariantCount } from '@/lib/product-variant';
import { getEndedSaleWindow } from '@/lib/sale-form';
import { ProductFormValues } from './schema';

type Props = {
  isDisabled: boolean;
};

type ShownSaleStatus = Extract<SaleStatus, 'active' | 'scheduled' | 'ended'>;

const SALE_STATUS_LABELS = {
  active: 'Akcija vyksta',
  scheduled: 'Akcija suplanuota',
  ended: 'Akcija pasibaigusi',
} satisfies Record<ShownSaleStatus, string>;
const END_SALE_LABELS = {
  active: 'Baigti akciją dabar',
  scheduled: 'Atšaukti akciją',
} satisfies Partial<Record<ShownSaleStatus, string>>;
const END_SALE_HINT = 'Akcijos kainos lieka, kad akciją būtų galima vėl pradėti pakeitus datas.';
const CLEAR_VARIANT_SALE_PRICES_LABEL = 'Išvalyti variantų akcijos kainas';

export const PricingSection = ({ isDisabled }: Props) => {
  const form = useFormContext<ProductFormValues>();
  const [price, salePrice, saleStartsAt, saleEndsAt, optionGroups, variants] = useWatch({
    control: form.control,
    name: ['price', 'salePrice', 'saleStartsAt', 'saleEndsAt', 'optionGroups', 'variants'],
  });
  const status = getProductSaleStatus({ price, salePrice, saleStartsAt, saleEndsAt });
  const hasSalePrice = hasSubmittedValue(salePrice);
  const isSaleWindowShown = hasSalePrice || Boolean(saleStartsAt) || Boolean(saleEndsAt);
  const variantSaleIndexes =
    optionGroups.length === 0
      ? []
      : variants.flatMap((variant, index) =>
          !variant.isArchived && hasSubmittedValue(variant.salePrice) ? [index] : [],
        );
  const isVariantSaleWarningShown = !hasSalePrice && variantSaleIndexes.length > 0;

  const handleEndSale = () => {
    const endedWindow = getEndedSaleWindow({ saleStartsAt, now: new Date() });
    const options = { shouldDirty: true, shouldValidate: form.formState.isSubmitted };

    form.setValue('saleStartsAt', endedWindow.saleStartsAt, options);
    form.setValue('saleEndsAt', endedWindow.saleEndsAt, options);
  };

  const handleClearVariantSalePrices = () => {
    variantSaleIndexes.forEach((index) => {
      form.setValue(`variants.${index}.salePrice`, null, { shouldDirty: true });
    });
  };

  return (
    <FormSection title="Kaina ir akcija">
      {isShownSaleStatus(status) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge variant={status === 'active' ? 'default' : 'secondary'}>{SALE_STATUS_LABELS[status]}</Badge>
          {status !== 'ended' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDisabled}
              title={END_SALE_HINT}
              onClick={handleEndSale}
            >
              {END_SALE_LABELS[status]}
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <FormField
          control={form.control}
          name="price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Kaina</FormLabel>
              <FormControl>
                <Input type="number" min="0" step="0.01" disabled={isDisabled} placeholder="9.99" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="salePrice"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Akcijos kaina</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={isDisabled}
                  placeholder="7.99"
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormDescription>Palik tuščią, jei prekė neturi akcijos.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {isSaleWindowShown && (
          <>
            <FormField
              control={form.control}
              name="saleStartsAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Akcijos pradžia</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" disabled={isDisabled} {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormDescription>Neprivaloma. Jei tuščia, akcija prasideda iš karto.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="saleEndsAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Akcijos pabaiga</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" disabled={isDisabled} {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormDescription>Neprivaloma. Jei tuščia, akcija veikia be pabaigos datos.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}
      </div>

      {isVariantSaleWarningShown && (
        <Alert>
          <AlertDescription className="flex flex-col items-start gap-3">
            <p>
              {formatVariantCount(variantSaleIndexes.length)} turi savo akcijos kainą. Kol prekė neturi akcijos, ši
              kaina galioja be pabaigos datos.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDisabled}
              onClick={handleClearVariantSalePrices}
            >
              {CLEAR_VARIANT_SALE_PRICES_LABEL}
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </FormSection>
  );
};

const isShownSaleStatus = (status: SaleStatus): status is ShownSaleStatus =>
  status === 'active' || status === 'scheduled' || status === 'ended';
