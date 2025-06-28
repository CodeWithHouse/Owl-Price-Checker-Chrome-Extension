// background.js - Fixed Owl Price Checker Background Script

// Initialize analytics variable
let analytics = null;

// Import analytics with proper error handling
try {
  // Import the analytics script
  importScripts('analytics.js');
  // Get the analytics instance from the global scope after import
  analytics = (typeof window !== 'undefined' && window.analytics) || 
             (typeof self !== 'undefined' && self.analytics) || 
             null;
  
  if (analytics) {
    console.log('🦉 Analytics loaded successfully in background');
  } else {
    console.warn('🦉 Analytics imported but instance not found');
  }
} catch (error) {
  console.error('🦉 Failed to load analytics:', error);
  analytics = null;
}

// Store current product info
let currentProduct = null;
let lastProductHash = null;

// Track extension installation
chrome.runtime.onInstalled.addListener(async (details) => {
  try {
    if (details.reason === 'install') {
      // Set install date
      await chrome.storage.local.set({ 
        installDate: new Date().toISOString(),
        analyticsEnabled: true,
        trackPrices: true,
        notifications: true
      });
      
      // Track installation if analytics available
      if (analytics && typeof analytics.track === 'function') {
        analytics.track('Extension Installed', {
          version: chrome.runtime.getManifest().version,
          browser: 'Chrome',
          timestamp: new Date().toISOString()
        });
        
        // Initial identify
        if (typeof analytics.identify === 'function') {
          analytics.identify(null, {
            created_at: new Date().toISOString(),
            extension_version: chrome.runtime.getManifest().version
          });
        }
      }
      
    } else if (details.reason === 'update') {
      if (analytics && typeof analytics.track === 'function') {
        analytics.track('Extension Updated', {
          previous_version: details.previousVersion,
          current_version: chrome.runtime.getManifest().version
        });
      }
    }
  } catch (error) {
    console.error('🦉 Error in onInstalled handler:', error);
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
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
    if (request.action === 'trackEvent' && analytics && typeof analytics.track === 'function') {
      analytics.track(request.event, request.properties || {});
    }
    
    if (request.action === 'trackError' && analytics && typeof analytics.track === 'function') {
      analytics.track('Extension Error', request.data || {});
    }
    
    if (request.action === 'trackPage' && analytics && typeof analytics.page === 'function') {
      analytics.page(request.category, request.name, request.properties || {});
    }
  } catch (error) {
    console.error('🦉 Error handling message:', error);
  }
});

// Open authentication window
function openAuthWindow() {
  try {
    chrome.windows.create({
      url: chrome.runtime.getURL('auth.html'),
      type: 'popup',
      width: 500,
      height: 650,
      focused: true
    }, (window) => {
      // Track auth window opened if analytics available
      if (analytics && typeof analytics.track === 'function' && window) {
        analytics.track('Auth Window Opened', {
          windowId: window.id,
          timestamp: new Date().toISOString()
        });
      }
    });
  } catch (error) {
    console.error('🦉 Error opening auth window:', error);
  }
}

// Listen for authentication completion
chrome.storage.onChanged.addListener((changes, namespace) => {
  try {
    if (namespace === 'local') {
      // Track when user logs in/out
      if (changes.isLoggedIn) {
        if (changes.isLoggedIn.newValue === true && changes.isLoggedIn.oldValue !== true) {
          // User just logged in
          handleUserSignIn();
        } else if (changes.isLoggedIn.newValue === false && changes.isLoggedIn.oldValue === true) {
          // User just logged out
          handleUserSignOut();
        }
      }
    }
  } catch (error) {
    console.error('🦉 Error in storage change handler:', error);
  }
});

