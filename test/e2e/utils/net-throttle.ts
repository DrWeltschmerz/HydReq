import type { Page } from "@playwright/test";

export async function throttleNetwork(
  page: Page,
  opts?: {
    latencyMs?: number;
    downloadKbps?: number;
    uploadKbps?: number;
  }
) {
  const latency = opts?.latencyMs ?? 300;
  const downloadKbps = opts?.downloadKbps ?? 750;
  const uploadKbps = opts?.uploadKbps ?? 256;

  // Chromium-only CDP emulation; other browsers will no-op
  try {
    const client = await (page.context() as any).newCDPSession(page);
    await client.send("Network.enable");
    // Convert kbps to bytes/sec
    const toBps = (kbps: number) => Math.max(1, Math.floor((kbps * 1024) / 8));
    await client.send("Network.emulateNetworkConditions", {
      offline: false,
      latency,
      downloadThroughput: toBps(downloadKbps),
      uploadThroughput: toBps(uploadKbps),
    });
  } catch (_e) {
    // Best-effort only; ignore when CDP is not available
  }
}
