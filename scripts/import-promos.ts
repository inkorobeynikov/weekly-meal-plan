/**
 * Manual CSV → promotion_facts importer (MVP).
 *
 * Usage:
 *   pnpm import-promos ./promos.csv
 *
 * CSV columns (header row required, order-independent):
 *   retailer, product_name, price_text, start_date, end_date,
 *   conditions_text, requires_loyalty_app, source_url
 *
 * Upserts on (retailer, normalized_product_name, start_date). The table has no
 * unique constraint on those columns, so we match-then-update/insert manually.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { upsertPromotionFact } from '@meal-planner/domain/promo'
import type { NewPromotionFact } from '@meal-planner/db'

// Load .env into process.env if DATABASE_URL isn't already set (Node 20.12+).
if (!process.env.DATABASE_URL && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(resolve(process.cwd(), '.env'))
  } catch {
    // No .env file — rely on the ambient environment.
  }
}

// ----- normalization -----

const POLISH_MAP: Record<string, string> = {
  ą: 'a',
  ć: 'c',
  ę: 'e',
  ł: 'l',
  ń: 'n',
  ó: 'o',
  ś: 's',
  ź: 'z',
  ż: 'z',
}

function normalizeProductName(name: string): string {
  const lowered = name.trim().toLowerCase()
  const mapped = lowered.replace(/[ąćęłńóśźż]/g, (ch) => POLISH_MAP[ch] ?? ch)
  // Strip any remaining combining diacritics, then collapse whitespace.
  return mapped
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ----- CSV parsing (handles quoted fields, embedded commas, "" escapes) -----

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  const src = text.replace(/^﻿/, '') // strip BOM

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (ch === '\r') {
      // handled by the \n branch (skip)
    } else {
      field += ch
    }
  }
  // Flush trailing field/row if the file doesn't end with a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

function parseBool(value: string | undefined): boolean {
  if (!value) return false
  const v = value.trim().toLowerCase()
  return v === 'true' || v === '1' || v === 'yes' || v === 'tak'
}

function emptyToNull(value: string | undefined): string | null {
  const v = value?.trim()
  return v ? v : null
}

// ----- main -----

async function main(): Promise<void> {
  const csvPath = process.argv[2]
  if (!csvPath) {
    console.error('Usage: pnpm import-promos <path-to-csv>')
    process.exit(1)
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Add it to .env or the environment.')
    process.exit(1)
  }

  const raw = readFileSync(resolve(process.cwd(), csvPath), 'utf8')
  const rows = parseCsv(raw)
  if (rows.length < 2) {
    console.error('CSV must contain a header row and at least one data row.')
    process.exit(1)
  }

  const header = rows[0]!.map((h) => h.trim().toLowerCase())
  const col = (name: string): number => header.indexOf(name)
  const idx = {
    retailer: col('retailer'),
    productName: col('product_name'),
    priceText: col('price_text'),
    startDate: col('start_date'),
    endDate: col('end_date'),
    conditionsText: col('conditions_text'),
    requiresLoyaltyApp: col('requires_loyalty_app'),
    sourceUrl: col('source_url'),
  }
  if (idx.retailer === -1 || idx.productName === -1) {
    console.error('CSV header must include at least "retailer" and "product_name".')
    process.exit(1)
  }

  let inserted = 0
  let updated = 0
  let skipped = 0

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]!
    const retailer = cells[idx.retailer]?.trim() ?? ''
    const productName = cells[idx.productName]?.trim() ?? ''
    if (!retailer || !productName) {
      skipped++
      continue
    }

    const fact: NewPromotionFact = {
      retailer,
      productName,
      normalizedProductName: normalizeProductName(productName),
      priceText: idx.priceText === -1 ? null : emptyToNull(cells[idx.priceText]),
      startDate: idx.startDate === -1 ? null : emptyToNull(cells[idx.startDate]),
      endDate: idx.endDate === -1 ? null : emptyToNull(cells[idx.endDate]),
      conditionsText:
        idx.conditionsText === -1 ? null : emptyToNull(cells[idx.conditionsText]),
      requiresLoyaltyApp:
        idx.requiresLoyaltyApp === -1 ? false : parseBool(cells[idx.requiresLoyaltyApp]),
      sourceUrl: idx.sourceUrl === -1 ? null : emptyToNull(cells[idx.sourceUrl]),
    }

    const outcome = await upsertPromotionFact(fact)
    if (outcome === 'inserted') inserted++
    else updated++
  }

  console.log(
    `Promo import done: ${inserted} inserted, ${updated} updated, ${skipped} skipped.`,
  )
  process.exit(0)
}

main().catch((err) => {
  console.error('[import-promos] fatal:', err)
  process.exit(1)
})
