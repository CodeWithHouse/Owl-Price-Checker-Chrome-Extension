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
let lastUrl = window.location.href;
let lastDomain = window.location.hostname;

console.log('🦉 Owl Price Checker content script loaded on:', window.location.href);

// Generate a simple hash for product URLs to detect changes
function generateProductHash(url, title, price) {
  try {
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
    
    const currentPath = new URL(productInfo.url).pathname;
    const lastPath = new URL(lastDetectedProduct.url).pathname;
    
    if (window.location.hostname.includes('nike.com')) {
      const currentNikeId = currentPath.match(/\/t\/[^\/]+\/([^\/\?]+)/);
      const lastNikeId = lastPath.match(/\/t\/[^\/]+\/([^\/\?]+)/);
      if (currentNikeId && lastNikeId && currentNikeId[1] !== lastNikeId[1]) {
        return true;
      }
    }
    
    const titleChanged = productInfo.title !== lastDetectedProduct.title;
    const priceChanged = Math.abs(productInfo.price - lastDetectedProduct.price) > 1;
    const urlChanged = currentPath !== lastPath;
    
    return titleChanged || priceChanged || urlChanged;
  } catch (error) {
    console.error('🦉 Error checking if new product:', error);
    return true;
  }
}

// Clear stored data when navigating to new domain/product
function clearProductDataIfNeeded() {
  try {
    const currentUrl = window.location.href;
    const currentDomain = window.location.hostname;
    
    if (currentDomain !== lastDomain) {
      console.log('🦉 Domain changed from', lastDomain, 'to', currentDomain);
      lastDomain = currentDomain;
      lastDetectedProduct = null;
      
      chrome.runtime.sendMessage({
        action: 'clearProduct'
      }).catch(error => {
        console.error('🦉 Error sending clear message:', error);
      });
      return true;
    }
    
    if (currentUrl !== lastUrl) {
      console.log('🦉 URL changed from', lastUrl, 'to', currentUrl);
      lastUrl = currentUrl;
      
      const urlDiff = Math.abs(currentUrl.length - lastUrl.length);
      if (urlDiff > 10) {
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
    
    for (const [symbol, code] of Object.entries(CURRENCY_MAP)) {
      if (priceText.includes(symbol)) {
        return { symbol, code };
      }
    }
    
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
    // Immediate exit for known non-ecommerce sites
    const hostname = window.location.hostname;
    if (hostname.includes('claude.ai') || 
        hostname.includes('openai.com') || 
        hostname.includes('github.com') ||
        hostname.includes('google.com') ||
        hostname.includes('stackoverflow.com')) {
      return false;
    }
    
    let pageText = '';
    try {
      pageText = document.body?.innerText?.toLowerCase() || '';
    } catch (textError) {
      console.warn('🦉 Error getting page text:', textError);
      pageText = '';
    }
    
    const url = window.location.href.toLowerCase();
    
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
    
    if (window.location.hostname.includes('nike.com')) {
      if (url.includes('/t/') || url.includes('/w/') || url.includes('/m/')) {
        return true;
      }
    }
    
    const indicatorCount = ECOMMERCE_INDICATORS.filter(indicator => 
      pageText.includes(indicator)
    ).length;
    
    let hasProductSchema = false;
    try {
      hasProductSchema = document.querySelector('[itemtype*="schema.org/Product"]') !== null;
    } catch (schemaError) {
      console.warn('🦉 Error checking product schema:', schemaError);
    }
    
    let hasProductMeta = false;
    try {
      hasProductMeta = document.querySelector('meta[property="og:type"][content="product"]') !== null ||
                        document.querySelector('meta[property="product:price:amount"]') !== null;
    } catch (metaError) {
      console.warn('🦉 Error checking product meta tags:', metaError);
    }
    
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
    
    if (hostname.includes('nike.com')) {
      const nikePrice = extractPriceFromNike();
      if (nikePrice) return nikePrice.element;
    } else if (hostname.includes('amazon')) {
      const amazonPrice = extractPriceFromAmazon();
      if (amazonPrice) return amazonPrice.element;
    }
    
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
    
    const cleanedText = text.replace(/[^\d.,]/g, '');
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
    
    // Quick exit for non-ecommerce sites to prevent DOM operations
    if (hostname.includes('claude.ai') || 
        hostname.includes('openai.com') || 
        hostname.includes('github.com') ||
        hostname.includes('google.com') ||
        hostname.includes('stackoverflow.com')) {
      return 'Non-Ecommerce Site';
    }
    
    if (hostname.includes('nike.com')) return 'Nike';
    if (hostname.includes('amazon')) return 'Amazon';
    if (hostname.includes('ebay')) return 'eBay';
    if (hostname.includes('walmart')) return 'Walmart';
    if (hostname.includes('target')) return 'Target';
    
    // Safe string operations only
    let siteName = hostname
      .replace(/^www\./, '')
      .replace(/\.(com|net|org|co|io|store|shop|in|uk|ca|au|de|fr|es|it|jp|cn|sg).*$/, '');
    
    if (siteName && siteName.length > 0) {
      siteName = siteName.charAt(0).toUpperCase() + siteName.slice(1);
    } else {
      siteName = 'Unknown Site';
    }
    
    return siteName;
  } catch (error) {
    console.error('🦉 Error detecting site name:', error);
    return 'Unknown Site';
  }
}

// Extract product information with comprehensive error handling
function extractProductInfo() {
  try {
    // Immediate exit for known non-ecommerce sites
    const hostname = window.location.hostname;
    if (hostname.includes('claude.ai') || 
        hostname.includes('openai.com') || 
        hostname.includes('github.com') ||
        hostname.includes('google.com') ||
        hostname.includes('stackoverflow.com')) {
      return null;
    }
    
    if (!isProductPage()) {
      return null;
    }
    
    let title = '';
    try {
      const titleElement = findElement(UNIVERSAL_PATTERNS.title);
      title = titleElement ? titleElement.textContent.trim() : '';
      
      if (!title || title.length < 5) {
        try {
          title = document.title ? document.title.split('|')[0].split('-')[0].trim() : '';
        } catch (titleError) {
          console.warn('🦉 Error getting document title:', titleError);
          title = '';
        }
      }
    } catch (titleExtractionError) {
      console.warn('🦉 Error extracting title:', titleExtractionError);
      title = '';
    }
    
    let price = 0;
    let priceText = '';
    
    try {
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
    } catch (priceExtractionError) {
      console.warn('🦉 Error extracting price:', priceExtractionError);
      price = 0;
      priceText = '';
    }
    
    let currency;
    try {
      currency = detectCurrency(priceText);
    } catch (currencyError) {
      console.warn('🦉 Error detecting currency:', currencyError);
      currency = { symbol: '$', code: 'USD' };
    }
    
    let image = '';
    
    try {
      try {
        const metaImage = document.querySelector('meta[property="og:image"]') ||
                         document.querySelector('meta[name="twitter:image"]');
        if (metaImage && metaImage.content) {
          image = metaImage.content;
        }
      } catch (metaError) {
        console.warn('🦉 Error checking meta image tags:', metaError);
      }
      
      if (!image) {
        try {
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
        } catch (patternError) {
          console.warn('🦉 Error with image pattern search:', patternError);
        }
      }
      
      if (!image) {
        try {
          const images = document.querySelectorAll('img');
          for (const img of images) {
            try {
              if (img && img.src && img.width > 200 && img.height > 200 && !img.src.includes('logo')) {
                image = img.src;
                break;
              }
            } catch (imgError) {
              console.warn('🦉 Error checking individual image:', imgError);
              continue;
            }
          }
        } catch (fallbackError) {
          console.warn('🦉 Error with fallback image search:', fallbackError);
        }
      }
    } catch (imageError) {
      console.warn('🦉 Error extracting image:', imageError);
      image = '';
    }
    
    const url = window.location.href;
    const site = detectSiteName();
    
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
    const wasCleared = clearProductDataIfNeeded();
    const productInfo = extractProductInfo();
    
    if (productInfo && productInfo.title && productInfo.price) {
      if (isNewProduct(productInfo) || wasCleared) {
        console.log('🦉 New product detected:', productInfo);
        lastDetectedProduct = productInfo;
        
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
    // Skip initialization on non-ecommerce sites
    const hostname = window.location.hostname;
    if (hostname.includes('claude.ai') || 
        hostname.includes('openai.com') || 
        hostname.includes('github.com') ||
        hostname.includes('google.com') ||
        hostname.includes('stackoverflow.com')) {
      return;
    }
    
    console.log('🦉 Initializing Owl Price Checker on:', window.location.href);
    
    if (detectionTimeout) {
      clearTimeout(detectionTimeout);
    }
    
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
        lastDetectedProduct = null;
        
        setTimeout(() => {
          initialize();
        }, 500);
      }
    } catch (observerError) {
      console.error('🦉 Error in mutation observer:', observerError);
    }
  });

  if (document.body) {
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['href']
    });
  } else {
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
      console.log('🦉 Popup opened, re-detecting product');
      sendProductInfo();
    } else if (request.action === 'forceRefresh') {
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