// Handle user sign in event
async function handleUserSignIn() {
  try {
    const userData = await chrome.storage.local.get(['user']);
    const user = userData.user;
    
    if (user) {
      // Set session start time
      await chrome.storage.local.set({ 
        sessionStartTime: new Date().toISOString() 
      });
      
      // Get additional user stats for identify
      const stats = await getUserStatsForIdentify(user.id);
      
      // Enhanced user identification on sign in (if analytics available)
      if (analytics && typeof analytics.identify === 'function') {
        analytics.identify(user.id, {
          firstName: user.firstName,
          email: user.email,
          signup_date: user.createdAt,
          last_active: new Date().toISOString(),
          total_sessions: await incrementUserSessions(user.id),
          total_savings: user.totalSavings || 0,
          total_coupons: user.couponsEarned || 0,
          marketing_emails: user.marketingEmails,
          account_status: 'active',
          user_type: 'returning',
          extension_version: chrome.runtime.getManifest().version,
          ...stats // Additional computed stats
        });
        
        // Track session start
        if (typeof analytics.track === 'function') {
          analytics.track('Session Started', {
            user_id: user.id,
            session_type: 'authenticated',
            login_method: 'extension',
            timestamp: new Date().toISOString()
          });
        }
      }
      
      console.log('User signed in successfully:', user.firstName);
    }
  } catch (error) {
    console.error('🦉 Error handling user sign in:', error);
  }
}

// Get additional user stats for identify event
async function getUserStatsForIdentify(userId) {
  try {
    const data = await chrome.storage.local.get([
      'userCoupons',
      'userActivity', 
      'userLoginCounts',
      'userLoginHistory'
    ]);
    
    const coupons = data.userCoupons || [];
    const activity = data.userActivity || [];
    const loginCounts = data.userLoginCounts || {};
    const loginHistory = data.userLoginHistory || {};
    
    // Calculate stats with safe array operations
    const activeCoupons = coupons.filter(c => 
      c && c.userId === userId && 
      !c.used && 
      c.expiresAt && new Date(c.expiresAt) > new Date()
    );
    
    const usedCoupons = coupons.filter(c => 
      c && c.userId === userId && c.used
    );
    
    const recentActivity = activity.filter(a => 
      a && a.timestamp && 
      Date.now() - new Date(a.timestamp).getTime() < 30 * 24 * 60 * 60 * 1000
    );
    
    const uniqueSites = [...new Set(recentActivity.map(a => a.site).filter(site => site))];
    
    return {
      active_coupons: activeCoupons.length,
      used_coupons: usedCoupons.length,
      total_logins: loginCounts[userId] || 1,
      recent_sites_visited: uniqueSites.length,
      days_active_last_30: Math.min(recentActivity.length, 30),
      favorite_sites: uniqueSites.slice(0, 3) // Top 3 sites
    };
  } catch (error) {
    console.error('Error getting user stats for identify:', error);
    return {};
  }
}

// Handle user sign out event
async function handleUserSignOut() {
  try {
    // Track session analytics before complete logout
    const sessionData = await chrome.storage.local.get(['sessionStartTime']);
    
    if (sessionData.sessionStartTime && analytics && typeof analytics.track === 'function') {
      const sessionDuration = calculateSessionDuration(sessionData.sessionStartTime);
      
      analytics.track('Authentication Session Ended', {
        session_duration_minutes: sessionDuration,
        session_end_reason: 'user_logout',
        timestamp: new Date().toISOString()
      });
    }
    
    // Clear session data
    await chrome.storage.local.remove(['sessionStartTime']);
    
    console.log('User signed out successfully');
  } catch (error) {
    console.error('🦉 Error handling user sign out:', error);
  }
}

// Increment user session count
async function incrementUserSessions(userId) {
  try {
    const userData = await chrome.storage.local.get(['userSessions']);
    const sessions = userData.userSessions || {};
    
    sessions[userId] = (sessions[userId] || 0) + 1;
    await chrome.storage.local.set({ userSessions: sessions });
    
    return sessions[userId];
  } catch (error) {
    console.error('🦉 Error incrementing user sessions:', error);
    return 1;
  }
}

