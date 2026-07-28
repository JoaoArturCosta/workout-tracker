export interface QStashPublishRequest {
  url: string;
  body: { restId: string; token: string };
  delay: `${bigint}s`;
  retries: number;
  deduplicationId: string;
  label: string[];
}

export interface QStashClient {
  publishJSON(
    request: QStashPublishRequest
  ): Promise<{ messageId: string }>;
}

interface PublisherConfig {
  canonicalAppUrl: string;
}

interface PublishRestInput {
  restId: string;
  token: string;
  dueAt: Date;
  now?: Date;
}

export function createRestAlertPublisher(
  client: QStashClient,
  config: PublisherConfig
) {
  const dispatchUrl = new URL(
    "/api/rest-alerts/dispatch",
    ensureTrailingSlash(config.canonicalAppUrl)
  ).toString();

  return {
    async publish(input: PublishRestInput): Promise<{ messageId: string }> {
      const now = input.now ?? new Date();
      const delaySeconds = Math.max(
        0,
        Math.ceil((input.dueAt.getTime() - now.getTime()) / 1000)
      );
      const result = await client.publishJSON({
        url: dispatchUrl,
        body: { restId: input.restId, token: input.token },
        delay: `${BigInt(delaySeconds)}s`,
        retries: 3,
        deduplicationId: input.token.replaceAll("-", ""),
        label: ["rest-alert"],
      });

      return { messageId: result.messageId };
    },
  };
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}
