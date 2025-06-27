// background.js - Owl Price Checker Background Script (Fixed Navigation)

// Import analytics at the top
importScripts('analytics.js');

// Store current product info
let currentProduct = null;
let lastProductHash = null;

// Track extension installation
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // Set install date
    await chrome.storage.local.set({ 
      installDate: new Date().toISOString(),
      analyticsEnabled: true,
      trackPrices: true,
      notifications: true
    });
    
    // Track installation
    analytics.track('Extension Installed', {
      version: chrome.runtime.getManifest().version,
      browser: 'Chrome',
      timestamp: new Date().toISOString()
    });
    
    // Initial identify
    analytics.identify(null, {
      created_at: new Date().toISOString(),
      extension_version: chrome.runtime.getManifest().version
    });
    
  } else if (details.reason === 'update') {
    analytics.track('Extension Updated', {
      previous_version: details.previousVersion,
      current_version: chrome.runtime.getManifest().version
    });
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'productDetected') {
    handleProductDetection(request.data);
  } else if (request.action === 'clearAndDetectProduct') {
    // Clear old data first, then detect new product
    clearAllProductData(() => {
      console.log('Cleared old product data, detecting new product');
      handleProductDetection(request.data);
    });
  } else if (request.action === 'clearProduct') {
    // Just clear the data
    clearAllProductData(() => {
      console.log('Cleared product data - no product on page');
    });
  } else if (request.action === 'openAuth') {
    // Open authentication window
    openAuthWindow();
  } else if (request.action === 'checkAuthStatus') {
    // Check if user is logged in
    chrome.storage.local.get(['isLoggedIn', 'user'], (result) => {
      sendResponse({
        isLoggedIn: result.isLoggedIn || false,
        user: result.user || null
      });
    });
    return true; // Keep message channel open for async response
  }
  
  // Handle analytics events from content script
  if (request.action === 'trackEvent') {
    analytics.track(request.event, request.properties);
  }
  
  if (request.action === 'trackError') {
    analytics.track('Extension Error', request.data);
  }
  
  if (request.action === 'trackPage') {
    analytics.page(request.category, request.name, request.properties);
  }
});

// Open authentication window
function openAuthWindow() {
  chrome.windows.create({
    url: chrome.runtime.getURL('auth.html'),
    type: 'popup',
    width: 500,
    height: 650,
    focused: true
  }, (window) => {
    // Track auth window opened
    analytics.track('Auth Window Opened', {
      windowId: window.id
    });
  });
}

// Clear all product-related data
function clearAllProductData(callback) {
  currentProduct = null;
  lastProductHash = null;
  
  chrome.storage.local.remove(['currentProduct', 'comparisons', 'lastUpdated'], () => {
    if (callback) callback();
  });
}

// Handle product detection with better duplicate checking
function handleProductDetection(productData) {
  // Check if this is actually a new product
  const productHash = productData.hash || generateProductHash(productData);
  
  if (lastProductHash === productHash) {
    console.log('Same product hash detected, skipping update');
    return;
  }
  
  // This is a new product
  lastProductHash = productHash;
  currentProduct = productData;
  
  // Track product view with e-commerce properties
  analytics.track('Product Viewed', {
    product_id: extractProductId(currentProduct.url),
    product_name: currentProduct.title,
    price: currentProduct.price,
    currency: currentProduct.currency || 'USD',
    category: detectCategory(currentProduct.title),
    brand: detectBrand(currentProduct.title),
    site: currentProduct.site,
    url: currentProduct.url
  });
  
  // Store in chrome storage
  chrome.storage.local.set({ currentProduct: currentProduct });
  
  // Check if user is logged in and generate coupons
  chrome.storage.local.get(['isLoggedIn', 'user'], async (result) => {
    if (result.isLoggedIn && result.user) {
      // Generate coupons for logged-in users
      await generateUserCoupons(currentProduct, result.user);
    }
  });
  
  // Fetch price comparisons
  fetchPriceComparisons(currentProduct);
}