// Calculate session duration in minutes
function calculateSessionDuration(startTime) {
  try {
    const start = new Date(startTime);
    const end = new Date();
    const durationMs = end - start;
    return Math.round(durationMs / (1000 * 60)); // Convert to minutes
  } catch (error) {
    console.error('🦉 Error calculating session duration:', error);
    return 0;
  }
}

// Clear all product-related data
function clearAllProductData(callback) {
  try {
    currentProduct = null;
    lastProductHash = null;
    
    console.log('Clearing all product data');
    
    chrome.storage.local.remove(['currentProduct', 'comparisons', 'lastUpdated', 'productHash'], () => {
      if (callback) callback();
    });
  } catch (error) {
    console.error('🦉 Error clearing product data:', error);
    if (callback) callback();
  }
}

// Handle product detection with better duplicate checking
function handleProductDetection(productData) {
  try {
    // Validate product data
    if (!productData || !productData.title || !productData.price) {
      console.error('🦉 Invalid product data received:', productData);
      return;
    }

    // Check if this is actually a new product
    const productHash = productData.hash || generateProductHash(productData);
    
    if (lastProductHash === productHash && currentProduct && 
        currentProduct.url === productData.url) {
      console.log('Same product hash and URL detected, skipping update');
      return;
    }
    
    // This is a new product
    console.log('New product detected:', productData.title, 'on', productData.site);
    lastProductHash = productHash;
    currentProduct = productData;
    
    // Track product view with e-commerce properties (if analytics available)
    if (analytics && typeof analytics.track === 'function') {
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
    }
    
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
  } catch (error) {
    console.error('🦉 Error handling product detection:', error);
  }
}

// Generate coupons for logged-in users
async function generateUserCoupons(product, user) {
  try {
    // Validate inputs
    if (!product || !user) {
      console.error('🦉 Invalid product or user data for coupon generation');
      return;
    }

    // Check if user already has coupons for this site
    const data = await chrome.storage.local.get(['userCoupons']);
    const existingCoupons = data.userCoupons || [];
    
    const activeSiteCoupons = existingCoupons.filter(coupon => 
      coupon && coupon.site && 
      coupon.site.toLowerCase() === product.site.toLowerCase() &&
      !coupon.used &&
      coupon.expiresAt && new Date(coupon.expiresAt) > new Date()
    );
    
    // Only generate new coupons if user has less than 2 active coupons for this site
    if (activeSiteCoupons.length < 2) {
      const newCoupons = await generateSiteCoupons(product.site, detectCategory(product.title), user);
      
      if (newCoupons && newCoupons.length > 0) {
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
        
        // Track coupon generation (if analytics available)
        if (analytics && typeof analytics.track === 'function') {
          analytics.track('Coupons Generated', {
            user_id: user.id,
            coupon_count: newCoupons.length,
            site: product.site,
            category: detectCategory(product.title)
          });
        }
      }
    }
  } catch (error) {
    console.error('Error generating coupons:', error);
  }
}

// Generate site-specific coupons
async function generateSiteCoupons(site, category, user) {
  try {
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
  } catch (error) {
    console.error('🦉 Error generating site coupons:', error);
    return [];
  }
}

// Generate hash for product identification
function generateProductHash(product) {
  try {
    if (product.hash) return product.hash;
    
    // Create hash from URL path + title + price
    const urlPath = new URL(product.url).pathname;
    return btoa(urlPath + product.title + product.price).substring(0, 16);
  } catch (error) {
    console.error('🦉 Error generating product hash:', error);
    return 'fallback_' + Date.now();
  }
}

