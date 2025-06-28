// content.js - Owl Price Checker Universal E-commerce Content Script (Complete Fixed)

// Currency symbols and codes mapping
const CURRENCY_MAP = {
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '¥': 'JPY',
  '₹': 'INR',
  '₨': 'PKR',
  'R$': 'BRL',
  'C$': 'CAD',
  'A$': 'AUD',
  'kr': 'SEK',
  'zł': 'PLN',
  '₱': 'PHP',
  '₩': 'KRW',
  'RM': 'MYR',
  'S$': 'SGD',
  'HK$': 'HKD',
  'NT$': 'TWD',
  '₺': 'TRY',
  '₽': 'RUB',
  'CHF': 'CHF',
  'Rp': 'IDR',
  '₪': 'ILS',
  'AED': 'AED',
  'SAR': 'SAR'
};

// Universal product detection patterns
const UNIVERSAL_PATTERNS = {
  // Price patterns - looking for currency symbols and numbers
  price: [
    // Nike specific selectors
    '[data-test="product-price"]',
    '.product-price',
    '.css-b9fpep',
    '.css-1g0n8lx',
    
    // Amazon specific selectors
    '.a-price.a-text-price.a-size-medium.apexPriceToPay',
    '.a-price-whole:first',
    'span.a-price-range',
    '.a-price[data-a-size="xl"]',
    'span.a-price > span.a-offscreen',
    '#priceblock_dealprice',
    '#priceblock_ourprice',
    
    // General patterns
    '[class*="price"]:not([class*="strike"]):not([class*="old"]):not([class*="was"]):not([class*="list"])',
    '[class*="Price"]:not([class*="Strike"]):not([class*="Old"]):not([class*="Was"]):not([class*="List"])',
    '[data-price]',
    '[itemprop="price"]',
    '.sale-price',
    '.current-price',
    'meta[property="product:price:amount"]',
    'meta[property="og:price:amount"]'
  ],
  
  // Title patterns
  title: [
    // Nike specific
    '[data-test="product-title"]',
    'h1[id*="pdp_product_title"]',
    '.product-title',
    
    // Amazon specific
    '#productTitle',
    'h1.a-size-large',
    
    // General patterns
    'h1',
    '[class*="product-title"]',
    '[class*="product-name"]',
    '[class*="productTitle"]',
    '[class*="productName"]',
    '[itemprop="name"]',
    'meta[property="og:title"]',
    'meta[name="twitter:title"]'
  ],
  
  // Image patterns
  image: [
    // Nike specific
    '[data-test="hero-image"] img',
    '.css-viwop1 img',
    
    // Amazon specific
    '#landingImage',
    '#imgBlkFront',
    
    // General patterns
    '[class*="product-image"] img',
    '[class*="main-image"] img',
    '[itemprop="image"]',
    'meta[property="og:image"]',
    'meta[name="twitter:image"]'
  ]
};

// E-commerce indicators
const ECOMMERCE_INDICATORS = [
  'add to cart',
  'add to bag',
  'buy now',
  'add to basket',
  'purchase',
  'shop now',
  'add to wishlist',
  'product details',
  'product description',
  'price',
  'size',
  'color',
  'quantity'
];

// Store last detected product to avoid duplicates
let lastDetectedProduct = null;
let detectionTimeout = null;
let lastUrl = window.location.href; // Track URL changes more reliably
let lastDomain = window.location.hostname; // Track domain changes

console.log('🦉 Owl Price Checker content script loaded on:', window.location.href);

// Generate a simple hash for product URLs to detect changes
function generateProductHash(url, title, price) {
  try {
    // Create a simple hash from URL path + title + price
    if (!url || !title || !price) return 'fallback_' + Date.now();
    
    const urlPath = new URL(url).pathname;
    return btoa(urlPath + title + price).substring(0, 16);
  } catch (error) {
    console.error('🦉 Error generating product hash:', error);
    return 'fallback_' + Date.now();
  }
}