// Generate coupons for logged-in users
async function generateUserCoupons(product, user) {
  try {
    // Check if user already has coupons for this site
    const data = await chrome.storage.local.get(['userCoupons']);
    const existingCoupons = data.userCoupons || [];
    
    const activeSiteCoupons = existingCoupons.filter(coupon => 
      coupon.site.toLowerCase() === product.site.toLowerCase() &&
      !coupon.used &&
      new Date(coupon.expiresAt) > new Date()
    );
    
    // Only generate new coupons if user has less than 2 active coupons for this site
    if (activeSiteCoupons.length < 2) {
      const newCoupons = await generateSiteCoupons(product.site, detectCategory(product.title), user);
      
      if (newCoupons.length > 0) {
        // Add to existing coupons
        const allCoupons = [...existingCoupons, ...newCoupons];
        
        // Update user coupon count
        user.couponsEarned = (user.couponsEarned || 0) + newCoupons.length;
        
        // Save updated data
        await chrome.storage.local.set({
          user: user,
          userCoupons: allCoupons,
          pendingCoupons: newCoupons
        });
        
        // Track coupon generation
        analytics.track('Coupons Generated', {
          user_id: user.id,
          coupon_count: newCoupons.length,
          site: product.site,
          category: detectCategory(product.title)
        });
      }
    }
  } catch (error) {
    console.error('Error generating coupons:', error);
  }
}

// Generate site-specific coupons
async function generateSiteCoupons(site, category, user) {
  const coupons = [];
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + 14); // 14 days from now

  // Site-specific coupon templates
  const couponTemplates = {
    'Nike': [
      { code: 'NIKE10', discount: '10% off', minPurchase: 100 },
      { code: 'FREERUN', discount: 'Free shipping', minPurchase: 50 },
      { code: 'ATHLETE15', discount: '15% off athletic wear', minPurchase: 150 }
    ],
    'Amazon': [
      { code: 'PRIME5', discount: '5% off', minPurchase: 25 },
      { code: 'BULK10', discount: '10% off orders over $50', minPurchase: 50 },
      { code: 'NEWUSER', discount: '15% off first order', minPurchase: 30 }
    ],
    'Target': [
      { code: 'TARGET10', discount: '10% off', minPurchase: 50 },
      { code: 'REDCARD', discount: '5% additional discount', minPurchase: 0 },
      { code: 'CIRCLE15', discount: '15% off select items', minPurchase: 100 }
    ],
    'Walmart': [
      { code: 'SAVE5', discount: '5% off', minPurchase: 35 },
      { code: 'PICKUP10', discount: '10% off pickup orders', minPurchase: 50 },
      { code: 'GROCERY', discount: '$10 off groceries', minPurchase: 100 }
    ]
  };

  // Generic coupons for other sites
  const genericCoupons = [
    { code: 'SAVE10', discount: '10% off', minPurchase: 50 },
    { code: 'WELCOME15', discount: '15% off first order', minPurchase: 75 },
    { code: 'FREESHIP', discount: 'Free shipping', minPurchase: 25 }
  ];

  const templates = couponTemplates[site] || genericCoupons;
  const selectedTemplate = templates[Math.floor(Math.random() * templates.length)];

  coupons.push({
    id: generateCouponId(),
    code: selectedTemplate.code,
    discount: selectedTemplate.discount,
    site: site,
    category: category,
    minPurchase: selectedTemplate.minPurchase,
    expiresAt: expirationDate.toISOString(),
    createdAt: new Date().toISOString(),
    used: false,
    userId: user.id
  });

  return coupons;
}

// Generate hash for product identification
function generateProductHash(product) {
  if (product.hash) return product.hash;
  
  // Create hash from URL path + title + price
  const urlPath = new URL(product.url).pathname;
  return btoa(urlPath + product.title + product.price).substring(0, 16);
}

