import { describe, expect, it } from 'vitest';

import { getOrderItemText } from '@/lib/variant-label';

describe('getOrderItemText', () => {
  it('shows a default-variant item as the plain product name', () => {
    expect(getOrderItemText({ productName: 'Muslino merliukas', options: [] })).toBe('Muslino merliukas');
  });

  it('appends the variant label after an en dash, with group names joined by a middle dot in snapshot order', () => {
    const text = getOrderItemText({
      productName: 'Muslino merliukas „Meškiukai“',
      options: [
        { name: 'Dydis', value: '0–6 mėn.' },
        { name: 'Spalva', value: 'Šalavijų' },
      ],
    });

    expect(text).toBe('Muslino merliukas „Meškiukai“ – Dydis: 0–6 mėn. · Spalva: Šalavijų');
  });

  it('keeps the snapshot group order instead of sorting', () => {
    const text = getOrderItemText({
      productName: 'Kepurė',
      options: [
        { name: 'Spalva', value: 'Pilka' },
        { name: 'Dydis', value: 'S' },
      ],
    });

    expect(text).toBe('Kepurė – Spalva: Pilka · Dydis: S');
  });

  it('falls back to the product name when the options snapshot is malformed', () => {
    expect(getOrderItemText({ productName: 'Kepurė', options: { name: 'Dydis' } })).toBe('Kepurė');
  });
});
