/**
 * Extension Manifest Validation Tests
 *
 * Run with: node extension/tests/manifest.test.js
 *
 * Test Categories:
 * - Base: JSON validity, required fields
 * - Normal: Version format, permissions, file existence
 * - Edge: SVG restrictions, duplicates, path safety
 */

const fs = require('fs');
const path = require('path');

const EXTENSION_DIR = path.join(__dirname, '..');
const MANIFEST_PATH = path.join(EXTENSION_DIR, 'manifest.json');

// Test results
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

// Load manifest
let manifest;
let rawContent;
try {
  rawContent = fs.readFileSync(MANIFEST_PATH, 'utf8');
  manifest = JSON.parse(rawContent);
} catch (error) {
  console.error('Failed to load manifest.json:', error.message);
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════
// BASE CASES - Fundamental validity
// ═══════════════════════════════════════════════════════════════
console.log('\n=== BASE CASES ===\n');

test('[BASE] manifest.json is valid JSON', () => {
  assert(typeof manifest === 'object', 'Manifest should be a valid object');
  assert(manifest !== null, 'Manifest should not be null');
});

test('[BASE] required field: name exists', () => {
  assert('name' in manifest, 'name field is required');
});

test('[BASE] required field: version exists', () => {
  assert('version' in manifest, 'version field is required');
});

test('[BASE] required field: manifest_version exists', () => {
  assert('manifest_version' in manifest, 'manifest_version field is required');
});

// ═══════════════════════════════════════════════════════════════
// NORMAL CASES - Standard validation
// ═══════════════════════════════════════════════════════════════
console.log('\n=== NORMAL CASES ===\n');

test('[NORMAL] manifest_version is 3', () => {
  assert(manifest.manifest_version === 3, `Expected manifest_version 3, got ${manifest.manifest_version}`);
});

test('[NORMAL] name is non-empty string', () => {
  assert(typeof manifest.name === 'string', 'Name should be a string');
  assert(manifest.name.length > 0, 'Name should not be empty');
  assert(manifest.name.length <= 45, 'Name should be 45 chars or less (Chrome limit)');
});

test('[NORMAL] version matches semver format', () => {
  assert(typeof manifest.version === 'string', 'Version should be a string');
  assert(/^\d+\.\d+\.\d+$/.test(manifest.version), `Version "${manifest.version}" should match X.Y.Z format`);
});

test('[NORMAL] description is non-empty string', () => {
  assert(typeof manifest.description === 'string', 'Description should be a string');
  assert(manifest.description.length > 0, 'Description should not be empty');
  assert(manifest.description.length <= 132, 'Description should be 132 chars or less (Chrome limit)');
});

test('[NORMAL] permissions array exists', () => {
  assert(Array.isArray(manifest.permissions), 'permissions should be an array');
});

test('[NORMAL] required permission: storage', () => {
  assert(manifest.permissions.includes('storage'), 'storage permission is required');
});

test('[NORMAL] required permission: activeTab', () => {
  assert(manifest.permissions.includes('activeTab'), 'activeTab permission is required');
});

test('[NORMAL] action.default_icon is defined', () => {
  assert(manifest.action, 'action field should exist');
  assert(manifest.action.default_icon, 'action.default_icon should be defined');
});

test('[NORMAL] action.default_popup is defined', () => {
  assert(manifest.action.default_popup, 'action.default_popup should be defined');
});

test('[NORMAL] popup file exists', () => {
  const popupPath = path.join(EXTENSION_DIR, manifest.action.default_popup);
  assert(fs.existsSync(popupPath), `Popup file not found: ${manifest.action.default_popup}`);
});

test('[NORMAL] icons field is defined', () => {
  assert(manifest.icons, 'icons field should exist');
  assert(typeof manifest.icons === 'object', 'icons should be an object');
});

test('[NORMAL] background service_worker is defined', () => {
  assert(manifest.background, 'background field should exist');
  assert(manifest.background.service_worker, 'background.service_worker should be defined');
});

test('[NORMAL] service worker file exists', () => {
  const swPath = path.join(EXTENSION_DIR, manifest.background.service_worker);
  assert(fs.existsSync(swPath), `Service worker not found: ${manifest.background.service_worker}`);
});

test('[NORMAL] options_page file exists', () => {
  if (manifest.options_page) {
    const optionsPath = path.join(EXTENSION_DIR, manifest.options_page);
    assert(fs.existsSync(optionsPath), `Options page not found: ${manifest.options_page}`);
  }
});

test('[NORMAL] all action icon files exist', () => {
  const missingFiles = [];

  if (typeof manifest.action.default_icon === 'string') {
    const iconPath = path.join(EXTENSION_DIR, manifest.action.default_icon);
    if (!fs.existsSync(iconPath)) {
      missingFiles.push(manifest.action.default_icon);
    }
  } else if (typeof manifest.action.default_icon === 'object') {
    for (const [size, iconFile] of Object.entries(manifest.action.default_icon)) {
      const iconPath = path.join(EXTENSION_DIR, iconFile);
      if (!fs.existsSync(iconPath)) {
        missingFiles.push(iconFile);
      }
    }
  }

  assert(missingFiles.length === 0, `Missing action icon files: ${missingFiles.join(', ')}`);
});

test('[NORMAL] all manifest icon files exist', () => {
  const missingFiles = [];

  for (const [size, iconFile] of Object.entries(manifest.icons)) {
    const iconPath = path.join(EXTENSION_DIR, iconFile);
    if (!fs.existsSync(iconPath)) {
      missingFiles.push(`${size}px: ${iconFile}`);
    }
  }

  assert(missingFiles.length === 0, `Missing icon files: ${missingFiles.join(', ')}`);
});

// ═══════════════════════════════════════════════════════════════
// EDGE CASES - Boundary conditions and restrictions
// ═══════════════════════════════════════════════════════════════
console.log('\n=== EDGE CASES ===\n');

test('[EDGE] icons field uses PNG format (Chrome requirement)', () => {
  const iconValues = Object.values(manifest.icons);
  const svgIcons = iconValues.filter(v => v.endsWith('.svg'));
  assert(svgIcons.length === 0,
    `Chrome does not support SVG in "icons" field. Found: ${svgIcons.join(', ')}. ` +
    'See: https://developer.chrome.com/docs/extensions/reference/manifest/icons');
});

test('[EDGE] icons includes 128px size (required for Chrome Web Store)', () => {
  assert(manifest.icons['128'], 'icons field must include 128px size for Chrome Web Store');
});

test('[EDGE] no duplicate permissions', () => {
  const uniquePerms = new Set(manifest.permissions);
  assert(uniquePerms.size === manifest.permissions.length,
    `Duplicate permissions found. Unique: ${uniquePerms.size}, Total: ${manifest.permissions.length}`);
});

test('[EDGE] no empty string values in top-level fields', () => {
  const emptyFields = [];
  for (const [key, value] of Object.entries(manifest)) {
    if (value === '') {
      emptyFields.push(key);
    }
  }
  assert(emptyFields.length === 0, `Empty string values found in: ${emptyFields.join(', ')}`);
});

test('[EDGE] no path traversal in file references', () => {
  const unsafePaths = [];

  // Check action icons
  if (typeof manifest.action.default_icon === 'string') {
    if (manifest.action.default_icon.includes('..')) {
      unsafePaths.push(manifest.action.default_icon);
    }
  } else if (typeof manifest.action.default_icon === 'object') {
    for (const iconFile of Object.values(manifest.action.default_icon)) {
      if (iconFile.includes('..')) {
        unsafePaths.push(iconFile);
      }
    }
  }

  // Check manifest icons
  for (const iconFile of Object.values(manifest.icons)) {
    if (iconFile.includes('..')) {
      unsafePaths.push(iconFile);
    }
  }

  // Check other file paths
  if (manifest.action.default_popup?.includes('..')) {
    unsafePaths.push(manifest.action.default_popup);
  }
  if (manifest.background?.service_worker?.includes('..')) {
    unsafePaths.push(manifest.background.service_worker);
  }
  if (manifest.options_page?.includes('..')) {
    unsafePaths.push(manifest.options_page);
  }

  assert(unsafePaths.length === 0, `Path traversal found in: ${unsafePaths.join(', ')}`);
});

test('[EDGE] host_permissions uses valid URL patterns', () => {
  if (manifest.host_permissions) {
    const invalidPatterns = [];
    const validPatterns = [
      /^<all_urls>$/,
      /^\*:\/\/\*\/.*$/,
      /^https?:\/\/[^/]+\/.*$/,
      /^\*:\/\/[^/]+\/.*$/
    ];

    for (const pattern of manifest.host_permissions) {
      const isValid = validPatterns.some(regex => regex.test(pattern));
      if (!isValid) {
        invalidPatterns.push(pattern);
      }
    }

    assert(invalidPatterns.length === 0,
      `Invalid host_permissions patterns: ${invalidPatterns.join(', ')}`);
  }
});

test('[EDGE] commands have valid keyboard shortcuts', () => {
  if (manifest.commands) {
    for (const [name, cmd] of Object.entries(manifest.commands)) {
      if (cmd.suggested_key) {
        // Check for valid modifier keys
        const validModifiers = ['Ctrl', 'Alt', 'Shift', 'Command', 'MacCtrl'];
        for (const [platform, shortcut] of Object.entries(cmd.suggested_key)) {
          if (shortcut) {
            const parts = shortcut.split('+');
            // Last part should be a key, others should be modifiers
            const modifiers = parts.slice(0, -1);
            const invalidMods = modifiers.filter(m => !validModifiers.includes(m));
            assert(invalidMods.length === 0,
              `Command "${name}" has invalid modifiers: ${invalidMods.join(', ')}`);
          }
        }
      }
    }
  }
});

test('[EDGE] icon sizes are valid Chrome sizes', () => {
  const validSizes = ['16', '32', '48', '128'];
  const invalidSizes = Object.keys(manifest.icons).filter(size => !validSizes.includes(size));
  assert(invalidSizes.length === 0,
    `Invalid icon sizes: ${invalidSizes.join(', ')}. Valid sizes are: ${validSizes.join(', ')}`);
});

test('[EDGE] no BOM or invalid characters in manifest', () => {
  // Check for BOM
  assert(!rawContent.startsWith('\uFEFF'), 'Manifest contains BOM (byte order mark)');
  // Check for null bytes
  assert(!rawContent.includes('\0'), 'Manifest contains null bytes');
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
