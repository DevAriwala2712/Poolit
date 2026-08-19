/**
 * Fee per student based on DISTINCT order count in the slot.
 * Do not change these thresholds silently.
 */
function feeForOrderCount(orderCount) {
    if (orderCount <= 0) return 20;
    if (orderCount <= 2) return 20;
    if (orderCount <= 5) return 10;
    if (orderCount <= 10) return 5;
    return 0;
  }
  
  module.exports = { feeForOrderCount };