type SupportedEncoding = "utf8" | "base64";

interface MinimalBuffer {
  from(input: string, encoding: SupportedEncoding): { toString(encoding: SupportedEncoding): string };
}

interface GlobalWithBuffer {
  Buffer?: MinimalBuffer;
}

export function encodeBase64(value: string): string {
  if (typeof btoa === "function") {
    return btoa(value);
  }

  const nodeBuffer = getNodeBuffer();
  if (nodeBuffer) {
    return nodeBuffer.from(value, "utf8").toString("base64");
  }

  throw new Error("Base64 encoding is not supported in the current runtime.");
}

export function decodeBase64(value: string): string {
  if (typeof atob === "function") {
    return atob(value);
  }

  const nodeBuffer = getNodeBuffer();
  if (nodeBuffer) {
    return nodeBuffer.from(value, "base64").toString("utf8");
  }

  throw new Error("Base64 decoding is not supported in the current runtime.");
}

function getNodeBuffer(): MinimalBuffer | undefined {
  if (typeof globalThis !== "object") {
    return undefined;
  }

  const globalWithBuffer = globalThis as GlobalWithBuffer;
  return globalWithBuffer.Buffer;
}
