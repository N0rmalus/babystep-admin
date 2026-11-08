import { describe, expect, it } from 'vitest';

import { resolveProductGroups } from '@/lib/product-groups';
import { planVariantChanges, TOO_MANY_GROUPS_MESSAGE } from '@/lib/variant-plan';

const SIZE = { id: 'size', valueIds: ['s', 'm'] };

// Hands out predictable server ids: id-1, id-2, ...
const createIdSequence = () => {
  let count = 0;

  return () => {
    count += 1;

    return `id-${count}`;
  };
};

const variant = (optionValueIds: string[]) => ({ optionValueIds, sku: null });

describe('resolveProductGroups', () => {
  it('gives a new product group and its values server ids and rewrites the variants to use them', () => {
    const result = resolveProductGroups({
      optionGroupIds: ['size', 'tmp-style'],
      productGroups: [
        {
          id: 'tmp-style',
          name: 'Stilius',
          values: [
            { id: 'tmp-classic', label: 'Klasikinis' },
            { id: 'tmp-frill', label: 'Su raukiniais' },
          ],
        },
      ],
      variants: [variant(['s', 'tmp-classic']), variant(['m', 'tmp-frill'])],
      storeGroups: [SIZE],
      existingProductGroups: [],
      createId: createIdSequence(),
    });

    expect(result).toEqual({
      isValid: true,
      groupIds: ['size', 'id-1'],
      groups: [SIZE, { id: 'id-1', valueIds: ['id-2', 'id-3'] }],
      variants: [variant(['s', 'id-2']), variant(['m', 'id-3'])],
      serverIdBySubmittedId: new Map([
        ['tmp-style', 'id-1'],
        ['tmp-classic', 'id-2'],
        ['tmp-frill', 'id-3'],
      ]),
      writes: {
        groupCreates: [
          {
            id: 'id-1',
            name: 'Stilius',
            values: [
              { id: 'id-2', label: 'Klasikinis', position: 0 },
              { id: 'id-3', label: 'Su raukiniais', position: 1 },
            ],
          },
        ],
        groupUpdates: [],
        removedGroupIds: [],
        removedValueIds: [],
      },
    });
  });

  it('keeps an existing product group and values, adds new values and lists what the form left out for removal', () => {
    const result = resolveProductGroups({
      optionGroupIds: ['style'],
      productGroups: [
        {
          id: 'style',
          name: 'Modelis',
          values: [
            { id: 'tmp-wrap', label: 'Vokelis' },
            { id: 'classic', label: 'Klasikinis' },
          ],
        },
      ],
      variants: [variant(['classic']), variant(['tmp-wrap'])],
      storeGroups: [],
      existingProductGroups: [
        { id: 'style', valueIds: ['classic', 'frill'] },
        { id: 'fabric', valueIds: ['linen'] },
      ],
      createId: createIdSequence(),
    });

    expect(result).toEqual({
      isValid: true,
      groupIds: ['style'],
      groups: [{ id: 'style', valueIds: ['id-1', 'classic'] }],
      variants: [variant(['classic']), variant(['id-1'])],
      serverIdBySubmittedId: new Map([
        ['style', 'style'],
        ['tmp-wrap', 'id-1'],
        ['classic', 'classic'],
      ]),
      writes: {
        groupCreates: [],
        groupUpdates: [
          {
            id: 'style',
            name: 'Modelis',
            valueCreates: [{ id: 'id-1', label: 'Vokelis', position: 0 }],
            valueUpdates: [{ id: 'classic', label: 'Klasikinis', position: 1 }],
          },
        ],
        removedGroupIds: ['fabric'],
        removedValueIds: ['frill'],
      },
    });
  });

  const resolveWith = (overrides: Partial<Parameters<typeof resolveProductGroups>[0]>) =>
    resolveProductGroups({
      optionGroupIds: [],
      productGroups: [],
      variants: [],
      storeGroups: [SIZE],
      existingProductGroups: [],
      createId: createIdSequence(),
      ...overrides,
    });

  const STYLE = { id: 'tmp-style', name: 'Stilius', values: [{ id: 'tmp-classic', label: 'Klasikinis' }] };

  it('rejects a chosen group that is neither a store-level group of the store nor a submitted product group', () => {
    expect(resolveWith({ optionGroupIds: ['size', 'other-store-group'] })).toEqual({
      isValid: false,
      message: 'Savybė šioje parduotuvėje nerasta',
    });
  });

  it('rejects a product group that is not among the chosen groups', () => {
    expect(resolveWith({ optionGroupIds: ['size'], productGroups: [STYLE] })).toEqual({
      isValid: false,
      message: 'Savybė šioje parduotuvėje nerasta',
    });
  });

  it('rejects a product group or value that reuses a store-level id, so store selections are never remapped', () => {
    const invalid = { isValid: false, message: 'Neteisingi prekės savybės duomenys' };

    expect(
      resolveWith({ optionGroupIds: ['size'], productGroups: [{ ...STYLE, id: 'size' }], variants: [variant(['s'])] }),
    ).toEqual(invalid);
    expect(
      resolveWith({
        optionGroupIds: ['size', 'tmp-style'],
        productGroups: [{ ...STYLE, values: [{ id: 's', label: 'Klasikinis' }] }],
        variants: [variant(['s', 's'])],
      }),
    ).toEqual(invalid);
  });

  it('rejects a group chosen twice', () => {
    expect(resolveWith({ optionGroupIds: ['size', 'size'] })).toEqual({
      isValid: false,
      message: 'Ta pati savybė pasirinkta kelis kartus',
    });
  });

  it('requires a product group name and value labels, and unique labels within the group', () => {
    const chosen = { optionGroupIds: ['tmp-style'] };

    expect(resolveWith({ ...chosen, productGroups: [{ ...STYLE, name: '  ' }] })).toEqual({
      isValid: false,
      message: 'Būtina nurodyti savybės pavadinimą',
    });
    expect(
      resolveWith({ ...chosen, productGroups: [{ ...STYLE, values: [{ id: 'tmp-empty', label: ' ' }] }] }),
    ).toEqual({ isValid: false, message: 'Kiekviena reikšmė turi turėti pavadinimą' });
    expect(
      resolveWith({
        ...chosen,
        productGroups: [
          {
            ...STYLE,
            values: [
              { id: 'tmp-a', label: 'Klasikinis' },
              { id: 'tmp-b', label: 'klasikinis ' },
            ],
          },
        ],
      }),
    ).toEqual({ isValid: false, message: 'Reikšmė „klasikinis“ kartojasi' });
  });

  it('trims the product group name and value labels', () => {
    const result = resolveWith({
      optionGroupIds: ['tmp-style'],
      productGroups: [{ ...STYLE, name: ' Stilius ', values: [{ id: 'tmp-classic', label: ' Klasikinis ' }] }],
    });

    expect(result.isValid && result.writes.groupCreates).toEqual([
      { id: 'id-1', name: 'Stilius', values: [{ id: 'id-2', label: 'Klasikinis', position: 0 }] },
    ]);
  });

  it('counts product groups toward the limit of 3 groups', () => {
    const resolved = resolveProductGroups({
      optionGroupIds: ['size', 'colour', 'tmp-style', 'tmp-fabric'],
      storeGroups: [SIZE, { id: 'colour', valueIds: ['sage'] }],
      productGroups: [STYLE, { id: 'tmp-fabric', name: 'Audinys', values: [{ id: 'tmp-linen', label: 'Linas' }] }],
      variants: [
        {
          ...variant(['s', 'sage', 'tmp-classic', 'tmp-linen']),
          stockCount: 0,
          price: null,
          salePrice: null,
          isArchived: false,
        },
      ],
      existingProductGroups: [],
      createId: createIdSequence(),
    });

    expect(resolved.isValid).toBe(true);
    expect(
      resolved.isValid &&
        planVariantChanges({ groups: resolved.groups, existingVariants: [], variants: resolved.variants }),
    ).toEqual({ isValid: false, message: TOO_MANY_GROUPS_MESSAGE });
  });
});
