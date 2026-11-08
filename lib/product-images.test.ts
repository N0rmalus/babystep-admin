import { describe, expect, it } from 'vitest';

import { planImageWrites } from '@/lib/product-images';

const FRONT = { id: 'img-front', url: 'https://cdn/front.jpg', position: 0 };
const BACK = { id: 'img-back', url: 'https://cdn/back.jpg', position: 1 };

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
        { id: 'img-back', url: 'https://cdn/back.jpg', position: 0 },
        { id: 'img-front', url: 'https://cdn/front.jpg', position: 1 },
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
      creates: [{ url: 'https://cdn/side.jpg', position: 0 }],
      updates: [{ id: 'img-front', url: 'https://cdn/front.jpg', position: 1 }],
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
        { url: 'https://cdn/front.jpg', position: 1 },
        { url: 'https://cdn/other.jpg', position: 2 },
      ],
      updates: [],
      deleteIds: [],
    });
  });
});
