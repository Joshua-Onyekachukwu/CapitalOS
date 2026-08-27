#!/usr/bin/env node
/**
 * Design System Standardization v2
 * 
 * Standardizes arbitrary Tailwind values to consistent design tokens:
 * - Border radius: 7px→8px, 10px→8px/12px, 15px→16px, 30px→full
 * - Typography: 15px→16px, 19px→20px, 9px→10px
 * - Spacing: 6px→8px, 10px→8px/12px, 14px→16px, 15px→16px, 25px→24px, 35px→32px
 * 
 * Usage:
 *   node scripts/standardize-design-v2.js [--dry-run]
 */

const fs = require("fs");
const path = require("path");
const glob = require("path");

const DRY_RUN = process.argv.includes("--dry-run");

// Files to process
const TARGET_DIRS = ["src/components", "src/app"];

function findTsxFiles(dir) {
  const files = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        files.push(...findTsxFiles(fullPath));
      } else if (entry.isFile() && (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts"))) {
        files.push(fullPath);
      }
    }
  } catch {}
  return files;
}

// Standardization rules
// Each rule: [pattern, replacement, description]
const RULES = [
  // ═══════════════════════════════════════
  // BORDER RADIUS
  // ═══════════════════════════════════════
  // 7px → 8px (standardize to MD)
  [/rounded-\[7px\]/g, "rounded-[8px]", "radius 7→8"],
  // 4px → 6px (standardize to SM)
  [/rounded-\[4px\]/g, "rounded-[6px]", "radius 4→6"],
  // 10px → 8px (too close to both, pick MD)
  [/rounded-\[10px\]/g, "rounded-[8px]", "radius 10→8"],
  // 15px → 16px (standardize to XL)
  [/rounded-\[15px\]/g, "rounded-[16px]", "radius 15→16"],
  // 30px → 20px (standardize to 2XL)
  [/rounded-\[30px\]/g, "rounded-[20px]", "radius 30→20"],
  // 24px → 20px
  [/rounded-\[24px\]/g, "rounded-[20px]", "radius 24→20"],
  // 60px → 20px
  [/rounded-\[60px\]/g, "rounded-[20px]", "radius 60→20"],

  // ═══════════════════════════════════════
  // TYPOGRAPHY
  // ═══════════════════════════════════════
  // 9px → 10px (minimum usable)
  [/text-\[9px\]/g, "text-[10px]", "text 9→10"],
  // 15px → 16px (standardize to MD)
  [/text-\[15px\]/g, "text-[16px]", "text 15→16"],
  // 19px → 20px (close to xl)
  [/text-\[19px\]/g, "text-[20px]", "text 19→20"],
  // 22px → 24px (standardize to xl)
  [/text-\[22px\]/g, "text-[24px]", "text 22→24"],

  // ═══════════════════════════════════════
  // SPACING (padding)
  // ═══════════════════════════════════════
  // 2px → 4px (minimum)
  [/p-\[2px\]/g, "p-[4px]", "pad 2→4"],
  // 6px → 8px (standardize to space-2)
  [/(?<![0-9])p-\[6px\]/g, "p-[8px]", "pad 6→8"],
  // 10px → 8px or 12px — context dependent, use 8px for tight, 12px for normal
  // We'll handle this case by case — just standardize padding 10 to 8
  [/(?<![0-9])p-\[10px\]/g, "p-[8px]", "pad 10→8"],
  // 14px → 16px
  [/(?<![0-9])p-\[14px\]/g, "p-[16px]", "pad 14→16"],
  // 15px → 16px
  [/(?<![0-9])p-\[15px\]/g, "p-[16px]", "pad 15→16"],
  // 25px → 24px
  [/(?<![0-9])p-\[25px\]/g, "p-[24px]", "pad 25→24"],
  // 35px → 32px
  [/(?<![0-9])p-\[35px\]/g, "p-[32px]", "pad 35→32"],

  // ═══════════════════════════════════════
  // SPACING (margin)
  // ═══════════════════════════════════════
  // 3px → 4px
  [/m-\[3px\]/g, "m-[4px]", "margin 3→4"],
  // 35px → 32px
  [/m-\[35px\]/g, "m-[32px]", "margin 35→32"],
  // 60px → 64px
  [/m-\[60px\]/g, "m-[64px]", "margin 60→64"],

  // ═══════════════════════════════════════
  // SPACING (gap)
  // ═══════════════════════════════════════
  // gap-[6px] → gap-[8px]
  [/gap-\[6px\]/g, "gap-[8px]", "gap 6→8"],
  // gap-[10px] → gap-[8px]
  [/gap-\[10px\]/g, "gap-[8px]", "gap 10→8"],
  // gap-[14px] → gap-[16px]
  [/gap-\[14px\]/g, "gap-[16px]", "gap 14→16"],
  // gap-[15px] → gap-[16px]
  [/gap-\[15px\]/g, "gap-[16px]", "gap 15→16"],
  // gap-[25px] → gap-[24px]
  [/gap-\[25px\]/g, "gap-[24px]", "gap 25→24"],
  // gap-[35px] → gap-[32px]
  [/gap-\[35px\]/g, "gap-[32px]", "gap 35→32"],
];

// Skip rules for responsive prefixes (md:, lg:, xl:) — those need context
// Also skip inside template literals and string expressions that might break

function processFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  let original = content;
  let changes = [];

  for (const [pattern, replacement, desc] of RULES) {
    const matches = content.match(pattern);
    if (matches) {
      content = content.replace(pattern, replacement);
      changes.push(`${desc} (${matches.length}x)`);
    }
  }

  if (content !== original) {
    if (!DRY_RUN) {
      fs.writeFileSync(filePath, content, "utf8");
    }
    return changes;
  }
  return [];
}

async function main() {
  console.log("=".repeat(60));
  console.log("Design System Standardization v2");
  console.log("=".repeat(60));
  if (DRY_RUN) console.log("DRY RUN — no files will be modified\n");

  let totalFiles = 0;
  let totalChanges = 0;
  const fileChanges = {};

  for (const dir of TARGET_DIRS) {
    const files = findTsxFiles(path.join(process.cwd(), dir));
    for (const file of files) {
      const changes = processFile(file);
      if (changes.length > 0) {
        const relative = path.relative(process.cwd(), file);
        fileChanges[relative] = changes;
        totalFiles++;
        totalChanges += changes.length;
      }
    }
  }

  console.log(`\nFiles modified: ${totalFiles}`);
  console.log(`Total rule applications: ${totalChanges}`);
  console.log(`\nChanges by file:`);
  
  for (const [file, changes] of Object.entries(fileChanges).sort()) {
    console.log(`\n  ${file}:`);
    for (const change of changes) {
      console.log(`    - ${change}`);
    }
  }

  if (!DRY_RUN && totalFiles > 0) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Done. ${totalFiles} files updated.`);
    console.log(`Run "npx next build" to verify.`);
  }
}

main().catch(console.error);