// Generate coupon ID
function generateCouponId() {
  return 'coupon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Fetch price comparisons
async function fetchPriceComparisons(product) {
  try {
    const startTime = Date.now();
    
    // Track comparison request (if analytics available)
    if (analytics && typeof analytics.track === 'function') {
      analytics.track('Price Comparison Started', {
        product_id: extractProductId(product.url),
        product_name: product.title,
        current_price: product.price,
        currency: product.currency || 'USD',
        current_site: product.site
      });
    }
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Generate real comparison URLs
    const comparisons = await generateRealComparisons(product);
    
    // Calculate analytics data
    const prices = comparisons.map(c => c.price).filter(p => p && !isNaN(p));
    const lowestPrice = Math.min(...prices, product.price);
    const highestPrice = Math.max(...prices, product.price);
    const averagePrice = prices.length > 0 ? 
      prices.reduce((a, b) => a + b, product.price) / (prices.length + 1) : product.price;
    const cheaperOptions = comparisons.filter(c => c.price && c.price < product.price).length;
    const potentialSavings = product.price - lowestPrice;
    
    // Track comparison completion (if analytics available)
    if (analytics && typeof analytics.track === 'function') {
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
    }
    
    // Update user stats
    await updateUserStats(potentialSavings);
    
    // Store comparison data with product hash to ensure consistency
    chrome.storage.local.set({ 
      comparisons: comparisons,
      lastUpdated: new Date().toISOString(),
      productHash: lastProductHash // Store which product these comparisons belong to
    });
  } catch (error) {
    console.error('🦉 Error fetching price comparisons:', error);
  }
}

// Generate real comparison URLs based on product search
async function generateRealComparisons(product) {
  try {
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
  } catch (error) {
    console.error('🦉 Error generating real comparisons:', error);
    return [];
  }
}

// Clean product title for better search results
function cleanProductTitle(title) {
  try {
    if (!title || typeof title !== 'string') return '';
    
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
      if (word && word.length > 2 && !isCommonWord(word)) {
        keywords.push(word);
      }
    });
    
    // Return the most important keywords
    return keywords.slice(0, 6).join(' ');
  } catch (error) {
    console.error('🦉 Error cleaning product title:', error);
    return '';
  }
}

// Generate realistic price variations based on site characteristics
function generateRealisticPriceVariation(siteName, basePrice) {
  try {
    const siteCharacteristics = {
      'Amazon': { range: [-5, 5], availability: 0.95 },
      'eBay': { range: [-15, 10], availability: 0.9 },
      'Walmart': { range: [-3, 8], availability: 0.85 },
      'Target': { range: [-2, 10], availability: 0.8 },
      'Best Buy': { range: [0, 15], availability: 0.75 },
      'Newegg': { range: [-10, 5], availability: 0.8 }
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
  } catch (error) {
    console.error('🦉 Error generating price variation:', error);
    return {
      price: basePrice,
      difference: 0,
      percentDiff: 0,
      available: true
    };
  }
}

// Check if product is electronics
function isElectronicsProduct(title) {
  try {
    if (!title || typeof title !== 'string') return false;
    
    const electronicsKeywords = [
      'laptop', 'computer', 'monitor', 'keyboard', 'mouse', 'phone', 'tablet',
      'camera', 'tv', 'television', 'headphone', 'speaker', 'gaming', 'console'
    ];
    
    const lowerTitle = title.toLowerCase();
    return electronicsKeywords.some(keyword => lowerTitle.includes(keyword));
  } catch (error) {
    console.error('🦉 Error checking electronics product:', error);
    return false;
  }
}

// Check if word is common (to filter out)
function isCommonWord(word) {
  try {
    const commonWords = [
      'the', 'and', 'for', 'with', 'this', 'that', 'from', 'your', 'our',
      'new', 'all', 'one', 'two', 'three', 'best', 'top', 'great', 'good',
      'men', 'mens', 'women', 'womens', 'kids', 'adult', 'size'
    ];
    
    return commonWords.includes(word.toLowerCase());
  } catch (error) {
    console.error('🦉 Error checking common word:', error);
    return false;
  }
}

// Update user statistics
async function updateUserStats(savings) {
  try {
    const stats = await chrome.storage.local.get(['totalComparisons', 'totalSavings']);
    
    const newStats = {
      totalComparisons: (stats.totalComparisons || 0) + 1,
      totalSavings: (stats.totalSavings || 0) + Math.max(0, savings)
    };
    
    await chrome.storage.local.set(newStats);
    
    // Update user traits (if analytics available)
    if (analytics && typeof analytics.identify === 'function') {
      analytics.identify(null, newStats);
    }
  } catch (error) {
    console.error('🦉 Error updating user stats:', error);
  }
}

// Helper functions
function extractProductId(url) {
  try {
    if (!url || typeof url !== 'string') return 'unknown';
    
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
  } catch (error) {
    console.error('🦉 Error extracting product ID:', error);
    return 'unknown';
  }
}

function detectCategory(title) {
  try {
    if (!title || typeof title !== 'string') return 'Other';
    
    // Enhanced category detection
    const categories = {
      'Electronics': ['phone', 'laptop', 'tablet', 'camera', 'headphone', 'speaker', 'computer', 'monitor'],
      'Fashion': ['shirt', 'dress', 'shoe', 'watch', 'bag', 'jacket', 'pants', 'jeans'],
      'Sports': ['nike', 'adidas', 'running', 'training', 'gym', 'fitness', 'athletic', 'sport'],
      'Home': ['furniture', 'decor', 'kitchen', 'bedding', 'lamp', 'sofa', 'table', 'chair'],
      'Books': ['book', 'novel', 'guide', 'manual', 'ebook', 'textbook'],
      'Beauty': ['makeup', 'cosmetic', 'skincare', 'perfume', 'beauty', 'cream']
    };
    
    const lowerTitle = title.toLowerCase();
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => lowerTitle.includes(keyword))) {
        return category;
      }
    }
    return 'Other';
  } catch (error) {
    console.error('🦉 Error detecting category:', error);
    return 'Other';
  }
}

