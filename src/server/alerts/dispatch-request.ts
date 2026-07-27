export async function verifyDispatchRequest(
  body: string,
  signature: string | null,
  canonicalUrl: string,
  verify: (input: {
    body: string;
    signature: string;
    url: string;
  }) => Promise<boolean>
): Promise<boolean> {
  if (!signature) {
    return false;
  }
  try {
    return await verify({ body, signature, url: canonicalUrl });
  } catch {
    return false;
  }
}
