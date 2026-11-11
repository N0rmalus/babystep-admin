import { Page } from '@/components/dashboard/page';
import { OPTION_DISPLAY_TYPE_LABELS } from '@/lib/option-display-type-labels';
import { getOptionGroups } from '@/queries/get-option-groups';

import { OptionGroupClient } from './components/client';
import { OptionGroupColumn } from './components/columns';
import { requireStoreOwner } from '@/lib/require-store-owner';

type Props = {
  params: Promise<{
    storeId: string;
  }>;
};

const OptionGroupsPage = async (props: Props) => {
  const params = await props.params;
  await requireStoreOwner(params.storeId);
  const optionGroups = await getOptionGroups(params.storeId);

  const formattedOptionGroups = optionGroups.map((group) => ({
    id: group.id,
    name: group.name,
    displayTypeLabel: OPTION_DISPLAY_TYPE_LABELS[group.displayType],
    valueSummary: group.values.map((value) => value.label).join(', '),
    valueCount: group.values.length,
  })) satisfies OptionGroupColumn[];

  return (
    <Page>
      <OptionGroupClient data={formattedOptionGroups} />
    </Page>
  );
};

export default OptionGroupsPage;
