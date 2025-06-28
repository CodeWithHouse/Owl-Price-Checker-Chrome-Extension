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

console.log('Owl Price Checker content script loaded on:', window.location.href);

// Generate a simple hash for product URLs to detect changes
function generateProductHash(url, title, price) {
  try {
    // Create a simple hash from URL path + title + price
    const urlPath = new URL(url).pathname;
    return btoa(urlPath + title + price).substring(0, 16);
  } catch (error) {
    console.error('Error generating product hash:', error);
    return 'fallback_' + Date.now();
  }
}

// Check if we're on a new product page
function isNewProduct(productInfo) {
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
}

// Clear stored data when navigating to new domain/product
function clearProductDataIfNeeded() {
  const currentUrl = window.location.href;
  const currentDomain = window.location.hostname;
  
  // Check if domain changed
  if (currentDomain !== lastDomain) {
    console.log('Domain changed from', lastDomain, 'to', currentDomain);
    lastDomain = currentDomain;
    lastDetectedProduct = null;
    
    // Clear stored data for domain change
    chrome.runtime.sendMessage({
      action: 'clearProduct'
    });
    return true;
  }
  
  // Check if URL changed significantly within same domain
  if (currentUrl !== lastUrl) {
    console.log('URL changed from', lastUrl, 'to', currentUrl);
    lastUrl = currentUrl;
    
    // For significant URL changes, clear product data
    const urlDiff = Math.abs(currentUrl.length - lastUrl.length);
    if (urlDiff > 10) { // Significant URL change
      lastDetectedProduct = null;
      chrome.runtime.sendMessage({
        action: 'clearProduct'
      });
      return true;
    }
  }
  
  return false;
}

// Enhanced price extraction for Nike
function extractPriceFromNike() {
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
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      const priceText = element.textContent.trim();
      const price = extractPrice(priceText);
      if (price > 0) {
        console.log('Nike price found with selector:', selector, 'Price:', price);
        return { element, priceText, price };
      }
    }
  }
  
  return null;
}

// Enhanced price extraction for Amazon
function extractPriceFromAmazon() {
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
    const element = document.querySelector(selector);
    if (element) {
      const priceText = element.textContent.trim();
      const price = extractPrice(priceText);
      if (price > 0) {
        console.log('Amazon price found with selector:', selector, 'Price:', price);
        return { element, priceText, price };
      }
    }
  }
  
  return null;
}

// Detect currency from price text
function detectCurrency(priceText) {
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
}

// Detect if current page is an e-commerce product page
function isProductPage() {
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
}

// Find price element using patterns
function findPriceElement() {
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
  const metaPrice = document.querySelector('meta[property="product:price:amount"]') ||
                   document.querySelector('meta[property="og:price:amount"]');
  if (metaPrice) {
    const price = extractPrice(metaPrice.content);
    if (price > 0) return metaPrice;
  }
  
  // Try CSS selectors
  for (const selector of UNIVERSAL_PATTERNS.price) {
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
  }
  
  return null;
}

// Find element using patterns
function findElement(patterns) {
  for (const selector of patterns) {
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
  }
  return null;
}

// Extract price from text
function extractPrice(text) {
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
  
  return parseFloat(normalizedText) || 0;
}

// Detect site name from domain
function detectSiteName() {
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
}

// Extract product information with comprehensive error handling
function extractProductInfo() {
  try {
    if (!isProductPage()) {
      console.log('Not a product page');
      return null;
    }
    
    // Extract title
    const titleElement = findElement(UNIVERSAL_PATTERNS.title);
    let title = titleElement ? titleElement.textContent.trim() : '';
    
    // Clean up title
    if (!title || title.length < 5) {
      title = document.title ? document.title.split('|')[0].split('-')[0].trim() : '';
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
          if (!selector.startsWith('meta')) {
            const imgElement = document.querySelector(selector);
            if (imgElement && imgElement.src) {
              image = imgElement.src;
              break;
            }
          }
        }
      }
      
      // Fallback to any large image
      if (!image) {
        const images = document.querySelectorAll('img');
        for (const img of images) {
          if (img && img.src && img.width > 200 && img.height > 200 && !img.src.includes('logo')) {
            image = img.src;
            break;
          }
        }
      }
    } catch (imageError) {
      console.warn('Error extracting image:', imageError);
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
      
      console.log('Product extracted:', productInfo);
      return productInfo;
    }
    
    console.log('Failed to extract product:', { title, price });
    return null;
  } catch (error) {
    console.error('Error extracting product info:', error);
    return null;
  }
}

