#!/usr/bin/env node
// =============================================
// Design Token Standardizer
// =============================================
// Batch-replaces arbitrary Tailwind values with
// standardized design token classes across all
// dashboard and component files.

const fs = require('fs');
const path = require('path');

function findFiles(dir, ext, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findFiles(full, ext, results);
    else if (entry.name.endsWith(ext)) results.push(full);
  }
  return results;
}

// ── Typography Replacements ──
const typographyReplacements = [
  // text-[11px] → text-caption
  { from: /text-\[11px\]/g, to: 'text-[11px]' }, // Keep as-is, already close to caption
  // text-[12px] → keep (matches --text-xs)
  // text-[13px] → keep (matches --text-sm)
  // text-[14px] → keep (matches --text-base)
  // text-[15px] → text-[14px] (standardize to base)
  { from: /text-\[15px\]/g, to: 'text-[14px]' },
  // text-[16px] → keep (matches --text-md)
  // text-[18px] → keep (matches --text-lg)
  // text-[20px] → text-[18px] (standardize to lg)
  { from: /text-\[20px\]/g, to: 'text-[18px]' },
  // text-[22px] → text-[24px] (standardize to xl)
  { from: /text-\[22px\]/g, to: 'text-[24px]' },
  // text-[24px] → keep (matches --text-xl)
  // text-[28px] → text-[28px] keep
  // text-[30px] → text-[28px]
  { from: /text-\[30px\]/g, to: 'text-[28px]' },
  // text-[32px] → keep
  // text-[36px] → text-[32px]
  { from: /text-\[36px\]/g, to: 'text-[32px]' },
  // text-[38px] → text-[36px] (standardize)
  { from: /text-\[38px\]/g, to: 'text-[36px]' },
  // text-[40px] → text-[36px]
  { from: /text-\[40px\]/g, to: 'text-[36px]' },
  // text-[44px] → text-[40px]
  { from: /text-\[44px\]/g, to: 'text-[40px]' },
  // text-[46px] → text-[40px]
  { from: /text-\[46px\]/g, to: 'text-[40px]' },
];

// ── Border Radius Replacements ──
const radiusReplacements = [
  // Standardize to: 6px, 8px, 12px, 16px, 20px
  { from: /rounded-\[5px\]/g, to: 'rounded-[6px]' },
  { from: /rounded-\[7px\]/g, to: 'rounded-[8px]' },
  { from: /rounded-\[9px\]/g, to: 'rounded-[8px]' },
  { from: /rounded-\[10px\]/g, to: 'rounded-[12px]' },
  { from: /rounded-\[11px\]/g, to: 'rounded-[12px]' },
  { from: /rounded-\[13px\]/g, to: 'rounded-[12px]' },
  { from: /rounded-\[14px\]/g, to: 'rounded-[12px]' },
  { from: /rounded-\[15px\]/g, to: 'rounded-[16px]' },
  { from: /rounded-\[18px\]/g, to: 'rounded-[16px]' },
  { from: /rounded-\[25px\]/g, to: 'rounded-[20px]' },
  { from: /rounded-\[30px\]/g, to: 'rounded-[20px]' },
];

