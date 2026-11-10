import { createHash, timingSafeEqual } from 'node:crypto';

const AUTHORIZATION_HEADER = 'authorization';
const BEARER_PREFIX = 'Bearer ';
const TOKEN_PARAM = 'token';

type IsCronRequestAuthorizedOptions = {
  req: Request;
  secret: string | undefined;
};

export const isCronRequestAuthorized = ({ req, secret }: IsCronRequestAuthorizedOptions): boolean => {
  if (!secret) {
    return false;
  }

  const authorization = req.headers.get(AUTHORIZATION_HEADER);

  if (authorization?.startsWith(BEARER_PREFIX)) {
    return isSecretMatch({ candidate: authorization.slice(BEARER_PREFIX.length), secret });
  }

  const token = new URL(req.url).searchParams.get(TOKEN_PARAM);

  if (token === null) {
    return false;
  }

  return isSecretMatch({ candidate: token, secret });
};

const isSecretMatch = ({ candidate, secret }: { candidate: string; secret: string }) =>
  timingSafeEqual(hash(candidate), hash(secret));

const hash = (value: string) => createHash('sha256').update(value).digest();
