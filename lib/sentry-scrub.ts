type ScrubbableEvent = {
  request?: {
    data?: unknown;
    query_string?: unknown;
  };
};

// Request bodies and query strings carry customer contact details, addresses and cron/bypass tokens, so they
// never leave the server. Used as both beforeSend and beforeSendTransaction in every Sentry.init.
export const scrubRequestData = <TEvent extends ScrubbableEvent>(event: TEvent): TEvent => {
  if (!event.request) {
    return event;
  }

  return { ...event, request: { ...event.request, data: undefined, query_string: undefined } };
};