// ── Spacing Replacements (4px base) ──
const spacingReplacements = [
  // Standardize odd pixel values to nearest 4px
  { from: /gap-\[3px\]/g, to: 'gap-[4px]' },
  { from: /gap-\[5px\]/g, to: 'gap-[4px]' },
  { from: /gap-\[7px\]/g, to: 'gap-[8px]' },
  { from: /gap-\[9px\]/g, to: 'gap-[8px]' },
  { from: /gap-\[11px\]/g, to: 'gap-[12px]' },
  { from: /gap-\[13px\]/g, to: 'gap-[12px]' },
  { from: /gap-\[14px\]/g, to: 'gap-[16px]' },
  { from: /gap-\[17px\]/g, to: 'gap-[16px]' },
  { from: /gap-\[18px\]/g, to: 'gap-[16px]' },
  { from: /gap-\[19px\]/g, to: 'gap-[20px]' },
  { from: /gap-\[22px\]/g, to: 'gap-[24px]' },
  { from: /gap-\[23px\]/g, to: 'gap-[24px]' },
  { from: /gap-\[26px\]/g, to: 'gap-[24px]' },
  { from: /gap-\[27px\]/g, to: 'gap-[24px]' },
  { from: /gap-\[28px\]/g, to: 'gap-[32px]' },
  { from: /gap-\[29px\]/g, to: 'gap-[32px]' },
  // p-[Xpx] spacing
  { from: /p-\[3px\]/g, to: 'p-[4px]' },
  { from: /p-\[5px\]/g, to: 'p-[4px]' },
  { from: /p-\[7px\]/g, to: 'p-[8px]' },
  { from: /p-\[9px\]/g, to: 'p-[8px]' },
  { from: /p-\[11px\]/g, to: 'p-[12px]' },
  { from: /p-\[13px\]/g, to: 'p-[12px]' },
  { from: /p-\[14px\]/g, to: 'p-[16px]' },
  { from: /p-\[15px\]/g, to: 'p-[16px]' },
  { from: /p-\[17px\]/g, to: 'p-[16px]' },
  { from: /p-\[18px\]/g, to: 'p-[16px]' },
  { from: /p-\[19px\]/g, to: 'p-[20px]' },
  { from: /p-\[22px\]/g, to: 'p-[24px]' },
  { from: /p-\[23px\]/g, to: 'p-[24px]' },
  { from: /p-\[26px\]/g, to: 'p-[24px]' },
  { from: /p-\[27px\]/g, to: 'p-[24px]' },
  { from: /p-\[28px\]/g, to: 'p-[32px]' },
  { from: /p-\[29px\]/g, to: 'p-[32px]' },
  // px-[Xpx] horizontal
  { from: /px-\[3px\]/g, to: 'px-[4px]' },
  { from: /px-\[5px\]/g, to: 'px-[4px]' },
  { from: /px-\[7px\]/g, to: 'px-[8px]' },
  { from: /px-\[9px\]/g, to: 'px-[8px]' },
  { from: /px-\[11px\]/g, to: 'px-[12px]' },
  { from: /px-\[13px\]/g, to: 'px-[12px]' },
  { from: /px-\[14px\]/g, to: 'px-[16px]' },
  { from: /px-\[15px\]/g, to: 'px-[16px]' },
  { from: /px-\[17px\]/g, to: 'px-[16px]' },
  { from: /px-\[18px\]/g, to: 'px-[16px]' },
  { from: /px-\[19px\]/g, to: 'px-[20px]' },
  { from: /px-\[22px\]/g, to: 'px-[24px]' },
  { from: /px-\[23px\]/g, to: 'px-[24px]' },
  { from: /px-\[26px\]/g, to: 'px-[24px]' },
  { from: /px-\[27px\]/g, to: 'px-[24px]' },
  { from: /px-\[28px\]/g, to: 'px-[32px]' },
  { from: /px-\[29px\]/g, to: 'px-[32px]' },
  // py-[Xpx] vertical
  { from: /py-\[3px\]/g, to: 'py-[4px]' },
  { from: /py-\[5px\]/g, to: 'py-[4px]' },
  { from: /py-\[7px\]/g, to: 'py-[8px]' },
  { from: /py-\[9px\]/g, to: 'py-[8px]' },
  { from: /py-\[11px\]/g, to: 'py-[12px]' },
  { from: /py-\[13px\]/g, to: 'py-[12px]' },
  { from: /py-\[14px\]/g, to: 'py-[16px]' },
  { from: /py-\[15px\]/g, to: 'py-[16px]' },
  { from: /py-\[17px\]/g, to: 'py-[16px]' },
  { from: /py-\[18px\]/g, to: 'py-[16px]' },
  { from: /py-\[19px\]/g, to: 'py-[20px]' },
  { from: /py-\[22px\]/g, to: 'py-[24px]' },
  { from: /py-\[23px\]/g, to: 'py-[24px]' },
  // mb-[Xpx] bottom margin
  { from: /mb-\[3px\]/g, to: 'mb-[4px]' },
  { from: /mb-\[5px\]/g, to: 'mb-[4px]' },
  { from: /mb-\[7px\]/g, to: 'mb-[8px]' },
  { from: /mb-\[9px\]/g, to: 'mb-[8px]' },
  { from: /mb-\[11px\]/g, to: 'mb-[12px]' },
  { from: /mb-\[13px\]/g, to: 'mb-[12px]' },
  { from: /mb-\[14px\]/g, to: 'mb-[16px]' },
  { from: /mb-\[15px\]/g, to: 'mb-[16px]' },
  { from: /mb-\[17px\]/g, to: 'mb-[16px]' },
  { from: /mb-\[18px\]/g, to: 'mb-[16px]' },
  { from: /mb-\[19px\]/g, to: 'mb-[20px]' },
  { from: /mb-\[22px\]/g, to: 'mb-[24px]' },
  { from: /mb-\[23px\]/g, to: 'mb-[24px]' },
  // mt-[Xpx] top margin
  { from: /mt-\[3px\]/g, to: 'mt-[4px]' },
  { from: /mt-\[5px\]/g, to: 'mt-[4px]' },
  { from: /mt-\[7px\]/g, to: 'mt-[8px]' },
  { from: /mt-\[9px\]/g, to: 'mt-[8px]' },
  { from: /mt-\[11px\]/g, to: 'mt-[12px]' },
  { from: /mt-\[13px\]/g, to: 'mt-[12px]' },
  { from: /mt-\[14px\]/g, to: 'mt-[16px]' },
  { from: /mt-\[15px\]/g, to: 'mt-[16px]' },
  { from: /mt-\[17px\]/g, to: 'mt-[16px]' },
  { from: /mt-\[18px\]/g, to: 'mt-[16px]' },
  { from: /mt-\[19px\]/g, to: 'mt-[20px]' },
  { from: /mt-\[22px\]/g, to: 'mt-[24px]' },
  { from: /mt-\[23px\]/g, to: 'mt-[24px]' },
  // mx-[Xpx]
  { from: /mx-\[3px\]/g, to: 'mx-[4px]' },
  { from: /mx-\[5px\]/g, to: 'mx-[4px]' },
  { from: /mx-\[7px\]/g, to: 'mx-[8px]' },
  { from: /mx-\[9px\]/g, to: 'mx-[8px]' },
  // w-[Xpx] and h-[Xpx] for UI elements
  { from: /w-\[3px\]/g, to: 'w-[4px]' },
  { from: /w-\[5px\]/g, to: 'w-[4px]' },
  { from: /w-\[7px\]/g, to: 'w-[8px]' },
  { from: /w-\[9px\]/g, to: 'w-[8px]' },
  { from: /w-\[11px\]/g, to: 'w-[12px]' },
  { from: /w-\[13px\]/g, to: 'w-[12px]' },
  { from: /h-\[3px\]/g, to: 'h-[4px]' },
  { from: /h-\[5px\]/g, to: 'h-[4px]' },
  { from: /h-\[7px\]/g, to: 'h-[8px]' },
  { from: /h-\[9px\]/g, to: 'h-[8px]' },
  { from: /h-\[11px\]/g, to: 'h-[12px]' },
  { from: /h-\[13px\]/g, to: 'h-[12px]' },
];

const allReplacements = [
  ...typographyReplacements,
  ...radiusReplacements,
  ...spacingReplacements,
];

// Find all TSX files
const files = [
  ...findFiles('src/app/dashboard', '.tsx'),
  ...findFiles('src/components/Dashboard', '.tsx'),
  ...findFiles('src/components/ui', '.tsx'),
];

let totalChanges = 0;
const changedFiles = [];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  let fileChanges = 0;

  for (const { from, to } of allReplacements) {
    const matches = content.match(from);
    if (matches) {
      fileChanges += matches.length;
      content = content.replace(from, to);
    }
  }

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    totalChanges += fileChanges;
    changedFiles.push({ file, changes: fileChanges });
  }
}

console.log(`\n✅ Design Token Standardization Complete`);
console.log(`   Files modified: ${changedFiles.length}`);
console.log(`   Total replacements: ${totalChanges}`);
console.log(`\n   Changed files:`);
changedFiles.sort((a, b) => b.changes - a.changes);
for (const { file, changes } of changedFiles) {
  console.log(`   ${changes}x ${file}`);
}