// Check if we're on a new product page
function isNewProduct(productInfo) {
  try {
    if (!lastDetectedProduct || !productInfo) return true;
    
    // Check if URL changed significantly (different product path)
    const currentPath = new URL(productInfo.url).pathname;
    const lastPath = new URL(lastDetectedProduct.url).pathname;
    
    // For Nike, check if the product ID in URL changed
    if (window.location.hostname.includes('nike.com')) {
      const currentNikeId = currentPath.match(/\/t\/[^\/]+\/([^\/\?]+)/);
      const lastNikeId = lastPath.match(/\/t\/[^\/]+\/([^\/\?]+)/);
      if (currentNikeId && lastNikeId && currentNikeId[1] !== lastNikeId[1]) {
        return true;
      }
    }
    
    // Check if title or price changed significantly
    const titleChanged = productInfo.title !== lastDetectedProduct.title;
    const priceChanged = Math.abs(productInfo.price - lastDetectedProduct.price) > 1;
    const urlChanged = currentPath !== lastPath;
    
    return titleChanged || priceChanged || urlChanged;
  } catch (error) {
    console.error('🦉 Error checking if new product:', error);
    return true; // Assume it's new if we can't determine
  }
}

// Clear stored data when navigating to new domain/product
function clearProductDataIfNeeded() {
  try {
    const currentUrl = window.location.href;
    const currentDomain = window.location.hostname;
    
    // Check if domain changed
    if (currentDomain !== lastDomain) {
      console.log('🦉 Domain changed from', lastDomain, 'to', currentDomain);
      lastDomain = currentDomain;
      lastDetectedProduct = null;
      
      // Clear stored data for domain change
      chrome.runtime.sendMessage({
        action: 'clearProduct'
      }).catch(error => {
        console.error('🦉 Error sending clear message:', error);
      });
      return true;
    }
    
    // Check if URL changed significantly within same domain
    if (currentUrl !== lastUrl) {
      console.log('🦉 URL changed from', lastUrl, 'to', currentUrl);
      lastUrl = currentUrl;
      
      // For significant URL changes, clear product data
      const urlDiff = Math.abs(currentUrl.length - lastUrl.length);
      if (urlDiff > 10) { // Significant URL change
        lastDetectedProduct = null;
        chrome.runtime.sendMessage({
          action: 'clearProduct'
        }).catch(error => {
          console.error('🦉 Error sending clear message:', error);
        });
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('🦉 Error clearing product data:', error);
    return false;
  }
}

// Enhanced price extraction for Nike
function extractPriceFromNike() {
  try {
    const nikeSelectors = [
      '[data-test="product-price"]',
      '[data-test="product-price-reduced"]',
      '.product-price',
      '.css-b9fpep',
      '.css-1g0n8lx',
      '.headline-5',
      '.css-17t8u4e'
    ];
    
    for (const selector of nikeSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          if (element && element.textContent) {
            const priceText = element.textContent.trim();
            const price = extractPrice(priceText);
            if (price > 0) {
              console.log('🦉 Nike price found with selector:', selector, 'Price:', price);
              return { element, priceText, price };
            }
          }
        }
      } catch (selectorError) {
        console.warn('🦉 Error with Nike selector:', selector, selectorError);
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.error('🦉 Error extracting Nike price:', error);
    return null;
  }
}

// Enhanced price extraction for Amazon
function extractPriceFromAmazon() {
  try {
    const amazonSelectors = [
      '.a-price.a-text-price.a-size-medium.apexPriceToPay span.a-offscreen',
      '.a-price.a-text-price.a-size-medium span.a-offscreen',
      'span.a-price[data-a-size="xl"] span.a-offscreen',
      '.a-price-whole',
      '#priceblock_dealprice',
      '#priceblock_ourprice',
      '.a-price > span.a-offscreen'
    ];
    
    for (const selector of amazonSelectors) {
      try {
        const element = document.querySelector(selector);
        if (element && element.textContent) {
          const priceText = element.textContent.trim();
          const price = extractPrice(priceText);
          if (price > 0) {
            console.log('🦉 Amazon price found with selector:', selector, 'Price:', price);
            return { element, priceText, price };
          }
        }
      } catch (selectorError) {
        console.warn('🦉 Error with Amazon selector:', selector, selectorError);
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.error('🦉 Error extracting Amazon price:', error);
    return null;
  }
}

// Detect currency from price text
function detectCurrency(priceText) {
  try {
    if (!priceText) return { symbol: '$', code: 'USD' };
    
    // Check for currency symbols
    for (const [symbol, code] of Object.entries(CURRENCY_MAP)) {
      if (priceText.includes(symbol)) {
        return { symbol, code };
      }
    }
    
    // Check domain for currency hints
    const hostname = window.location.hostname;
    if (hostname.includes('.sg')) return { symbol: 'S$', code: 'SGD' };
    if (hostname.includes('.uk')) return { symbol: '£', code: 'GBP' };
    if (hostname.includes('.ca')) return { symbol: 'C$', code: 'CAD' };
    if (hostname.includes('.au')) return { symbol: 'A$', code: 'AUD' };
    if (hostname.includes('.in')) return { symbol: '₹', code: 'INR' };
    
    return { symbol: '$', code: 'USD' };
  } catch (error) {
    console.error('🦉 Error detecting currency:', error);
    return { symbol: '$', code: 'USD' };
  }
}

// Detect if current page is an e-commerce product page
function isProductPage() {
  try {
    const pageText = document.body?.innerText?.toLowerCase() || '';
    const url = window.location.href.toLowerCase();
    
    // Check URL patterns
    const productUrlPatterns = [
      '/product/',
      '/products/',
      '/item/',
      '/items/',
      '/p/',
      '/pd/',
      '/dp/',
      '/gp/product/',
      '-p-',
      '/buy/',
      '/shop/',
      '/detail/',
      '/goods/'
    ];
    
    const hasProductUrl = productUrlPatterns.some(pattern => url.includes(pattern));
    
    // Check for Nike specific patterns
    if (window.location.hostname.includes('nike.com')) {
      if (url.includes('/t/') || url.includes('/w/') || url.includes('/m/')) {
        return true;
      }
    }
    
    // Check page content for e-commerce indicators
    const indicatorCount = ECOMMERCE_INDICATORS.filter(indicator => 
      pageText.includes(indicator)
    ).length;
    
    // Check for structured data
    const hasProductSchema = document.querySelector('[itemtype*="schema.org/Product"]') !== null;
    
    // Check for meta tags
    const hasProductMeta = document.querySelector('meta[property="og:type"][content="product"]') !== null ||
                          document.querySelector('meta[property="product:price:amount"]') !== null;
    
    return hasProductUrl || (indicatorCount >= 3) || hasProductSchema || hasProductMeta;
  } catch (error) {
    console.error('🦉 Error checking if product page:', error);
    return false;
  }
}

// Find price element using patterns
function findPriceElement() {
  try {
    const hostname = window.location.hostname;
    
    // Check site-specific extractors first
    if (hostname.includes('nike.com')) {
      const nikePrice = extractPriceFromNike();
      if (nikePrice) return nikePrice.element;
    } else if (hostname.includes('amazon')) {
      const amazonPrice = extractPriceFromAmazon();
      if (amazonPrice) return amazonPrice.element;
    }
    
    // Try meta tags
    try {
      const metaPrice = document.querySelector('meta[property="product:price:amount"]') ||
                       document.querySelector('meta[property="og:price:amount"]');
      if (metaPrice && metaPrice.content) {
        const price = extractPrice(metaPrice.content);
        if (price > 0) return metaPrice;
      }
    } catch (metaError) {
      console.warn('🦉 Error checking meta tags:', metaError);
    }
    
    // Try CSS selectors
    for (const selector of UNIVERSAL_PATTERNS.price) {
      try {
        if (typeof selector === 'string') {
          const elements = document.querySelectorAll(selector);
          for (const element of elements) {
            if (element && element.textContent) {
              const price = extractPrice(element.textContent);
              if (price > 0) {
                return element;
              }
            }
          }
        }
      } catch (selectorError) {
        console.warn('🦉 Error with price selector:', selector, selectorError);
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.error('🦉 Error finding price element:', error);
    return null;
  }
}

// Find element using patterns
function findElement(patterns) {
  try {
    for (const selector of patterns) {
      try {
        if (selector.startsWith('meta')) {
          const element = document.querySelector(selector);
          if (element && element.content) {
            return { textContent: element.content };
          }
        } else {
          const element = document.querySelector(selector);
          if (element && element.textContent?.trim()) {
            return element;
          }
        }
      } catch (selectorError) {
        console.warn('🦉 Error with selector:', selector, selectorError);
        continue;
      }
    }
    return null;
  } catch (error) {
    console.error('🦉 Error finding element:', error);
    return null;
  }
}

// Extract price from text
function extractPrice(text) {
  try {
    if (!text) return 0;
    
    // Remove currency symbols and letters
    const cleanedText = text.replace(/[^\d.,]/g, '');
    
    // Handle different decimal separators
    let normalizedText = cleanedText;
    
    if (cleanedText.includes(',') && cleanedText.includes('.')) {
      normalizedText = cleanedText.replace(/,/g, '');
    } else if (cleanedText.includes(',') && !cleanedText.includes('.')) {
      const parts = cleanedText.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        normalizedText = cleanedText.replace(',', '.');
      } else {
        normalizedText = cleanedText.replace(/,/g, '');
      }
    }
    
    const price = parseFloat(normalizedText) || 0;
    return price;
  } catch (error) {
    console.error('🦉 Error extracting price:', error);
    return 0;
  }
}

// Detect site name from domain
function detectSiteName() {
  try {
    const hostname = window.location.hostname;
    
    // Special cases for known sites
    if (hostname.includes('nike.com')) return 'Nike';
    if (hostname.includes('amazon')) return 'Amazon';
    if (hostname.includes('ebay')) return 'eBay';
    if (hostname.includes('walmart')) return 'Walmart';
    if (hostname.includes('target')) return 'Target';
    
    // Generic extraction
    let siteName = hostname
      .replace(/^www\./, '')
      .replace(/\.(com|net|org|co|io|store|shop|in|uk|ca|au|de|fr|es|it|jp|cn|sg).*$/, '');
    
    siteName = siteName.charAt(0).toUpperCase() + siteName.slice(1);
    
    return siteName;
  } catch (error) {
    console.error('🦉 Error detecting site name:', error);
    return 'Unknown Site';
  }
}

// Extract product information with comprehensive error handling
function extractProductInfo() {
  try {
    if (!isProductPage()) {
      console.log('🦉 Not a product page');
      return null;
    }
    
    // Extract title
    const titleElement = findElement(UNIVERSAL_PATTERNS.title);
    let title = titleElement ? titleElement.textContent.trim() : '';
    
    // Clean up title
    if (!title || title.length < 5) {
      try {
        title = document.title ? document.title.split('|')[0].split('-')[0].trim() : '';
      } catch (titleError) {
        console.warn('🦉 Error getting document title:', titleError);
        title = '';
      }
    }
    
    // Extract price
    let price = 0;
    let priceText = '';
    
    const hostname = window.location.hostname;
    if (hostname.includes('nike.com')) {
      const nikePrice = extractPriceFromNike();
      if (nikePrice) {
        price = nikePrice.price;
        priceText = nikePrice.priceText;
      }
    } else if (hostname.includes('amazon')) {
      const amazonPrice = extractPriceFromAmazon();
      if (amazonPrice) {
        price = amazonPrice.price;
        priceText = amazonPrice.priceText;
      }
    } else {
      const priceElement = findPriceElement();
      if (priceElement) {
        priceText = priceElement.textContent || priceElement.content || '';
        price = extractPrice(priceText);
      }
    }
    
    // Detect currency
    const currency = detectCurrency(priceText);
    
    // Extract image with better error handling
    let image = '';
    
    try {
      // Try meta tags first
      const metaImage = document.querySelector('meta[property="og:image"]') ||
                       document.querySelector('meta[name="twitter:image"]');
      if (metaImage && metaImage.content) {
        image = metaImage.content;
      }
      
      // Try pattern selectors
      if (!image) {
        for (const selector of UNIVERSAL_PATTERNS.image) {
          try {
            if (!selector.startsWith('meta')) {
              const imgElement = document.querySelector(selector);
              if (imgElement && imgElement.src) {
                image = imgElement.src;
                break;
              }
            }
          } catch (imgSelectorError) {
            console.warn('🦉 Error with image selector:', selector, imgSelectorError);
            continue;
          }
        }
      }
      
      // Fallback to any large image
      if (!image) {
        try {
          const images = document.querySelectorAll('img');
          for (const img of images) {
            if (img && img.src && img.width > 200 && img.height > 200 && !img.src.includes('logo')) {
              image = img.src;
              break;
            }
          }
        } catch (fallbackError) {
          console.warn('🦉 Error with fallback image search:', fallbackError);
        }
      }
    } catch (imageError) {
      console.warn('🦉 Error extracting image:', imageError);
      image = ''; // Fallback to empty string
    }
    
    const url = window.location.href;
    const site = detectSiteName();
    
    // Only return if we have title and price
    if (title && price > 0) {
      const productInfo = {
        title,
        price,
        currency: currency.code,
        currencySymbol: currency.symbol,
        image,
        url,
        site,
        extractedAt: new Date().toISOString(),
        hash: generateProductHash(url, title, price)
      };
      
      console.log('🦉 Product extracted:', productInfo);
      return productInfo;
    }
    
    console.log('🦉 Failed to extract product:', { title, price });
    return null;
  } catch (error) {
    console.error('🦉 Error extracting product info:', error);
    return null;
  }
}

// Send product info to background script
function sendProductInfo() {
  try {
    // First check if we need to clear data due to navigation
    const wasCleared = clearProductDataIfNeeded();
    
    const productInfo = extractProductInfo();
    
    if (productInfo && productInfo.title && productInfo.price) {
      // Check if this is a new product
      if (isNewProduct(productInfo) || wasCleared) {
        console.log('🦉 New product detected:', productInfo);
        lastDetectedProduct = productInfo;
        
        // Clear old data and send new product
        chrome.runtime.sendMessage({
          action: 'clearAndDetectProduct',
          data: productInfo
        }).catch(error => {
          console.error('🦉 Error sending product info:', error);
        });
      } else {
        console.log('🦉 Same product detected, skipping update');
      }
    } else {
      // No product detected, clear if we had one before
      if (lastDetectedProduct) {
        console.log('🦉 No product detected, clearing data');
        lastDetectedProduct = null;
        chrome.runtime.sendMessage({
          action: 'clearProduct'
        }).catch(error => {
          console.error('🦉 Error clearing product:', error);
        });
      }
    }
  } catch (error) {
    console.error('🦉 Error in sendProductInfo:', error);
  }
}

// Initialize with debouncing
function initialize() {
  try {
    console.log('🦉 Initializing Owl Price Checker on:', window.location.href);
    
    // Clear any pending detection
    if (detectionTimeout) {
      clearTimeout(detectionTimeout);
    }
    
    // Debounce detection to avoid multiple calls
    detectionTimeout = setTimeout(() => {
      sendProductInfo();
    }, 1500);
  } catch (error) {
    console.error('🦉 Error in initialize:', error);
  }
}

// Set up initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Enhanced URL change detection for SPA navigation
let observer = null;

try {
  observer = new MutationObserver((mutations) => {
    try {
      const url = location.href;
      if (url !== lastUrl) {
        console.log('🦉 URL changed detected by observer:', lastUrl, '->', url);
        lastUrl = url;
        lastDetectedProduct = null; // Clear cache immediately
        
        // Re-initialize after a short delay to let the page load
        setTimeout(() => {
          initialize();
        }, 500);
      }
    } catch (observerError) {
      console.error('🦉 Error in mutation observer:', observerError);
    }
  });

  // Observe for URL changes and DOM changes
  if (document.body) {
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['href']
    });
  } else {
    // If body not loaded yet, wait for it
    document.addEventListener('DOMContentLoaded', () => {
      if (observer && document.body) {
        observer.observe(document.body, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ['href']
        });
      }
    });
  }
} catch (observerSetupError) {
  console.error('🦉 Error setting up mutation observer:', observerSetupError);
}

// Listen for popstate events (back/forward navigation)
try {
  window.addEventListener('popstate', () => {
    console.log('🦉 Navigation detected via popstate');
    lastDetectedProduct = null;
    setTimeout(() => {
      initialize();
    }, 500);
  });
} catch (popstateError) {
  console.error('🦉 Error setting up popstate listener:', popstateError);
}

// Listen for pushstate/replacestate (SPA navigation)
try {
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function() {
    try {
      originalPushState.apply(history, arguments);
      console.log('🦉 Navigation detected via pushState');
      lastDetectedProduct = null;
      setTimeout(() => {
        initialize();
      }, 500);
    } catch (pushStateError) {
      console.error('🦉 Error in pushState override:', pushStateError);
    }
  };

  history.replaceState = function() {
    try {
      originalReplaceState.apply(history, arguments);
      console.log('🦉 Navigation detected via replaceState');
      lastDetectedProduct = null;
      setTimeout(() => {
        initialize();
      }, 500);
    } catch (replaceStateError) {
      console.error('🦉 Error in replaceState override:', replaceStateError);
    }
  };
} catch (historyError) {
  console.error('🦉 Error setting up history listeners:', historyError);
}

// Additional check on focus (when user returns to tab)
try {
  window.addEventListener('focus', () => {
    try {
      const currentUrl = location.href;
      const currentDomain = location.hostname;
      
      if (currentUrl !== lastUrl || currentDomain !== lastDomain) {
        console.log('🦉 URL/Domain change detected on focus');
        lastUrl = currentUrl;
        lastDomain = currentDomain;
        lastDetectedProduct = null;
        initialize();
      }
    } catch (focusHandlerError) {
      console.error('🦉 Error in focus handler:', focusHandlerError);
    }
  });
} catch (focusError) {
  console.error('🦉 Error setting up focus listener:', focusError);
}

// Listen for visibility change
try {
  document.addEventListener('visibilitychange', () => {
    try {
      if (!document.hidden) {
        // Page became visible, check for changes
        const currentUrl = location.href;
        const currentDomain = location.hostname;
        
        if (currentUrl !== lastUrl || currentDomain !== lastDomain) {
          console.log('🦉 URL/Domain change detected on visibility change');
          lastUrl = currentUrl;
          lastDomain = currentDomain;
          lastDetectedProduct = null;
          initialize();
        }
      }
    } catch (visibilityHandlerError) {
      console.error('🦉 Error in visibility handler:', visibilityHandlerError);
    }
  });
} catch (visibilityError) {
  console.error('🦉 Error setting up visibility listener:', visibilityError);
}

// Handle messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    if (request.action === 'ping') {
      sendResponse({ 
        status: 'ready', 
        site: detectSiteName(),
        isProductPage: isProductPage(),
        currentUrl: window.location.href
      });
    } else if (request.action === 'popupOpened') {
      // Re-detect product when popup opens
      console.log('🦉 Popup opened, re-detecting product');
      sendProductInfo();
    } else if (request.action === 'forceRefresh') {
      // Force refresh product detection
      console.log('🦉 Force refresh requested');
      lastDetectedProduct = null;
      initialize();
    }
  } catch (messageError) {
    console.error('🦉 Error handling message:', messageError);
  }
});

// Periodic check for dynamic content changes (every 5 seconds)
try {
  setInterval(() => {
    try {
      // Only check if we're on a product page and haven't detected a product yet
      if (isProductPage() && !lastDetectedProduct) {
        console.log('🦉 Periodic check: Re-attempting product detection');
        sendProductInfo();
      }
    } catch (intervalHandlerError) {
      console.error('🦉 Error in periodic check:', intervalHandlerError);
    }
  }, 5000);
} catch (intervalError) {
  console.error('🦉 Error setting up periodic check:', intervalError);
}

console.log('🦉 Owl Price Checker content script fully loaded and monitoring for changes');