// =============================================================================
// API Exports
// =============================================================================

// Cards
export {
  getCards,
  getCardsPaginated,
  getCard,
  addCard,
  updateCard,
  deleteCard,
  searchCards,
  searchByCardNumber,
  checkCardExistsByImageUrl,
  getPurchasePrices,
  addPurchasePrice,
  addPurchasePrices,
  getSalePrices,
  getCardSaleUrls,
  upsertCardSaleUrl,
} from './cards'

// Shops & Sites
export {
  getShops,
  getShop,
  addShop,
  updateShop,
  deleteShop,
  getSaleSites,
  getSaleSite,
  addSaleSite,
  updateSaleSite,
  deleteSaleSite,
} from './shops'

// Pending
export {
  getPendingImages,
  addPendingImage,
  updatePendingImageStatus,
  deletePendingImage,
  getPendingCards,
  addPendingCard,
  addPendingCardsFromRecognition,
  matchPendingCard,
  updatePendingCardPrice,
  deletePendingCard,
  savePendingCardsToPurchasePrices,
  getPendingStats,
} from './pending'

// Dashboard
export {
  getDashboardStats,
  getRecentCards,
  getPriceChanges,
  getCronStats,
  searchCardsForDashboard,
  getLargeCategories,
  getAllSaleSites,
} from './dashboard'

// Categories
export {
  getLargeCategories as getCategoryLargeList,
  getMediumCategories,
  getSmallCategories,
  getRarities,
  addCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  getMediumAndRarities,
} from './categories'
