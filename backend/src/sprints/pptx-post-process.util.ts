import JSZip from 'jszip';

// pptxgenjs has zero support for slide transitions (verified against its source/types — not a
// single mention of "transition" anywhere in the package). The only way to add one is to inject
// the raw OOXML <p:transition> element into each slide's XML after pptxgenjs has finished
// building the file. Per the OOXML schema, <p:transition> is an optional child of <p:sld> that
// comes after <p:cSld> and <p:clrMapOvr> (if present) — inserting it immediately before the
// slide's closing </p:sld> tag is correct regardless of whether clrMapOvr is present, since
// pptxgenjs never emits anything after it.
export async function applySlideTransitions(buffer: Buffer, transitionXml: string): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name));

  for (const name of slideFiles) {
    const xml = await zip.file(name)!.async('string');
    const withTransition = xml.replace(/<\/p:sld>\s*$/, `${transitionXml}</p:sld>`);
    zip.file(name, withTransition);
  }

  return zip.generateAsync({ type: 'nodebuffer' });
}