// Generate coupon ID
function generateCouponId() {
  return 'coupon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Fetch price comparisons
async function fetchPriceComparisons(product) {
  const startTime = Date.now();
  
  // Track comparison request
  analytics.track('Price Comparison Started', {
    product_id: extractProductId(product.url),
    product_name: product.title,
    current_price: product.price,
    currency: product.currency || 'USD',
    current_site: product.site
  });
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Generate real comparison URLs
  const comparisons = await generateRealComparisons(product);
  
  // Calculate analytics data
  const prices = comparisons.map(c => c.price);
  const lowestPrice = Math.min(...prices, product.price);
  const highestPrice = Math.max(...prices, product.price);
  const averagePrice = prices.reduce((a, b) => a + b, product.price) / (prices.length + 1);
  const cheaperOptions = comparisons.filter(c => c.price < product.price).length;
  const potentialSavings = product.price - lowestPrice;
  
  // Track comparison completion
  analytics.track('Price Comparison Completed', {
    product_id: extractProductId(product.url),
    product_name: product.title,
    current_price: product.price,
    currency: product.currency || 'USD',
    lowest_price: lowestPrice,
    highest_price: highestPrice,
    average_price: Math.round(averagePrice),
    sites_compared: comparisons.length,
    cheaper_options_found: cheaperOptions,
    potential_savings: potentialSavings,
    savings_percentage: Math.round((potentialSavings / product.price) * 100 * 10) / 10,
    comparison_time_ms: Date.now() - startTime
  });
  
  // Update user stats
  await updateUserStats(potentialSavings);
  
  // Store comparison data with product hash to ensure consistency
  chrome.storage.local.set({ 
    comparisons: comparisons,
    lastUpdated: new Date().toISOString(),
    productHash: lastProductHash // Store which product these comparisons belong to
  });
}

// Generate real comparison URLs based on product search
async function generateRealComparisons(product) {
  // Clean up product title for search
  const searchQuery = cleanProductTitle(product.title);
  
  // Define comparison sites with their search URL patterns
  const comparisonSites = [
    {
      name: 'Amazon',
      searchUrl: (query) => `https://www.amazon.com/s?k=${encodeURIComponent(query)}`,
      enabled: !product.site.toLowerCase().includes('amazon')
    },
    {
      name: 'eBay',
      searchUrl: (query) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}`,
      enabled: true
    },
    {
      name: 'Walmart',
      searchUrl: (query) => `https://www.walmart.com/search?q=${encodeURIComponent(query)}`,
      enabled: true
    },
    {
      name: 'Target',
      searchUrl: (query) => `https://www.target.com/s?searchTerm=${encodeURIComponent(query)}`,
      enabled: true
    },
    {
      name: 'Best Buy',
      searchUrl: (query) => `https://www.bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(query)}`,
      enabled: isElectronicsProduct(product.title)
    },
    {
      name: 'Newegg',
      searchUrl: (query) => `https://www.newegg.com/p/pl?d=${encodeURIComponent(query)}`,
      enabled: isElectronicsProduct(product.title)
    },
    {
      name: 'B&H Photo',
      searchUrl: (query) => `https://www.bhphotovideo.com/c/search?q=${encodeURIComponent(query)}`,
      enabled: isElectronicsProduct(product.title)
    },
    {
      name: 'Etsy',
      searchUrl: (query) => `https://www.etsy.com/search?q=${encodeURIComponent(query)}`,
      enabled: !isElectronicsProduct(product.title)
    },
    {
      name: 'AliExpress',
      searchUrl: (query) => `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(query)}`,
      enabled: true
    },
    {
      name: 'Costco',
      searchUrl: (query) => `https://www.costco.com/CatalogSearch?dept=All&keyword=${encodeURIComponent(query)}`,
      enabled: true
    },
    {
      name: 'Dick\'s Sporting Goods',
      searchUrl: (query) => `https://www.dickssportinggoods.com/search/SearchDisplay?searchTerm=${encodeURIComponent(query)}`,
      enabled: isSportsProduct(product.title)
    },
    {
      name: 'Foot Locker',
      searchUrl: (query) => `https://www.footlocker.com/search?query=${encodeURIComponent(query)}`,
      enabled: isSportsProduct(product.title) || product.site.toLowerCase().includes('nike')
    },
    {
      name: 'Finish Line',
      searchUrl: (query) => `https://www.finishline.com/search?query=${encodeURIComponent(query)}`,
      enabled: isSportsProduct(product.title) || product.site.toLowerCase().includes('nike')
    }
  ];
  
  // Filter enabled sites and exclude current site
  const availableSites = comparisonSites.filter(site => 
    site.enabled && !site.name.toLowerCase().includes(product.site.toLowerCase())
  );
  
  // Select random subset of sites (4-6)
  const selectedSites = availableSites
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.floor(Math.random() * 3) + 4);
  
  // Generate comparison data with real URLs
  return selectedSites.map(site => {
    // Generate realistic price variations based on site characteristics
    const priceVariation = generateRealisticPriceVariation(site.name, product.price);
    
    return {
      site: site.name,
      price: priceVariation.price,
      difference: priceVariation.difference,
      percentDiff: priceVariation.percentDiff,
      url: site.searchUrl(searchQuery),
      available: priceVariation.available
    };
  }).sort((a, b) => a.price - b.price);
}

