import JSZip from 'jszip';
import { applySlideTransitions } from './pptx-post-process.util';

const TRANSITION_XML = '<p:transition spd="med"><p:fade/></p:transition>';

async function buildFakePptx(slideXmls: string[]): Promise<Buffer> {
  const zip = new JSZip();
  slideXmls.forEach((xml, i) => {
    zip.file(`ppt/slides/slide${i + 1}.xml`, xml);
  });
  // A couple of non-slide entries, to confirm the function only touches slide XML.
  zip.file('ppt/presentation.xml', '<p:presentation/>');
  zip.file('[Content_Types].xml', '<Types/>');
  return zip.generateAsync({ type: 'nodebuffer' });
}

describe('applySlideTransitions', () => {
  it('injects the transition XML immediately before the closing </p:sld> tag', async () => {
    const slideWithClrMapOvr =
      '<?xml version="1.0"?><p:sld><p:cSld><p:spTree/></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>';
    const buffer = await buildFakePptx([slideWithClrMapOvr]);

    const result = await applySlideTransitions(buffer, TRANSITION_XML);

    const zip = await JSZip.loadAsync(result);
    const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
    expect(xml).toBe(
      '<?xml version="1.0"?><p:sld><p:cSld><p:spTree/></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>' +
      TRANSITION_XML +
      '</p:sld>'
    );
  });

  it('works the same when the slide has no <p:clrMapOvr> at all', async () => {
    const slideWithoutClrMapOvr = '<p:sld><p:cSld><p:spTree/></p:cSld></p:sld>';
    const buffer = await buildFakePptx([slideWithoutClrMapOvr]);

    const result = await applySlideTransitions(buffer, TRANSITION_XML);

    const zip = await JSZip.loadAsync(result);
    const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
    expect(xml).toBe(`<p:sld><p:cSld><p:spTree/></p:cSld>${TRANSITION_XML}</p:sld>`);
  });

  it('applies the transition to every slide, not just the first', async () => {
    const buffer = await buildFakePptx([
      '<p:sld><p:cSld/></p:sld>',
      '<p:sld><p:cSld/></p:sld>',
      '<p:sld><p:cSld/></p:sld>',
    ]);

    const result = await applySlideTransitions(buffer, TRANSITION_XML);

    const zip = await JSZip.loadAsync(result);
    for (let i = 1; i <= 3; i++) {
      const xml = await zip.file(`ppt/slides/slide${i}.xml`)!.async('string');
      expect(xml).toContain(TRANSITION_XML);
    }
  });

  it('does not modify non-slide entries in the archive', async () => {
    const buffer = await buildFakePptx(['<p:sld><p:cSld/></p:sld>']);

    const result = await applySlideTransitions(buffer, TRANSITION_XML);

    const zip = await JSZip.loadAsync(result);
    const presentationXml = await zip.file('ppt/presentation.xml')!.async('string');
    expect(presentationXml).toBe('<p:presentation/>');
  });
});
