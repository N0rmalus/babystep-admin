import { describe, expect, it } from 'vitest';

import { generateMissingCombinations, planVariantChanges } from '@/lib/variant-plan';

const SIZE = { id: 'size', valueIds: ['s', 'm'] };
const COLOUR = { id: 'colour', valueIds: ['sage', 'oat'] };

describe('generateMissingCombinations', () => {
  it('creates every combination of the picked values, in group order', () => {
    const combinations = generateMissingCombinations({ groups: [SIZE, COLOUR], variants: [] });

    expect(combinations).toEqual([
      ['s', 'sage'],
      ['s', 'oat'],
      ['m', 'sage'],
      ['m', 'oat'],
    ]);
  });

  it('leaves out combinations that variants already have', () => {
    const variants = [{ optionValueIds: ['sage', 's'] }, { optionValueIds: ['m', 'oat'] }];

    const combinations = generateMissingCombinations({ groups: [SIZE, COLOUR], variants });

    expect(combinations).toEqual([
      ['s', 'oat'],
      ['m', 'sage'],
    ]);
  });

  it('creates nothing without groups or when a group has no picked values', () => {
    expect(generateMissingCombinations({ groups: [], variants: [] })).toEqual([]);
    expect(generateMissingCombinations({ groups: [SIZE, { id: 'colour', valueIds: [] }], variants: [] })).toEqual([]);
  });
});

const GROUPS = [SIZE, COLOUR];

const newVariant = (optionValueIds: string[], overrides = {}) => ({
  optionValueIds,
  sku: null,
  stockCount: 0,
  price: null,
  salePrice: null,
  isArchived: false,
  ...overrides,
});