// Clean product title for better search results
function cleanProductTitle(title) {
  // Remove common unnecessary parts
  const cleanTitle = title
    .replace(/\([^)]*\)/g, '') // Remove content in parentheses
    .replace(/\[[^\]]*\]/g, '') // Remove content in brackets
    .replace(/[^\w\s-]/g, ' ') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
  
  // Extract key product identifiers
  const words = cleanTitle.split(' ');
  const keywords = [];
  
  // Keep brand names and important words
  words.forEach(word => {
    if (word.length > 2 && !isCommonWord(word)) {
      keywords.push(word);
    }
  });
  
  // Return the most important keywords
  return keywords.slice(0, 6).join(' ');
}

// Generate realistic price variations based on site characteristics
function generateRealisticPriceVariation(siteName, basePrice) {
  const siteCharacteristics = {
    'Amazon': { range: [-5, 5], availability: 0.95 },
    'eBay': { range: [-15, 10], availability: 0.9 },
    'Walmart': { range: [-3, 8], availability: 0.85 },
    'Target': { range: [-2, 10], availability: 0.8 },
    'Best Buy': { range: [0, 15], availability: 0.75 },
    'Newegg': { range: [-10, 5], availability: 0.8 },
    'B&H Photo': { range: [-5, 10], availability: 0.7 },
    'Etsy': { range: [-20, 30], availability: 0.6 },
    'AliExpress': { range: [-40, -10], availability: 0.8 },
    'Costco': { range: [-15, 0], availability: 0.7 },
    'Dick\'s Sporting Goods': { range: [-5, 15], availability: 0.8 },
    'Foot Locker': { range: [-10, 20], availability: 0.75 },
    'Finish Line': { range: [-8, 15], availability: 0.7 }
  };
  
  const characteristics = siteCharacteristics[siteName] || { range: [-10, 20], availability: 0.8 };
  
  // Generate variation within site's typical range
  const [minVar, maxVar] = characteristics.range;
  const variation = (Math.random() * (maxVar - minVar) + minVar) / 100;
  const comparePrice = Math.round(basePrice * (1 + variation));
  const difference = comparePrice - basePrice;
  const percentDiff = Math.round((difference / basePrice) * 100);
  
  return {
    price: comparePrice,
    difference: difference,
    percentDiff: percentDiff,
    available: Math.random() < characteristics.availability
  };
}

// Check if product is electronics
function isElectronicsProduct(title) {
  const electronicsKeywords = [
    'laptop', 'computer', 'monitor', 'keyboard', 'mouse', 'phone', 'tablet',
    'camera', 'tv', 'television', 'headphone', 'speaker', 'gaming', 'console',
    'graphics card', 'processor', 'cpu', 'gpu', 'ram', 'ssd', 'hard drive'
  ];
  
  const lowerTitle = title.toLowerCase();
  return electronicsKeywords.some(keyword => lowerTitle.includes(keyword));
}

// Check if product is sports/athletic
function isSportsProduct(title) {
  const sportsKeywords = [
    'nike', 'adidas', 'puma', 'reebok', 'under armour', 'new balance',
    'running', 'training', 'basketball', 'football', 'soccer', 'tennis',
    'gym', 'fitness', 'athletic', 'sport', 'shoe', 'sneaker', 'shorts',
    'jersey', 'workout', 'exercise', 'yoga', 'golf'
  ];
  
  const lowerTitle = title.toLowerCase();
  return sportsKeywords.some(keyword => lowerTitle.includes(keyword));
}

// Check if word is common (to filter out)
function isCommonWord(word) {
  const commonWords = [
    'the', 'and', 'for', 'with', 'this', 'that', 'from', 'your', 'our',
    'new', 'all', 'one', 'two', 'three', 'best', 'top', 'great', 'good',
    'men', 'mens', 'women', 'womens', 'kids', 'adult', 'size'
  ];
  
  return commonWords.includes(word.toLowerCase());
}

// Update user statistics
async function updateUserStats(savings) {
  const stats = await chrome.storage.local.get(['totalComparisons', 'totalSavings']);
  
  const newStats = {
    totalComparisons: (stats.totalComparisons || 0) + 1,
    totalSavings: (stats.totalSavings || 0) + Math.max(0, savings)
  };
  
  await chrome.storage.local.set(newStats);
  
  // Update user traits
  analytics.identify(null, newStats);
}

