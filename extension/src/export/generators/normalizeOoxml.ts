// REQ-EXP-013 AC-02: make the OOXML containers byte-reproducible.
//
// docx, xlsx and pptx are zip archives, and two things in them come from the
// wall clock no matter what the document says:
//
//   * `docProps/core.xml` carries dcterms:created and dcterms:modified. The
//     `docx` library hardcodes `new Date()` in its TimestampElement and exposes
//     no option to override it.
//   * every zip entry carries a DOS date-time stamp, defaulted by JSZip to the
//     moment of packing. Measured: all 22 docx entries, all 17 xlsx entries and
//     all 65 pptx entries differ between two runs seconds apart.
//
// Neither is content. Rewriting both from the specification's own derived date
// leaves the document identical in every respect a reader can see, while making
// the bytes reproducible — which is what makes an export an audit artifact
// rather than a printout.
//
// Verified by construction: after normalisation the part list is unchanged, the
// only part whose bytes differ is docProps/core.xml, and the results still open
// in their respective readers.

import JSZip from 'jszip';

/** W3CDTF, the form OOXML core properties use. */
function w3cdtf(date: Date): string {
  return `${date.toISOString().slice(0, 19)}Z`;
}

/**
 * Rewrite an OOXML container so identical content yields identical bytes.
 *
 * Entry order is sorted and every entry's date is pinned, so nothing in the
 * archive depends on when it was packed.
 */
export async function normalizeOoxml(buffer: Buffer, date: Date): Promise<Buffer> {
  const source = await JSZip.loadAsync(buffer);
  const stamp = w3cdtf(date);

  const names = Object.keys(source.files).sort();
  const out = new JSZip();

  for (const name of names) {
    const entry = source.files[name];

    if (entry.dir) {
      // `folder(name)` creates the entry with no date, so it defaults to the
      // clock — which left four directory entries varying between runs while
      // the eighteen file entries were correctly pinned.
      out.file(name, '', { date, dir: true, createFolders: false });
      continue;
    }

    let content = await entry.async('nodebuffer');

    if (name === 'docProps/core.xml') {
      // The only part whose bytes we change, and only its two timestamps.
      const xml = content
        .toString('utf8')
        .replace(
          /(<dcterms:created[^>]*>)[^<]*(<\/dcterms:created>)/,
          `$1${stamp}$2`
        )
        .replace(
          /(<dcterms:modified[^>]*>)[^<]*(<\/dcterms:modified>)/,
          `$1${stamp}$2`
        );
      content = Buffer.from(xml, 'utf8');
    }

    out.file(name, content, { date, createFolders: false });
  }

  return out.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    // Pinned so the deflate output cannot vary with a library default.
    compressionOptions: { level: 6 },
  });
}
