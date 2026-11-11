import { z } from 'zod';

const CLOUDINARY_ORIGIN = 'https://res.cloudinary.com';
const CLOUDINARY_CLOUD_PATH = '/ddiwjqltw/';
export const CLOUDINARY_IMAGE_URL_PREFIX = `${CLOUDINARY_ORIGIN}${CLOUDINARY_CLOUD_PATH}`;
export const INVALID_IMAGE_URL_MESSAGE = 'Nuotrauka turi būti įkelta per Cloudinary';

// Only images from the store's own Cloudinary cloud. The URL is parsed so `..` segments can't escape the cloud path.
export const isCloudinaryImageUrl = (value: string): boolean => {
  if (!value.startsWith(CLOUDINARY_IMAGE_URL_PREFIX)) {
    return false;
  }

  try {
    const url = new URL(value);

    return url.origin === CLOUDINARY_ORIGIN && url.pathname.startsWith(CLOUDINARY_CLOUD_PATH);
  } catch {
    return false;
  }
};

export const cloudinaryImageUrlSchema = z.string().refine(isCloudinaryImageUrl, INVALID_IMAGE_URL_MESSAGE);
