/**
 * check-i18n.js
 * Scans a .tsx file for hardcoded strings in JSX that should use the i18n system.
 *
 * Detects:
 * - Text content between JSX tags: >some text here<
 * - Common string attributes: placeholder="...", title="...", aria-label="...", alt="..."
 *
 * Ignores:
 * - Strings that are just whitespace, numbers, or single characters
 * - Strings inside {t(...)} or {tp(...)} expressions
 * - CSS class names and data attributes
 * - Import/export statements
 * - Comments
 * - Strings that look like code identifiers (camelCase, UPPER_CASE, dot.notation)
 */

const fs = require('node:fs')
const path = require('node:path')

// Read file path from stdin (hook passes JSON context)
let input = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => {
  input += chunk
})
process.stdin.on('end', () => {
  let filePath = ''

  try {
    const context = JSON.parse(input)
    filePath = context.filePath || ''
  } catch {
    // If no JSON context, exit silently
    process.exit(0)
  }

  if (!filePath?.endsWith('.tsx')) {
    process.exit(0)
  }

  if (!fs.existsSync(filePath)) {
    process.exit(0)
  }

  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')
  const findings = []

  // Patterns to detect hardcoded strings
  const jsxTextPattern = />\s*([A-ZÀ-ÿ][^<{]*[a-zà-ÿ][^<{]*)\s*</g
  const attrPattern = /(?:placeholder|title|aria-label|alt|label)\s*=\s*"([^"]+)"/g
  const attrPatternSingle = /(?:placeholder|title|aria-label|alt|label)\s*=\s*'([^']+)'/g

  // Patterns to ignore
  const ignorePatterns = [
    /^\s*$/, // whitespace only
    /^\d+$/, // numbers only
    /^[A-Z_]+$/, // CONSTANTS
    /^[a-z][a-zA-Z]*$/, // camelCase identifiers
    /^[a-z]+\.[a-z.]+$/, // dot.notation keys
    /^\w+::\w+$/, // namespace::key patterns
    /^[{}<>=/\\|&*+\-#@!?.,;:'"()[\]]+$/, // punctuation only
    /^https?:\/\//, // URLs
    /^\s*\/\//, // comments
    /^[A-Z][a-z]+(?:[A-Z][a-z]+)*$/, // PascalCase (component names)
  ]

  function shouldIgnore(str) {
    const trimmed = str.trim()
    if (trimmed.length <= 2) return true
    return ignorePatterns.some((p) => p.test(trimmed))
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1

    // Skip import/export lines
    if (/^\s*(import|export)\s/.test(line)) continue
    // Skip comment lines
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) continue
    // Skip lines that are inside t() or tp() calls
    if (/\bt\s*\(/.test(line) && !/>/.test(line)) continue

    // Check for JSX text content
    jsxTextPattern.lastIndex = 0
    for (const match of line.matchAll(jsxTextPattern)) {
      const text = match[1].trim()
      if (!shouldIgnore(text)) {
        // Make sure it's not inside a t() expression on the same line
        const before = line.substring(0, match.index)
        if (!/{t\(|{tp\(|{t`|{`/.test(before)) {
          findings.push({ line: lineNum, text, type: 'JSX text' })
        }
      }
    }

    // Check string attributes
    attrPattern.lastIndex = 0
    for (const match of line.matchAll(attrPattern)) {
      const text = match[1].trim()
      if (!shouldIgnore(text)) {
        findings.push({ line: lineNum, text, type: 'attribute' })
      }
    }

    attrPatternSingle.lastIndex = 0
    for (const match of line.matchAll(attrPatternSingle)) {
      const text = match[1].trim()
      if (!shouldIgnore(text)) {
        findings.push({ line: lineNum, text, type: 'attribute' })
      }
    }
  }

  if (findings.length > 0) {
    const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/')
    const header = `⚠️  i18n: ${findings.length} possível(is) string(s) hardcoded em ${relativePath}`
    const details = findings
      .slice(0, 10) // limit output
      .map((f) => `   Linha ${f.line} [${f.type}]: "${f.text.substring(0, 60)}${f.text.length > 60 ? '...' : ''}"`)
      .join('\n')

    const footer = findings.length > 10 ? `\n   ... e mais ${findings.length - 10} ocorrência(s)` : ''

    const tip = "\n   💡 Use t('namespace:key') do useTranslation para textos visíveis ao usuário."

    console.log(`${header}\n${details}${footer}${tip}`)
  }

  process.exit(0)
})
