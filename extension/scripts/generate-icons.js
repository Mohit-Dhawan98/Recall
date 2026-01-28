#!/usr/bin/env node
/**
 * Generate PNG icons from SVG source
 *
 * Usage: node extension/scripts/generate-icons.js
 *
 * Requires: npx (comes with npm)
 * Uses: sharp-cli (auto-installed via npx)
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const EXTENSION_DIR = path.join(__dirname, '..');
const ICONS_DIR = path.join(EXTENSION_DIR, 'icons');
const SVG_SOURCE = path.join(ICONS_DIR, 'icon.svg');

const SIZES = [16, 32, 48, 128];

console.log('Generating PNG icons from SVG...\n');

// Check SVG exists
if (!fs.existsSync(SVG_SOURCE)) {
  console.error(`Error: SVG source not found at ${SVG_SOURCE}`);
  process.exit(1);
}

let hasErrors = false;

for (const size of SIZES) {
  const outputFile = path.join(ICONS_DIR, `icon${size}.png`);
  console.log(`  Generating ${size}x${size}...`);

  try {
    execSync(
      `npx --yes sharp-cli --input "${SVG_SOURCE}" --output "${outputFile}" resize ${size} ${size}`,
      { stdio: 'pipe', encoding: 'utf8' }
    );
    console.log(`  ✓ Created icon${size}.png`);
  } catch (error) {
    console.error(`  ✗ Failed to create icon${size}.png: ${error.message}`);
    hasErrors = true;
  }
}

console.log('');

if (hasErrors) {
  console.log('Some icons failed to generate. Check errors above.');
  process.exit(1);
} else {
  console.log('All icons generated successfully!');
  console.log(`\nIcon files are in: ${ICONS_DIR}`);
}
