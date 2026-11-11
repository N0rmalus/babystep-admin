import { describe, expect, it } from 'vitest';

import { isCloudinaryImageUrl } from '@/lib/cloudinary-url';

describe('isCloudinaryImageUrl', () => {
  it('accepts an image from the store cloud', () => {
    expect(isCloudinaryImageUrl('https://res.cloudinary.com/ddiwjqltw/image/upload/v1/babystep/muslin.jpg')).toBe(true);
  });

  it.each([
    ['another cloud', 'https://res.cloudinary.com/othercloud/image/upload/a.jpg'],
    ['plain http', 'http://res.cloudinary.com/ddiwjqltw/image/upload/a.jpg'],
    ['another host', 'https://evil.example/ddiwjqltw/a.jpg'],
    ['a look-alike host', 'https://res.cloudinary.com.evil.example/ddiwjqltw/a.jpg'],
    ['a path that climbs out of the cloud', 'https://res.cloudinary.com/ddiwjqltw/../othercloud/a.jpg'],
    ['an encoded climb out of the cloud', 'https://res.cloudinary.com/ddiwjqltw/%2e%2e/othercloud/a.jpg'],
    ['a javascript URL', 'javascript:alert(1)'],
    ['an empty string', ''],
  ])('rejects %s', (_, url) => {
    expect(isCloudinaryImageUrl(url)).toBe(false);
  });
});
