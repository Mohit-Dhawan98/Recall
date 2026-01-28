/**
 * Documentation Link Validation Tests
 *
 * Run with: node extension/tests/links.test.js
 *
 * Test Categories:
 * - Base: File existence and readability
 * - Normal: Link validity, required sections
 * - Edge: Anchors, URL format, circular references
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..', '..');

const results = {
  passed: 0,
  failed: 0,
  errors: []
};

function test(name, fn) {
  try {
    fn();
    results.passed++;
    console.log(`✓ ${name}`);
  } catch (error) {
    results.failed++;
    results.errors.push({ name, error: error.message });
    console.log(`✗ ${name}`);
    console.log(`  Error: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function extractMarkdownLinks(content) {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const links = [];
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    links.push({
      text: match[1],
      url: match[2]
    });
  }
  return links;
}

function extractHeadings(content) {
  const headingRegex = /^#{1,6}\s+(.+)$/gm;
  const headings = [];
  let match;
  while ((match = headingRegex.exec(content)) !== null) {
    // Convert heading to anchor format (lowercase, spaces to hyphens)
    const anchor = match[1]
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
    headings.push(anchor);
  }
  return headings;
}

function isRelativeLink(url) {
  return !url.startsWith('http://') &&
         !url.startsWith('https://') &&
         !url.startsWith('mailto:') &&
         !url.startsWith('#') &&
         !url.startsWith('chrome://');
}

function isAnchorLink(url) {
  return url.startsWith('#');
}

function isExternalUrl(url) {
  return url.startsWith('http://') || url.startsWith('https://');
}

// Load files
const extensionReadmePath = path.join(ROOT_DIR, 'extension', 'README.md');
const selfHostingPath = path.join(ROOT_DIR, 'docs', 'SELF_HOSTING.md');

let extensionReadme, selfHostingDocs;

try {
  extensionReadme = fs.readFileSync(extensionReadmePath, 'utf8');
} catch (error) {
  console.error('Failed to read extension README:', error.message);
  process.exit(1);
}

try {
  selfHostingDocs = fs.readFileSync(selfHostingPath, 'utf8');
} catch (error) {
  console.error('Failed to read SELF_HOSTING.md:', error.message);
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════
// BASE CASES - File existence
// ═══════════════════════════════════════════════════════════════
console.log('\n=== BASE CASES ===\n');

test('[BASE] extension/README.md exists', () => {
  assert(fs.existsSync(extensionReadmePath), 'File should exist');
});

test('[BASE] extension/README.md is readable', () => {
  assert(extensionReadme.length > 0, 'README should not be empty');
});

test('[BASE] docs/SELF_HOSTING.md exists', () => {
  assert(fs.existsSync(selfHostingPath), 'File should exist');
});

test('[BASE] docs/SELF_HOSTING.md is readable', () => {
  assert(selfHostingDocs.length > 0, 'SELF_HOSTING.md should not be empty');
});

// ═══════════════════════════════════════════════════════════════
// NORMAL CASES - Standard validation
// ═══════════════════════════════════════════════════════════════
console.log('\n=== NORMAL CASES ===\n');

test('[NORMAL] extension/README.md relative links are valid', () => {
  const links = extractMarkdownLinks(extensionReadme);
  const relativeLinks = links.filter(l => isRelativeLink(l.url));
  const brokenLinks = [];

  for (const link of relativeLinks) {
    // Handle links with anchors (e.g., file.md#section)
    const urlWithoutAnchor = link.url.split('#')[0];
    if (urlWithoutAnchor) {
      const absolutePath = path.resolve(path.dirname(extensionReadmePath), urlWithoutAnchor);
      if (!fs.existsSync(absolutePath)) {
        brokenLinks.push(`"${link.text}" -> ${link.url}`);
      }
    }
  }

  assert(brokenLinks.length === 0, `Broken links:\n    ${brokenLinks.join('\n    ')}`);
});

test('[NORMAL] docs/SELF_HOSTING.md relative links are valid', () => {
  const links = extractMarkdownLinks(selfHostingDocs);
  const relativeLinks = links.filter(l => isRelativeLink(l.url));
  const brokenLinks = [];

  for (const link of relativeLinks) {
    const urlWithoutAnchor = link.url.split('#')[0];
    if (urlWithoutAnchor) {
      const absolutePath = path.resolve(path.dirname(selfHostingPath), urlWithoutAnchor);
      if (!fs.existsSync(absolutePath)) {
        brokenLinks.push(`"${link.text}" -> ${link.url}`);
      }
    }
  }

  assert(brokenLinks.length === 0, `Broken links:\n    ${brokenLinks.join('\n    ')}`);
});

test('[NORMAL] extension/README.md has Prerequisites section', () => {
  assert(extensionReadme.includes('## Prerequisites'), 'Should have Prerequisites section');
});

test('[NORMAL] extension/README.md has Installation section', () => {
  assert(extensionReadme.includes('## Installation'), 'Should have Installation section');
});

test('[NORMAL] extension/README.md has Configuration section', () => {
  assert(extensionReadme.includes('## Configuration'), 'Should have Configuration section');
});

test('[NORMAL] extension/README.md has Usage section', () => {
  assert(extensionReadme.includes('## Usage'), 'Should have Usage section');
});

test('[NORMAL] extension/README.md has Troubleshooting section', () => {
  assert(extensionReadme.includes('## Troubleshooting'), 'Should have Troubleshooting section');
});

test('[NORMAL] docs/SELF_HOSTING.md mentions Chrome Extension', () => {
  assert(selfHostingDocs.includes('Chrome Extension'), 'Should mention Chrome Extension');
});

test('[NORMAL] docs/SELF_HOSTING.md links to extension README', () => {
  assert(selfHostingDocs.includes('extension/README.md'), 'Should link to extension README');
});

test('[NORMAL] extension/README.md links to SELF_HOSTING.md', () => {
  assert(extensionReadme.includes('SELF_HOSTING.md'), 'Should link to SELF_HOSTING guide');
});

// ═══════════════════════════════════════════════════════════════
// EDGE CASES - Boundary conditions
// ═══════════════════════════════════════════════════════════════
console.log('\n=== EDGE CASES ===\n');

test('[EDGE] extension/README.md anchor links are valid', () => {
  const links = extractMarkdownLinks(extensionReadme);
  const anchorLinks = links.filter(l => isAnchorLink(l.url));
  const headings = extractHeadings(extensionReadme);
  const brokenAnchors = [];

  for (const link of anchorLinks) {
    const anchor = link.url.substring(1); // Remove leading #
    if (!headings.includes(anchor)) {
      brokenAnchors.push(`"${link.text}" -> ${link.url}`);
    }
  }

  // Only fail if there are anchor links and some are broken
  if (anchorLinks.length > 0) {
    assert(brokenAnchors.length === 0, `Broken anchors:\n    ${brokenAnchors.join('\n    ')}`);
  }
});

test('[EDGE] docs/SELF_HOSTING.md anchor links are valid', () => {
  const links = extractMarkdownLinks(selfHostingDocs);
  const anchorLinks = links.filter(l => isAnchorLink(l.url));
  const headings = extractHeadings(selfHostingDocs);
  const brokenAnchors = [];

  for (const link of anchorLinks) {
    const anchor = link.url.substring(1);
    if (!headings.includes(anchor)) {
      brokenAnchors.push(`"${link.text}" -> ${link.url}`);
    }
  }

  if (anchorLinks.length > 0) {
    assert(brokenAnchors.length === 0, `Broken anchors:\n    ${brokenAnchors.join('\n    ')}`);
  }
});

test('[EDGE] external URLs use HTTPS (security)', () => {
  const allContent = extensionReadme + selfHostingDocs;
  const links = extractMarkdownLinks(allContent);
  const externalLinks = links.filter(l => isExternalUrl(l.url));
  const httpLinks = externalLinks.filter(l =>
    l.url.startsWith('http://') &&
    !l.url.includes('localhost') &&
    !l.url.includes('127.0.0.1')
  );

  // Warning: external non-localhost links should use HTTPS
  if (httpLinks.length > 0) {
    console.log(`  Warning: Found ${httpLinks.length} non-HTTPS external links`);
  }
  // Don't fail, just warn
});

test('[EDGE] no empty link text', () => {
  const allContent = extensionReadme + selfHostingDocs;
  const links = extractMarkdownLinks(allContent);
  const emptyTextLinks = links.filter(l => l.text.trim() === '');

  assert(emptyTextLinks.length === 0,
    `Found links with empty text: ${emptyTextLinks.map(l => l.url).join(', ')}`);
});

test('[EDGE] no duplicate headings in extension/README.md', () => {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const headings = [];
  let match;
  while ((match = headingRegex.exec(extensionReadme)) !== null) {
    headings.push(`${match[1]} ${match[2]}`);
  }

  const seen = new Set();
  const duplicates = [];
  for (const h of headings) {
    if (seen.has(h)) {
      duplicates.push(h);
    }
    seen.add(h);
  }

  assert(duplicates.length === 0, `Duplicate headings: ${duplicates.join(', ')}`);
});

test('[EDGE] code blocks have language specifiers', () => {
  const codeBlockRegex = /```(\w*)\n/g;
  const noLangBlocks = [];
  let match;
  let blockIndex = 0;

  while ((match = codeBlockRegex.exec(extensionReadme)) !== null) {
    blockIndex++;
    if (!match[1]) {
      noLangBlocks.push(blockIndex);
    }
  }

  // Warning only, don't fail
  if (noLangBlocks.length > 0) {
    console.log(`  Warning: ${noLangBlocks.length} code blocks without language specifiers`);
  }
});

test('[EDGE] no TODO or FIXME markers left in docs', () => {
  const allContent = extensionReadme + selfHostingDocs;
  const todoRegex = /\b(TODO|FIXME|XXX|HACK)\b/gi;
  const matches = allContent.match(todoRegex);

  assert(!matches, `Found unresolved markers: ${matches?.join(', ')}`);
});

test('[EDGE] keyboard shortcuts are formatted consistently', () => {
  // Check that keyboard shortcuts use backticks
  const shortcutPatterns = [
    /Cmd\+Shift\+S/g,
    /Ctrl\+Shift\+S/g
  ];

  for (const pattern of shortcutPatterns) {
    const matches = extensionReadme.match(pattern);
    if (matches) {
      // Check they're wrapped in backticks
      for (const match of matches) {
        const inBackticks = extensionReadme.includes(`\`${match}\``);
        assert(inBackticks, `Keyboard shortcut "${match}" should be in backticks`);
      }
    }
  }
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════
console.log('\n=== Test Summary ===\n');
console.log(`Passed: ${results.passed}`);
console.log(`Failed: ${results.failed}`);

if (results.failed > 0) {
  console.log('\nFailed tests:');
  results.errors.forEach(({ name, error }) => {
    console.log(`  - ${name}: ${error}`);
  });
  process.exit(1);
}

console.log('\nAll tests passed!');
process.exit(0);
