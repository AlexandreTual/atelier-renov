/**
 * Calculates the profit for a bag/item.
 * Sold:     actual_resale_price - purchase_price - fees - material_costs
 * Not sold: target_resale_price - purchase_price - material_costs (fees excluded from estimate)
 */
export function calculateProfit(item) {
  const purchase = parseFloat(item.purchase_price) || 0
  const material = parseFloat(item.material_costs) || 0
  const fees = parseFloat(item.fees) || 0
  const actual = parseFloat(item.actual_resale_price) || 0
  const target = parseFloat(item.target_resale_price) || 0
  return item.status === 'sold'
    ? actual - purchase - fees - material
    : target - purchase - material
}

/**
 * Calculates margin percentage based on profit and item cost base (purchase + material).
 * Returns null if cost base is 0 to avoid division by zero.
 */
export function calculateMargin(profit, item) {
  const purchase = parseFloat(item.purchase_price) || 0
  const material = parseFloat(item.material_costs) || 0
  const costBase = purchase + material
  return costBase > 0 ? (profit / costBase * 100) : null
}
