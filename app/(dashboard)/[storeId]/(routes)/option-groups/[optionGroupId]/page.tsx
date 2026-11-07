import { redirect } from 'next/navigation';
import { Page } from '@/components/dashboard/page';
import { getOptionGroup } from '@/queries/get-option-group';

import { OptionGroupForm } from './components/option-group-form';
import { OptionGroupFormValues } from './components/schema';

type Props = {
  params: Promise<{
    optionGroupId: string;
    storeId: string;
  }>;
};

const NEW_SEGMENT = 'new';

const OptionGroupPage = async (props: Props) => {
  const params = await props.params;
  const isNew = params.optionGroupId === NEW_SEGMENT;
  const optionGroup = isNew
    ? null
    : await getOptionGroup(params.storeId, params.optionGroupId, { includeValueUsage: true });

  if (!isNew && !optionGroup) {
    redirect(`/${params.storeId}/option-groups`);
  }

  const initialData = optionGroup
    ? ({
        name: optionGroup.name,
        displayType: optionGroup.displayType,
        values: optionGroup.values.map((value) => ({
          valueId: value.id,
          label: value.label,
          hex: value.hex ?? '',
          variantCount: value._count.variants,
        })),
      } satisfies OptionGroupFormValues)
    : null;

  return (
    <Page>
      <OptionGroupForm initialData={initialData} />
    </Page>
  );
};

export default OptionGroupPage;
