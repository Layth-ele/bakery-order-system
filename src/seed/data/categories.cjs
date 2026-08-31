/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CATEGORIES DATA
 * ═══════════════════════════════════════════════════════════════════════════
 */

const { generateId } = require('../helpers.cjs');

function generateCategories() {
  return [
    { id: generateId('cat'), name: "Breads", order: 1 },
    { id: generateId('cat'), name: "Pastries", order: 2 },
    { id: generateId('cat'), name: "Cakes & Desserts", order: 3 },
    { id: generateId('cat'), name: "Cookies", order: 4 },
    { id: generateId('cat'), name: "Specialty Items", order: 5 },
    { id: generateId('cat'), name: "Seasonal", order: 6 },
  ];
}

module.exports = { generateCategories };