function detectBrand(title) {
  try {
    if (!title || typeof title !== 'string') return 'Generic';
    
    // Extended brand detection
    const brands = [
      'Samsung', 'Apple', 'Nike', 'Adidas', 'Sony', 'LG', 'HP', 'Dell', 'Lenovo',
      'Microsoft', 'Google', 'Amazon', 'Asus', 'Acer', 'Canon', 'Nikon', 'Bose'
    ];
    
    // Check for brands (case-insensitive)
    for (const brand of brands) {
      if (title.toLowerCase().includes(brand.toLowerCase())) {
        return brand;
      }
    }
    return 'Generic';
  } catch (error) {
    console.error('🦉 Error detecting brand:', error);
    return 'Generic';
  }
}

// Track browser action clicks
chrome.action.onClicked.addListener((tab) => {
  try {
    if (analytics && typeof analytics.track === 'function') {
      analytics.track('Extension Icon Clicked', {
        hadProduct: !!currentProduct,
        currentUrl: tab.url
      });
    }
  } catch (error) {
    console.error('🦉 Error tracking action click:', error);
  }
});

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
  try {
    // Open popup when notification is clicked
    chrome.action.openPopup();
    
    if (analytics && typeof analytics.track === 'function') {
      analytics.track('Notification Clicked', {
        notificationId: notificationId
      });
    }
  } catch (error) {
    console.error('🦉 Error handling notification click:', error);
  }
});

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  try {
    if (buttonIndex === 0) {
      // View Coupons button clicked
      chrome.action.openPopup();
      
      if (analytics && typeof analytics.track === 'function') {
        analytics.track('Notification Button Clicked', {
          notificationId: notificationId,
          button: 'view_coupons'
        });
      }
    } else if (buttonIndex === 1) {
      // Dismiss button clicked
      chrome.notifications.clear(notificationId);
      
      if (analytics && typeof analytics.track === 'function') {
        analytics.track('Notification Button Clicked', {
          notificationId: notificationId,
          button: 'dismiss'
        });
      }
    }
  } catch (error) {
    console.error('🦉 Error handling notification button click:', error);
  }
});