import { expect, test } from "bun:test";
import { ACCEPT, MAX_SIZE, createAttachments } from "./attachments";

test("accepts PDF, TXT and MD up to 5 MB", () => {
  const config = createAttachments(() => {});
  expect(config.enabled).toBe(true);
  expect(config.accept).toBe(ACCEPT);
  expect(ACCEPT.split(",")).toEqual(["application/pdf", "text/plain", "text/markdown", ".pdf", ".txt", ".md"]);
  expect(config.maxSize).toBe(5 * 1024 * 1024);
  expect(MAX_SIZE).toBe(5242880);
  expect(config.onUpload).toBeUndefined();
});

test("upload failures reach the inline error handler", () => {
  const seen: string[] = [];
  const config = createAttachments((m) => seen.push(m));
  config.onUploadFailed?.({ reason: "file-too-large", file: new File(["x"], "cv.pdf"), message: "File is too large" });
  expect(seen).toEqual(["File is too large"]);
});