describe('planVariantChanges', () => {
  it('creates submitted variants with their combination key, SKU, stock and price override', () => {
    const plan = planVariantChanges({
      groups: GROUPS,
      existingVariants: [],
      variants: [
        newVariant(['s', 'sage'], { sku: ' MM-S ', stockCount: 4 }),
        newVariant(['m', 'sage'], { price: 25, salePrice: 20 }),
      ],
    });

    expect(plan).toEqual({
      isValid: true,
      creates: [
        {
          optionValueIds: ['s', 'sage'],
          combinationKey: 's,sage',
          sku: 'MM-S',
          stockCount: 4,
          price: null,
          salePrice: null,
          isArchived: false,
        },
        {
          optionValueIds: ['m', 'sage'],
          combinationKey: 'm,sage',
          sku: null,
          stockCount: 0,
          price: 25,
          salePrice: 20,
          isArchived: false,
        },
      ],
      updates: [],
      deleteIds: [],
      archiveIds: [],
    });
  });

  it('updates existing variants in place and creates only the new combinations', () => {
    const plan = planVariantChanges({
      groups: GROUPS,
      existingVariants: [{ id: 'v-s-sage', combinationKey: 's,sage', isArchived: false, hasOrders: true }],
      variants: [
        { ...newVariant(['s', 'sage'], { sku: 'MM-S', stockCount: 7 }), id: 'v-s-sage' },
        newVariant(['m', 'sage']),
      ],
    });

    expect(plan).toMatchObject({
      isValid: true,
      creates: [{ combinationKey: 'm,sage' }],
      updates: [{ id: 'v-s-sage', combinationKey: 's,sage', sku: 'MM-S', stockCount: 7 }],
      deleteIds: [],
      archiveIds: [],
    });
  });

  it('deletes left-out variants, archiving instead the ones that have orders', () => {
    const plan = planVariantChanges({
      groups: GROUPS,
      existingVariants: [
        { id: 'v-s-sage', combinationKey: 's,sage', isArchived: false, hasOrders: false },
        { id: 'v-m-sage', combinationKey: 'm,sage', isArchived: false, hasOrders: true },
        { id: 'v-s-oat', combinationKey: 'oat,s', isArchived: true, hasOrders: true },
        { id: 'v-m-oat', combinationKey: 'm,oat', isArchived: false, hasOrders: false },
      ],
      variants: [{ ...newVariant(['m', 'oat']), id: 'v-m-oat' }],
    });

    expect(plan).toMatchObject({ isValid: true, deleteIds: ['v-s-sage'], archiveIds: ['v-m-sage'] });
  });

  it('reuses an existing variant with the same combination instead of creating a duplicate', () => {
    const plan = planVariantChanges({
      groups: GROUPS,
      existingVariants: [
        { id: 'v-s-sage', combinationKey: 's,sage', isArchived: true, hasOrders: true },
        { id: 'v-m-sage', combinationKey: 'm,sage', isArchived: false, hasOrders: false },
      ],
      variants: [newVariant(['sage', 's'], { stockCount: 3 }), newVariant(['m', 'sage'])],
    });

    expect(plan).toMatchObject({
      isValid: true,
      creates: [],
      updates: [
        { id: 'v-s-sage', combinationKey: 's,sage', stockCount: 3 },
        { id: 'v-m-sage', combinationKey: 'm,sage' },
      ],
      deleteIds: [],
      archiveIds: [],
    });
  });

  it('rejects more than 3 option groups', () => {
    const groups = ['a', 'b', 'c', 'd'].map((id) => ({ id, valueIds: [`${id}-1`] }));

    const plan = planVariantChanges({
      groups,
      existingVariants: [],
      variants: [newVariant(['a-1', 'b-1', 'c-1', 'd-1'])],
    });

    expect(plan).toEqual({ isValid: false, message: 'Prekė gali turėti ne daugiau kaip 3 savybes' });
  });

  it('rejects a variant that does not have exactly one value from each group', () => {
    const message = 'Kiekvienas variantas turi turėti po vieną kiekvienos savybės reikšmę';
    const plan = (optionValueIds: string[]) =>
      planVariantChanges({ groups: GROUPS, existingVariants: [], variants: [newVariant(optionValueIds)] });

    expect(plan(['s'])).toEqual({ isValid: false, message });
    expect(plan(['s', 'm'])).toEqual({ isValid: false, message });
    expect(plan(['s', 'sage', 'oat'])).toEqual({ isValid: false, message });
    expect(plan(['s', 'unknown'])).toEqual({ isValid: false, message });
  });

  it('rejects the same combination twice, whatever the value order', () => {
    const plan = planVariantChanges({
      groups: GROUPS,
      existingVariants: [{ id: 'v-s-sage', combinationKey: 's,sage', isArchived: false, hasOrders: false }],
      variants: [{ ...newVariant(['s', 'sage']), id: 'v-s-sage' }, newVariant(['sage', 's'])],
    });

    expect(plan).toEqual({
      isValid: false,
      message: 'Toks reikšmių derinys jau yra. Kiekvienas derinys gali būti tik vieną kartą.',
    });
  });

  it('rejects the same SKU on two variants, ignoring surrounding spaces', () => {
    const plan = planVariantChanges({
      groups: GROUPS,
      existingVariants: [],
      variants: [
        newVariant(['s', 'sage'], { sku: 'MM-1' }),
        newVariant(['m', 'sage'], { sku: ' MM-1 ' }),
        newVariant(['s', 'oat'], { sku: '' }),
        newVariant(['m', 'oat'], { sku: '  ' }),
      ],
    });

    expect(plan).toEqual({ isValid: false, message: 'SKU „MM-1“ kartojasi keliuose variantuose' });
  });

  it('allows variants without SKU', () => {
    const plan = planVariantChanges({
      groups: GROUPS,
      existingVariants: [],
      variants: [newVariant(['s', 'oat'], { sku: '' }), newVariant(['m', 'oat'], { sku: '  ' })],
    });

    expect(plan).toMatchObject({ isValid: true, creates: [{ sku: null }, { sku: null }] });
  });

  it('validates price overrides like product prices: inherit both or override both', () => {
    const plan = (prices: { price: number | null; salePrice: number | null }) =>
      planVariantChanges({ groups: GROUPS, existingVariants: [], variants: [newVariant(['s', 'sage'], prices)] });

    expect(plan({ price: null, salePrice: 10 })).toEqual({
      isValid: false,
      message: 'Akcijos kainą galima nurodyti tik kartu su varianto kaina',
    });
    expect(plan({ price: 0, salePrice: null })).toEqual({ isValid: false, message: 'Reikalinga teigiama kaina' });
    expect(plan({ price: 20, salePrice: 20 })).toEqual({
      isValid: false,
      message: 'Akcijos kaina turi būti mažesnė už įprastą kainą',
    });
    expect(plan({ price: 20, salePrice: 0 })).toEqual({
      isValid: false,
      message: 'Akcijos kaina turi būti didesnė už 0',
    });
    expect(plan({ price: 20, salePrice: null })).toMatchObject({ isValid: true });
    expect(plan({ price: null, salePrice: null })).toMatchObject({ isValid: true });
  });

  it('rejects available stock that is not a whole number of at least 0', () => {
    const plan = (stockCount: number) =>
      planVariantChanges({
        groups: GROUPS,
        existingVariants: [],
        variants: [newVariant(['s', 'sage'], { stockCount })],
      });

    expect(plan(-1)).toMatchObject({ isValid: false });
    expect(plan(1.5)).toMatchObject({ isValid: false });
  });

  it('keeps a product without groups on one default variant that uses the product price', () => {
    const existingVariants = [{ id: 'v-s', combinationKey: 's', isArchived: false, hasOrders: true }];
    const plan = (variants: ReturnType<typeof newVariant>[]) =>
      planVariantChanges({ groups: [], existingVariants, variants });

    expect(plan([newVariant([], { sku: 'MM', stockCount: 2 })])).toEqual({
      isValid: true,
      creates: [
        {
          optionValueIds: [],
          combinationKey: '',
          sku: 'MM',
          stockCount: 2,
          price: null,
          salePrice: null,
          isArchived: false,
        },
      ],
      updates: [],
      deleteIds: [],
      archiveIds: ['v-s'],
    });
    expect(plan([])).toEqual({ isValid: false, message: 'Prekė be savybių turi turėti vieną variantą' });
    expect(plan([newVariant([], { price: 10 })])).toEqual({
      isValid: false,
      message: 'Prekė be savybių naudoja prekės kainą',
    });
  });

  it('requires at least one variant once groups are chosen', () => {
    const plan = planVariantChanges({ groups: GROUPS, existingVariants: [], variants: [] });

    expect(plan).toEqual({ isValid: false, message: 'Sugeneruokite bent vieną variantą' });
  });

  it('rejects ids of variants the product does not have, and changing an existing variant combination', () => {
    const existingVariants = [
      { id: 'v-s-sage', combinationKey: 's,sage', isArchived: false, hasOrders: false },
      { id: 'v-m-oat', combinationKey: 'm,oat', isArchived: true, hasOrders: false },
    ];
    const plan = (variant: ReturnType<typeof newVariant> & { id: string }) =>
      planVariantChanges({ groups: GROUPS, existingVariants, variants: [variant] });

    expect(plan({ ...newVariant(['s', 'oat']), id: 'other-product' })).toEqual({
      isValid: false,
      message: 'Variantas šioje prekėje nerastas',
    });
    expect(plan({ ...newVariant(['m', 'oat']), id: 'v-m-oat' })).toEqual({
      isValid: false,
      message: 'Variantas šioje prekėje nerastas',
    });
    expect(plan({ ...newVariant(['m', 'sage']), id: 'v-s-sage' })).toEqual({
      isValid: false,
      message: 'Esamo varianto reikšmių keisti negalima',
    });
  });

  it('archives a single variant the owner archived, freeing its SKU like any archived variant', () => {
    const plan = planVariantChanges({
      groups: GROUPS,
      existingVariants: [
        { id: 'v-s-sage', combinationKey: 's,sage', isArchived: false, hasOrders: false },
        { id: 'v-m-sage', combinationKey: 'm,sage', isArchived: false, hasOrders: false },
      ],
      variants: [
        { ...newVariant(['s', 'sage'], { sku: 'MM-S', stockCount: 2, isArchived: true }), id: 'v-s-sage' },
        { ...newVariant(['m', 'sage']), id: 'v-m-sage' },
      ],
    });

    expect(plan).toMatchObject({
      isValid: true,
      creates: [],
      updates: [
        { id: 'v-s-sage', sku: null, stockCount: 2, isArchived: true },
        { id: 'v-m-sage', isArchived: false },
      ],
      deleteIds: [],
      archiveIds: [],
    });
  });

  it('lets another variant take the SKU of a variant being archived', () => {
    const plan = planVariantChanges({
      groups: GROUPS,
      existingVariants: [{ id: 'v-s-sage', combinationKey: 's,sage', isArchived: false, hasOrders: true }],
      variants: [
        { ...newVariant(['s', 'sage'], { sku: 'MM-1', isArchived: true }), id: 'v-s-sage' },
        newVariant(['m', 'sage'], { sku: 'MM-1' }),
      ],
    });

    expect(plan).toMatchObject({
      isValid: true,
      creates: [{ combinationKey: 'm,sage', sku: 'MM-1' }],
      updates: [{ id: 'v-s-sage', sku: null, isArchived: true }],
    });
  });

  it('rejects archiving the default variant of a product without groups', () => {
    const plan = planVariantChanges({
      groups: [],
      existingVariants: [{ id: 'v-default', combinationKey: '', isArchived: false, hasOrders: false }],
      variants: [{ ...newVariant([], { isArchived: true }), id: 'v-default' }],
    });

    expect(plan).toEqual({ isValid: false, message: 'Prekė be savybių turi turėti aktyvų variantą' });
  });
});

