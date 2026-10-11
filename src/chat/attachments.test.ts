import { expect, test } from "bun:test";
import JSZip from "jszip";
import { ACCEPT, DOCX_MIME, MAX_SIZE, createAttachments, onUpload } from "./attachments";

test("accepts PDF, TXT, MD and DOCX up to 5 MB", () => {
  const config = createAttachments(() => {});
  expect(config.enabled).toBe(true);
  expect(config.accept).toBe(ACCEPT);
  expect(ACCEPT.split(",")).toEqual(["application/pdf", "text/plain", "text/markdown", DOCX_MIME, ".pdf", ".txt", ".md", ".docx"]);
  expect(config.maxSize).toBe(5 * 1024 * 1024);
  expect(MAX_SIZE).toBe(5242880);
  expect(config.onUpload).toBe(onUpload);
});

test("upload failures reach the inline error handler", () => {
  const seen: string[] = [];
  const config = createAttachments((m) => seen.push(m));
  config.onUploadFailed?.({ reason: "file-too-large", file: new File(["x"], "cv.pdf"), message: "File is too large" });
  expect(seen).toEqual(["File is too large"]);
});

async function docx(text: string): Promise<File> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file("_rels/.rels", '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`);
  return new File([await zip.generateAsync({ type: "arraybuffer" })], "cv.docx", { type: DOCX_MIME });
}

test("DOCX is converted to a text/plain data source keeping the filename", async () => {
  const result = await onUpload(await docx("Ada Lovelace, Engineer"));
  expect(result).toEqual({ type: "data", value: btoa("Ada Lovelace, Engineer"), mimeType: "text/plain", metadata: { filename: "cv.docx" } });
});

test("other files pass through unchanged as base64", async () => {
  const bytes = new Uint8Array([37, 80, 68, 70, 0, 255]);
  const result = await onUpload(new File([bytes], "cv.pdf", { type: "application/pdf" }));
  expect(result).toEqual({ type: "data", value: btoa(String.fromCharCode(...bytes)), mimeType: "application/pdf", metadata: { filename: "cv.pdf" } });
});
