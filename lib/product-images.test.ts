import { describe, expect, it } from 'vitest';

import {
  getImageTagOptions,
  IMAGE_TAG_NOT_USED_MESSAGE,
  planImageWrites,
  resolveImageTags,
} from '@/lib/product-images';

const FRONT = { id: 'img-front', url: 'https://cdn/front.jpg', position: 0, optionValueId: null };
const BACK = { id: 'img-back', url: 'https://cdn/back.jpg', position: 1, optionValueId: null };

describe('planImageWrites', () => {
  it('writes nothing when the images are saved unchanged', () => {
    const plan = planImageWrites({
      existing: [FRONT, BACK],
      submitted: [
        { id: FRONT.id, url: FRONT.url },
        { id: BACK.id, url: BACK.url },
      ],
    });

    expect(plan).toEqual({ creates: [], updates: [], deleteIds: [] });
  });

  it('updates the positions of reordered images and keeps their rows', () => {
    const plan = planImageWrites({
      existing: [FRONT, BACK],
      submitted: [
        { id: BACK.id, url: BACK.url },
        { id: FRONT.id, url: FRONT.url },
      ],
    });

    expect(plan).toEqual({
      creates: [],
      updates: [
        { id: 'img-back', url: 'https://cdn/back.jpg', position: 0, optionValueId: null },
        { id: 'img-front', url: 'https://cdn/front.jpg', position: 1, optionValueId: null },
      ],
      deleteIds: [],
    });
  });

  it('creates new images at their position and deletes removed ones', () => {
    const plan = planImageWrites({
      existing: [FRONT, BACK],
      submitted: [{ url: 'https://cdn/side.jpg' }, { id: FRONT.id, url: FRONT.url }],
    });

    expect(plan).toEqual({
      creates: [{ url: 'https://cdn/side.jpg', position: 0, optionValueId: null }],
      updates: [{ id: 'img-front', url: 'https://cdn/front.jpg', position: 1, optionValueId: null }],
      deleteIds: ['img-back'],
    });
  });

  it("creates a new row for an id that isn't one of the product's images or was already used", () => {
    const plan = planImageWrites({
      existing: [FRONT],
      submitted: [
        { id: FRONT.id, url: FRONT.url },
        { id: FRONT.id, url: FRONT.url },
        { id: 'other-product-image', url: 'https://cdn/other.jpg' },
      ],
    });

    expect(plan).toEqual({
      creates: [
        { url: 'https://cdn/front.jpg', position: 1, optionValueId: null },
        { url: 'https://cdn/other.jpg', position: 2, optionValueId: null },
      ],
      updates: [],
      deleteIds: [],
    });
  });

  it('creates new images with their tag and updates a kept image whose tag changed', () => {
    const plan = planImageWrites({
      existing: [FRONT, { ...BACK, optionValueId: 'value-oat' }],
      submitted: [
        { id: FRONT.id, url: FRONT.url, optionValueId: 'value-sage' },
        { id: BACK.id, url: BACK.url, optionValueId: 'value-oat' },
        { url: 'https://cdn/side.jpg', optionValueId: 'value-oat' },
      ],
    });

    expect(plan).toEqual({
      creates: [{ url: 'https://cdn/side.jpg', position: 2, optionValueId: 'value-oat' }],
      updates: [{ id: 'img-front', url: 'https://cdn/front.jpg', position: 0, optionValueId: 'value-sage' }],
      deleteIds: [],
    });
  });

  it('clears the tag of a kept image submitted without one', () => {
    const plan = planImageWrites({
      existing: [{ ...FRONT, optionValueId: 'value-oat' }],
      submitted: [{ id: FRONT.id, url: FRONT.url }],
    });

    expect(plan.updates).toEqual([{ id: 'img-front', url: 'https://cdn/front.jpg', position: 0, optionValueId: null }]);
  });
});

describe('resolveImageTags', () => {
  it('keeps tags on values the product uses and leaves untagged images alone', () => {
    const result = resolveImageTags({
      images: [{ id: FRONT.id, url: FRONT.url, optionValueId: 'value-oat' }, { url: BACK.url }],
      usedValueIds: ['value-oat', 'value-sage'],
      serverIdBySubmittedId: new Map(),
    });

    expect(result).toEqual({
      isValid: true,
      images: [
        { id: 'img-front', url: 'https://cdn/front.jpg', optionValueId: 'value-oat' },
        { url: 'https://cdn/back.jpg', optionValueId: null },
      ],
    });
  });

  it('rejects a tag on a value no active variant uses', () => {
    const result = resolveImageTags({
      images: [{ url: FRONT.url, optionValueId: 'value-from-other-product' }],
      usedValueIds: ['value-oat'],
      serverIdBySubmittedId: new Map(),
    });

    expect(result).toEqual({ isValid: false, message: IMAGE_TAG_NOT_USED_MESSAGE });
  });

  it("tags a new product group value by its server id, not the form's temporary id", () => {
    const result = resolveImageTags({
      images: [{ url: FRONT.url, optionValueId: 'temp-value-stripes' }],
      usedValueIds: ['server-value-stripes'],
      serverIdBySubmittedId: new Map([['temp-value-stripes', 'server-value-stripes']]),
    });

    expect(result).toEqual({
      isValid: true,
      images: [{ url: 'https://cdn/front.jpg', optionValueId: 'server-value-stripes' }],
    });
  });
});

describe('getImageTagOptions', () => {
  const COLOR = {
    name: 'Spalva',
    values: [
      { id: 'value-oat', label: 'Avižų' },
      { id: 'value-sage', label: 'Šalavijų' },
      { id: 'value-rose', label: 'Rožių' },
    ],
  };
  const SIZE = {
    name: 'Dydis',
    values: [
      { id: 'value-newborn', label: '0–6 mėn.' },
      { id: 'value-baby', label: '6–12 mėn.' },
    ],
  };

  it('offers the values active variants use, labelled with their group, in group and value order', () => {
    const options = getImageTagOptions({
      groups: [COLOR, SIZE],
      variants: [
        { optionValueIds: ['value-sage', 'value-baby'], isArchived: false },
        { optionValueIds: ['value-oat', 'value-baby'], isArchived: false },
        { optionValueIds: ['value-rose', 'value-newborn'], isArchived: true },
      ],
    });

    expect(options).toEqual([
      { id: 'value-oat', label: 'Spalva: Avižų' },
      { id: 'value-sage', label: 'Spalva: Šalavijų' },
      { id: 'value-baby', label: 'Dydis: 6–12 mėn.' },
    ]);
  });

  it('offers nothing for a product without options', () => {
    expect(getImageTagOptions({ groups: [], variants: [{ optionValueIds: [], isArchived: false }] })).toEqual([]);
  });
});
