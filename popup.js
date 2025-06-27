// popup.js - Owl Price Checker Popup Script

// Load analytics
const script = document.createElement('script');
script.src = 'analytics.js';
document.head.appendChild(script);

script.onload = function() {
  // Track popup opened
  analytics.screen('Price Comparison Popup', {
    timestamp: new Date().toISOString()
  });
  
  // Notify content script that popup was opened
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'popupOpened'}).catch(() => {
        // Content script might not be loaded on this page
        console.log('Content script not available on this page');
      });
    }
  });
  
  // Initialize popup
  document.addEventListener('DOMContentLoaded', function() {
    loadProductData();
  });
};

// Set open time
window.openTime = Date.now();

// Initialize when DOM is ready if analytics already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    if (typeof analytics === 'undefined') {
      // If analytics hasn't loaded yet, initialize without it
      loadProductData();
    }
  });
} else {
  // DOM already loaded
  if (typeof analytics === 'undefined') {
    loadProductData();
  }
}

async function loadProductData() {
  const startTime = Date.now();
  
  try {
    // Get stored product data
    const data = await chrome.storage.local.get(['currentProduct', 'comparisons']);
    
    if (data.currentProduct) {
      displayProduct(data.currentProduct);
      
      // Track popup view with product
      if (typeof analytics !== 'undefined') {
        analytics.track('Popup Viewed With Product', {
          product_name: data.currentProduct.title,
          product_price: data.currentProduct.price,
          currency: data.currentProduct.currency,
          site: data.currentProduct.site,
          load_time_ms: Date.now() - startTime
        });
      }
      
      if (data.comparisons) {
        const currencySymbol = data.currentProduct.currencySymbol || '$';
        displayComparisons(data.comparisons, data.currentProduct.price, currencySymbol);
      } else {
        showStatus('Fetching price comparisons...');
        // Wait for comparisons to be generated
        setTimeout(() => {
          loadProductData(); // Retry after a delay
        }, 2000);
      }
    } else {
      showNoProduct();
      
      // Track popup view without product
      if (typeof analytics !== 'undefined') {
        analytics.track('Popup Viewed Without Product', {
          load_time_ms: Date.now() - startTime
        });
      }
    }
  } catch (error) {
    console.error('Error loading data:', error);
    showStatus('Error loading data');
    
    // Track error
    if (typeof analytics !== 'undefined') {
      analytics.track('Popup Error', {
        error: error.message,
        type: 'data_load_error'
      });
    }
  }
}

function displayProduct(product) {
  // Hide no product message
  document.getElementById('noProduct').classList.add('hidden');
  
  // Show product info
  const productInfo = document.getElementById('productInfo');
  productInfo.classList.remove('hidden');
  
  // Set product details
  const productImage = document.getElementById('productImage');
  productImage.src = product.image || 'icons/icon48.png';
  productImage.onerror = function() {
    this.src = 'icons/icon48.png'; // Fallback if image fails to load
  };
  
  document.getElementById('productTitle').textContent = product.title;
  
  // Use the currency symbol from the product
  const currencySymbol = product.currencySymbol || '$';
  document.getElementById('currentPrice').textContent = `${currencySymbol}${product.price.toLocaleString()}`;
  document.getElementById('siteName').textContent = product.site;
  
  showStatus(`Comparing prices for ${product.site}`);
}

function displayComparisons(comparisons, currentPrice, currencySymbol = '$') {
  const comparisonsDiv = document.getElementById('comparisons');
  const comparisonList = document.getElementById('comparisonList');
  
  // Clear existing comparisons
  comparisonList.innerHTML = '';
  
  // Show comparisons section
  comparisonsDiv.classList.remove('hidden');
  
  // Add each comparison
  comparisons.forEach(comp => {
    const item = createComparisonItem(comp, currencySymbol);
    comparisonList.appendChild(item);
  });
  
  // Update status and track
  const cheaperCount = comparisons.filter(c => c.price < currentPrice).length;
  const lowestPrice = Math.min(...comparisons.map(c => c.price));
  const savings = currentPrice - lowestPrice;
  
  if (cheaperCount > 0) {
    showStatus(`Found ${cheaperCount} site${cheaperCount > 1 ? 's' : ''} with lower prices! Save up to ${currencySymbol}${savings.toLocaleString()}`);
    
    // Track savings opportunity shown
    if (typeof analytics !== 'undefined') {
      analytics.track('Savings Opportunity Shown', {
        cheaper_sites_count: cheaperCount,
        potential_savings: savings,
        savings_percentage: Math.round((savings / currentPrice) * 100),
        lowest_price: lowestPrice,
        current_price: currentPrice
      });
    }
  } else {
    showStatus('This is the best price available! 🎉');
    
    // Track best price confirmation
    if (typeof analytics !== 'undefined') {
      analytics.track('Best Price Confirmed', {
        price: currentPrice,
        sites_checked: comparisons.length
      });
    }
  }
}

