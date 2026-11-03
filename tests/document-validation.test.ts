import test from "node:test";
import assert from "node:assert/strict";
import { detectAllowedDocumentMime, MAX_DOCUMENT_BYTES, safeOriginalDocumentName } from "../src/lib/document-validation";

test("document validation accepts matching PDF, JPEG and PNG signatures", () => {
  assert.equal(detectAllowedDocumentMime(Buffer.from("%PDF-1.7"), "application/pdf"), "application/pdf");
  assert.equal(detectAllowedDocumentMime(Buffer.from([0xff, 0xd8, 0xff, 0x00]), "image/jpeg"), "image/jpeg");
  assert.equal(detectAllowedDocumentMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png"), "image/png");
});

test("document validation rejects mismatched MIME declarations and unknown signatures", () => {
  assert.equal(detectAllowedDocumentMime(Buffer.from("%PDF-1.7"), "image/png"), null);
  assert.equal(detectAllowedDocumentMime(Buffer.from("not a document"), "application/pdf"), null);
});

test("document metadata enforces a 15 MB upload ceiling and cleans filenames", () => {
  assert.equal(MAX_DOCUMENT_BYTES, 15 * 1024 * 1024);
  assert.equal(safeOriginalDocumentName("../../passport.pdf"), ".._.._passport.pdf");
  assert.equal(safeOriginalDocumentName("  "), "document");
});