describe('planVariantChanges when editing a product that already has variants', () => {
  const sizeVariants = [
    { id: 'v-s', combinationKey: 's', isArchived: false, hasOrders: true },
    { id: 'v-m', combinationKey: 'm', isArchived: false, hasOrders: false },
  ];
  const keptSizeRows = [
    { ...newVariant(['s'], { stockCount: 3 }), id: 'v-s' },
    { ...newVariant(['m'], { stockCount: 1 }), id: 'v-m' },
  ];

  it('adding a value creates only its combinations on Generate and leaves existing variants alone', () => {
    const groups = [{ id: 'size', valueIds: ['s', 'm', 'l'] }];
    const generated = generateMissingCombinations({ groups, variants: keptSizeRows }).map((ids) => newVariant(ids));

    const plan = planVariantChanges({
      groups,
      existingVariants: sizeVariants,
      variants: [...keptSizeRows, ...generated],
    });

    expect(plan).toMatchObject({
      isValid: true,
      creates: [{ combinationKey: 'l' }],
      updates: [
        { id: 'v-s', stockCount: 3 },
        { id: 'v-m', stockCount: 1 },
      ],
      deleteIds: [],
      archiveIds: [],
    });
  });

  it('removing a value archives its variants that have orders and deletes the rest', () => {
    const existingVariants = [
      { id: 'v-s-sage', combinationKey: 's,sage', isArchived: false, hasOrders: true },
      { id: 'v-s-oat', combinationKey: 'oat,s', isArchived: false, hasOrders: false },
      { id: 'v-m-sage', combinationKey: 'm,sage', isArchived: false, hasOrders: false },
      { id: 'v-m-oat', combinationKey: 'm,oat', isArchived: false, hasOrders: false },
    ];

    const plan = planVariantChanges({
      groups: GROUPS,
      existingVariants,
      variants: [
        { ...newVariant(['s', 'oat']), id: 'v-s-oat' },
        { ...newVariant(['m', 'oat']), id: 'v-m-oat' },
      ],
    });

    expect(plan).toMatchObject({ isValid: true, creates: [], deleteIds: ['v-m-sage'], archiveIds: ['v-s-sage'] });
  });

  it('adding a group replaces every variant, archiving the ones with orders', () => {
    const plan = planVariantChanges({
      groups: GROUPS,
      existingVariants: sizeVariants,
      variants: [newVariant(['s', 'sage']), newVariant(['m', 'sage'])],
    });

    expect(plan).toMatchObject({
      isValid: true,
      creates: [{ combinationKey: 's,sage' }, { combinationKey: 'm,sage' }],
      updates: [],
      deleteIds: ['v-m'],
      archiveIds: ['v-s'],
    });
  });

  it('removing a group replaces every variant, archiving the ones with orders', () => {
    const plan = planVariantChanges({
      groups: [COLOUR],
      existingVariants: [
        { id: 'v-s-sage', combinationKey: 's,sage', isArchived: false, hasOrders: false },
        { id: 'v-m-sage', combinationKey: 'm,sage', isArchived: false, hasOrders: true },
      ],
      variants: [newVariant(['sage'])],
    });

    expect(plan).toMatchObject({
      isValid: true,
      creates: [{ combinationKey: 'sage' }],
      updates: [],
      deleteIds: ['v-s-sage'],
      archiveIds: ['v-m-sage'],
    });
  });

  it('removing all groups leaves exactly one active default variant', () => {
    const plan = planVariantChanges({ groups: [], existingVariants: sizeVariants, variants: [newVariant([])] });

    expect(plan).toMatchObject({
      isValid: true,
      creates: [{ combinationKey: '', isArchived: false }],
      updates: [],
      deleteIds: ['v-m'],
      archiveIds: ['v-s'],
    });
  });

  it('removing all groups restores an archived default variant instead of adding a second one', () => {
    const plan = planVariantChanges({
      groups: [],
      existingVariants: [...sizeVariants, { id: 'v-default', combinationKey: '', isArchived: true, hasOrders: true }],
      variants: [newVariant([], { stockCount: 4 })],
    });

    expect(plan).toMatchObject({
      isValid: true,
      creates: [],
      updates: [{ id: 'v-default', combinationKey: '', stockCount: 4, isArchived: false }],
      deleteIds: ['v-m'],
      archiveIds: ['v-s'],
    });
  });
});