function createComparisonItem(comparison, currencySymbol = '$') {
  const div = document.createElement('div');
  div.className = 'comparison-item';
  div.dataset.site = comparison.site;
  div.dataset.price = comparison.price;
  
  if (!comparison.available) {
    div.className += ' not-available';
  }
  
  const cheaper = comparison.percentDiff < 0;
  const diffClass = cheaper ? 'cheaper' : 'expensive';
  const diffSymbol = cheaper ? '' : '+';
  
  div.innerHTML = `
    <div class="site-info">
      <div class="site-name">${comparison.site}</div>
      <div class="site-price">${currencySymbol}${comparison.price.toLocaleString()}</div>
    </div>
    <div class="price-diff ${diffClass}">
      <div class="diff-amount">${diffSymbol}${currencySymbol}${Math.abs(comparison.difference).toLocaleString()}</div>
      <div class="diff-percent">${diffSymbol}${comparison.percentDiff}%</div>
    </div>
  `;
  
  // Track clicks on comparison items
  div.addEventListener('click', () => {
    // Track comparison click
    if (typeof analytics !== 'undefined') {
      analytics.track('Comparison Site Clicked', {
        target_site: comparison.site,
        target_price: comparison.price,
        price_difference: comparison.difference,
        percent_difference: comparison.percentDiff,
        is_cheaper: comparison.percentDiff < 0,
        url: comparison.url
      });
    }
    
    // Open site
    chrome.tabs.create({ url: comparison.url });
  });
  
  return div;
}

function showNoProduct() {
  document.getElementById('productInfo').classList.add('hidden');
  document.getElementById('comparisons').classList.add('hidden');
  document.getElementById('noProduct').classList.remove('hidden');
  showStatus('No product detected');
}

function showStatus(message) {
  document.getElementById('status').textContent = message;
}

// Track popup interactions
document.addEventListener('click', function(e) {
  // Skip if clicking on comparison items (already tracked separately)
  if (e.target.closest('.comparison-item')) {
    return;
  }
  
  // Track general clicks
  if (e.target.id || e.target.className) {
    if (typeof analytics !== 'undefined') {
      analytics.track('Popup Element Clicked', {
        element_id: e.target.id || null,
        element_class: e.target.className || null,
        element_type: e.target.tagName
      });
    }
  }
});

// Track popup close
window.addEventListener('beforeunload', function() {
  if (typeof analytics !== 'undefined') {
    analytics.track('Popup Closed', {
      time_open_seconds: Math.round((Date.now() - window.openTime) / 1000)
    });
  }
});

// Listen for storage changes (real-time updates)
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    // Update comparisons if they change
    if (changes.comparisons) {
      chrome.storage.local.get(['currentProduct'], (data) => {
        if (data.currentProduct) {
          const currencySymbol = data.currentProduct.currencySymbol || '$';
          displayComparisons(changes.comparisons.newValue, data.currentProduct.price, currencySymbol);
          
          // Track real-time update
          if (typeof analytics !== 'undefined') {
            analytics.track('Comparison Data Updated', {
              update_type: 'real-time',
              comparisons_count: changes.comparisons.newValue.length
            });
          }
        }
      });
    }
    
    // Update product info if it changes
    if (changes.currentProduct) {
      displayProduct(changes.currentProduct.newValue);
    }
  }
});

// Handle errors gracefully
window.addEventListener('error', function(event) {
  console.error('Popup error:', event.error);
  if (typeof analytics !== 'undefined') {
    analytics.track('Popup JavaScript Error', {
      message: event.error.message,
      filename: event.filename,
      line: event.lineno,
      column: event.colno
    });
  }
});