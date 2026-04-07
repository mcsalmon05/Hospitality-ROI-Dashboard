const { parse } = require('node-html-parser');
const fs = require('fs');

const html = fs.readFileSync('public/index.html', 'utf8');
const root = parse(html);

// Find elements with unclosed tags (node-html-parser handles this roughly)
// A better way is to use a strict SAX parser.
