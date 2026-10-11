import type { AttachmentsConfig } from "@copilotkit/react-core/v2";

export const ACCEPT = "application/pdf,text/plain,text/markdown,.pdf,.txt,.md";
export const MAX_SIZE = 5 * 1024 * 1024;

/** CV upload config for `CopilotChat`; `onError` shows the message inline in the page. */
export function createAttachments(onError: (message: string) => void): AttachmentsConfig {
  return {
    enabled: true,
    accept: ACCEPT,
    maxSize: MAX_SIZE,
    onUploadFailed: (error) => onError(error.message),
  };
}