// Helper functions
function extractProductId(url) {
  // More flexible product ID extraction
  const patterns = [
    /\/([A-Z0-9]{10})/,          // Amazon ASIN
    /\/product\/([a-zA-Z0-9-]+)/, // Generic product ID
    /\/p\/([a-zA-Z0-9-]+)/,       // Short product URL
    /\/item\/([0-9]+)/,           // Numeric item ID
    /[?&]id=([a-zA-Z0-9]+)/,      // Query parameter ID
    /[?&]pid=([a-zA-Z0-9]+)/,     // Product ID in query
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  // Fallback: use last part of URL path
  const urlParts = url.split('/').filter(part => part);
  const lastPart = urlParts[urlParts.length - 1];
  return lastPart ? lastPart.substring(0, 20) : 'unknown';
}

function detectCategory(title) {
  // Enhanced category detection
  const categories = {
    'Electronics': ['phone', 'laptop', 'tablet', 'camera', 'headphone', 'speaker', 'computer', 'monitor', 'keyboard', 'mouse', 'tv', 'television', 'audio', 'video', 'gaming'],
    'Fashion': ['shirt', 'dress', 'shoe', 'watch', 'bag', 'jacket', 'pants', 'jeans', 'coat', 'clothing', 'apparel', 'fashion', 'wear', 'outfit', 'shorts'],
    'Sports': ['nike', 'adidas', 'running', 'training', 'gym', 'fitness', 'athletic', 'sport', 'basketball', 'football', 'soccer'],
    'Home': ['furniture', 'decor', 'kitchen', 'bedding', 'lamp', 'sofa', 'table', 'chair', 'bed', 'mattress', 'curtain', 'rug', 'home'],
    'Books': ['book', 'novel', 'guide', 'manual', 'ebook', 'textbook', 'paperback', 'hardcover', 'kindle'],
    'Beauty': ['makeup', 'cosmetic', 'skincare', 'perfume', 'beauty', 'cream', 'lotion', 'shampoo'],
    'Toys': ['toy', 'game', 'puzzle', 'lego', 'doll', 'action figure', 'board game'],
    'Food': ['food', 'snack', 'grocery', 'gourmet', 'organic', 'beverage', 'coffee', 'tea']
  };
  
  const lowerTitle = title.toLowerCase();
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => lowerTitle.includes(keyword))) {
      return category;
    }
  }
  return 'Other';
}

function detectBrand(title) {
  // Extended brand detection
  const brands = [
    'Samsung', 'Apple', 'Nike', 'Adidas', 'Sony', 'LG', 'HP', 'Dell', 'Lenovo',
    'Microsoft', 'Google', 'Amazon', 'Asus', 'Acer', 'Canon', 'Nikon', 'Bose',
    'JBL', 'Logitech', 'Razer', 'Intel', 'AMD', 'Nvidia', 'Corsair', 'Kingston',
    'Puma', 'Reebok', 'Under Armour', 'New Balance', 'Vans', 'Converse',
    'Levis', 'Gap', 'H&M', 'Zara', 'Uniqlo', 'Ralph Lauren', 'Tommy Hilfiger'
  ];
  
  // Check for brands (case-insensitive)
  for (const brand of brands) {
    if (title.toLowerCase().includes(brand.toLowerCase())) {
      return brand;
    }
  }
  return 'Generic';
}

// Track browser action clicks
chrome.action.onClicked.addListener((tab) => {
  analytics.track('Extension Icon Clicked', {
    hadProduct: !!currentProduct,
    currentUrl: tab.url
  });
});

// Track tab changes to monitor user behavior
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      // Check if it's a shopping-related URL
      const shoppingKeywords = ['product', 'item', 'shop', 'store', 'buy', 'cart', 'checkout'];
      const isShoppingRelated = shoppingKeywords.some(keyword => 
        tab.url.toLowerCase().includes(keyword)
      );
      
      if (isShoppingRelated) {
        analytics.track('Shopping Tab Activated', {
          url: tab.url,
          tabId: activeInfo.tabId
        });
      }
    }
  } catch (error) {
    // Tab might have been closed
  }
});

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
  // Open popup when notification is clicked
  chrome.action.openPopup();
  
  analytics.track('Notification Clicked', {
    notificationId: notificationId
  });
});

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    // View Coupons button clicked
    chrome.action.openPopup();
    
    analytics.track('Notification Button Clicked', {
      notificationId: notificationId,
      button: 'view_coupons'
    });
  } else if (buttonIndex === 1) {
    // Dismiss button clicked
    chrome.notifications.clear(notificationId);
    
    analytics.track('Notification Button Clicked', {
      notificationId: notificationId,
      button: 'dismiss'
    });
  }
});