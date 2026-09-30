// Builds the published site for Amplify: copies design/ → dist/ (minus internal files)
// and fills the enquiry endpoint into dist/availability.html. Never modifies design/.
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

const SRC = 'design';
const OUT = 'dist';
const EXCLUDE = new Set(['design-book.html', '.DS_Store', 'Thumbs.db']); // design book stays in the repo, not on the site

// `dist/` is a generated, ignored artifact. Clear it first so a local rebuild
// cannot retain removed files or fail when an asset has changed.
if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
cpSync(SRC, OUT, {
  recursive: true,
  filter: (src) => !EXCLUDE.has(basename(src)) && !basename(src).startsWith('._'),
});

// Enquiry endpoint: SV_ENQUIRY_URL env var wins, then amplify_outputs.json (written by the backend deploy).
let url = (process.env.SV_ENQUIRY_URL || '').trim();
if (!url && existsSync('amplify_outputs.json')) {
  try { url = JSON.parse(readFileSync('amplify_outputs.json', 'utf8'))?.custom?.enquiryUrl || ''; } catch { url = ''; }
}
const page = `${OUT}/availability.html`;
const html = readFileSync(page, 'utf8');
const empty = '<meta name="sv-enquiry-url" content="">';
if (!url) {
  console.log('Enquiry endpoint: not set (form works via WhatsApp only).');
} else if (!/^https:\/\/[^\s"<>]+$/.test(url)) {
  console.error(`Enquiry endpoint ignored (not an https URL): ${url}`);
} else if (!html.includes(empty)) {
  console.log('Enquiry endpoint: already set in design/availability.html, left as is.');
} else {
  writeFileSync(page, html.replace(empty, `<meta name="sv-enquiry-url" content="${url}">`));
  console.log(`Enquiry endpoint: ${url}`);
}
console.log(`Built ${OUT}/ from ${SRC}/ (excluded: ${[...EXCLUDE].join(', ')}).`);
