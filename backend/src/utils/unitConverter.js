/**
 * Unit Converter Utility for ZovikPOS Inventory Management
 * Handles standard measurement unit conversions between recipe requirements and inventory stock units.
 */

const UNIT_GROUPS = {
  WEIGHT: ['KG', 'G', 'GRAM', 'GRAMS', 'KILOGRAM', 'KILOGRAMS'],
  VOLUME: ['L', 'ML', 'LITER', 'LITERS', 'MILLILITER', 'MILLILITERS'],
  COUNT: ['PCS', 'PC', 'PIECE', 'PIECES', 'UNIT', 'UNITS', 'DOZEN', 'DOZENS', 'PACK', 'PACKS', 'BOTTLE', 'BOTTLES', 'TUB', 'TUBS']
};

/**
 * Normalizes a unit string to uppercase canonical form
 */
const normalizeUnit = (unit) => {
  if (!unit || typeof unit !== 'string') return 'PCS';
  const u = unit.trim().toUpperCase();
  if (['KG', 'KILOGRAM', 'KILOGRAMS'].includes(u)) return 'KG';
  if (['G', 'GRAM', 'GRAMS'].includes(u)) return 'G';
  if (['L', 'LITER', 'LITERS'].includes(u)) return 'L';
  if (['ML', 'MILLILITER', 'MILLILITERS'].includes(u)) return 'ML';
  if (['DOZEN', 'DOZENS'].includes(u)) return 'DOZEN';
  if (['PACK', 'PACKS'].includes(u)) return 'PACK';
  if (['BOTTLE', 'BOTTLES'].includes(u)) return 'BOTTLE';
  if (['PCS', 'PC', 'PIECE', 'PIECES', 'UNIT', 'UNITS'].includes(u)) return 'PCS';
  return u;
};

/**
 * Converts a quantity from recipe unit to target inventory unit.
 * Throws error if units belong to incompatible measurement families.
 * 
 * @param {number} qty Quantity to convert
 * @param {string} fromUnit Unit of the quantity
 * @param {string} toUnit Target unit to convert into
 * @returns {number} Converted quantity
 */
const convertUnit = (qty, fromUnit, toUnit) => {
  const amount = Number(qty);
  if (isNaN(amount)) throw new Error(`Invalid numeric quantity: ${qty}`);

  const source = normalizeUnit(fromUnit);
  const target = normalizeUnit(toUnit);

  if (source === target) return amount;

  // Weight conversions (KG <-> G)
  if (UNIT_GROUPS.WEIGHT.includes(source) && UNIT_GROUPS.WEIGHT.includes(target)) {
    if (source === 'KG' && target === 'G') return amount * 1000;
    if (source === 'G' && target === 'KG') return amount / 1000;
  }

  // Volume conversions (L <-> ML)
  if (UNIT_GROUPS.VOLUME.includes(source) && UNIT_GROUPS.VOLUME.includes(target)) {
    if (source === 'L' && target === 'ML') return amount * 1000;
    if (source === 'ML' && target === 'L') return amount / 1000;
  }

  // Count conversions (DOZEN <-> PCS)
  if (UNIT_GROUPS.COUNT.includes(source) && UNIT_GROUPS.COUNT.includes(target)) {
    if (source === 'DOZEN' && target === 'PCS') return amount * 12;
    if (source === 'PCS' && target === 'DOZEN') return amount / 12;
  }

  throw new Error(`Incompatible unit conversion from "${fromUnit}" (${source}) to "${toUnit}" (${target}).`);
};

module.exports = {
  normalizeUnit,
  convertUnit
};