// Send product info to background script
function sendProductInfo() {
  // First check if we need to clear data due to navigation
  const wasCleared = clearProductDataIfNeeded();
  
  const productInfo = extractProductInfo();
  
  if (productInfo && productInfo.title && productInfo.price) {
    // Check if this is a new product
    if (isNewProduct(productInfo) || wasCleared) {
      console.log('New product detected:', productInfo);
      lastDetectedProduct = productInfo;
      
      // Clear old data and send new product
      chrome.runtime.sendMessage({
        action: 'clearAndDetectProduct',
        data: productInfo
      }).catch(error => {
        console.error('Error sending product info:', error);
      });
    } else {
      console.log('Same product detected, skipping update');
    }
  } else {
    // No product detected, clear if we had one before
    if (lastDetectedProduct) {
      console.log('No product detected, clearing data');
      lastDetectedProduct = null;
      chrome.runtime.sendMessage({
        action: 'clearProduct'
      }).catch(error => {
        console.error('Error clearing product:', error);
      });
    }
  }
}

// Initialize with debouncing
function initialize() {
  console.log('Initializing Owl Price Checker on:', window.location.href);
  
  // Clear any pending detection
  if (detectionTimeout) {
    clearTimeout(detectionTimeout);
  }
  
  // Debounce detection to avoid multiple calls
  detectionTimeout = setTimeout(() => {
    sendProductInfo();
  }, 1500);
}

// Set up initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Enhanced URL change detection for SPA navigation
const observer = new MutationObserver((mutations) => {
  const url = location.href;
  if (url !== lastUrl) {
    console.log('URL changed detected by observer:', lastUrl, '->', url);
    lastUrl = url;
    lastDetectedProduct = null; // Clear cache immediately
    
    // Re-initialize after a short delay to let the page load
    setTimeout(() => {
      initialize();
    }, 500);
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
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['href']
    });
  });
}

// Listen for popstate events (back/forward navigation)
window.addEventListener('popstate', () => {
  console.log('Navigation detected via popstate');
  lastDetectedProduct = null;
  setTimeout(() => {
    initialize();
  }, 500);
});

// Listen for pushstate/replacestate (SPA navigation)
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function() {
  originalPushState.apply(history, arguments);
  console.log('Navigation detected via pushState');
  lastDetectedProduct = null;
  setTimeout(() => {
    initialize();
  }, 500);
};

history.replaceState = function() {
  originalReplaceState.apply(history, arguments);
  console.log('Navigation detected via replaceState');
  lastDetectedProduct = null;
  setTimeout(() => {
    initialize();
  }, 500);
};

// Additional check on focus (when user returns to tab)
window.addEventListener('focus', () => {
  const currentUrl = location.href;
  const currentDomain = location.hostname;
  
  if (currentUrl !== lastUrl || currentDomain !== lastDomain) {
    console.log('URL/Domain change detected on focus');
    lastUrl = currentUrl;
    lastDomain = currentDomain;
    lastDetectedProduct = null;
    initialize();
  }
});

// Listen for visibility change
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    // Page became visible, check for changes
    const currentUrl = location.href;
    const currentDomain = location.hostname;
    
    if (currentUrl !== lastUrl || currentDomain !== lastDomain) {
      console.log('URL/Domain change detected on visibility change');
      lastUrl = currentUrl;
      lastDomain = currentDomain;
      lastDetectedProduct = null;
      initialize();
    }
  }
});

// Handle messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ 
      status: 'ready', 
      site: detectSiteName(),
      isProductPage: isProductPage(),
      currentUrl: window.location.href
    });
  } else if (request.action === 'popupOpened') {
    // Re-detect product when popup opens
    console.log('Popup opened, re-detecting product');
    sendProductInfo();
  } else if (request.action === 'forceRefresh') {
    // Force refresh product detection
    console.log('Force refresh requested');
    lastDetectedProduct = null;
    initialize();
  }
});

// Periodic check for dynamic content changes (every 5 seconds)
setInterval(() => {
  // Only check if we're on a product page and haven't detected a product yet
  if (isProductPage() && !lastDetectedProduct) {
    console.log('Periodic check: Re-attempting product detection');
    sendProductInfo();
  }
}, 5000);

console.log('Owl Price Checker content script fully loaded and monitoring for changes');