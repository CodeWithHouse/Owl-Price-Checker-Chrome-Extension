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
  
  // Setup auth listeners
  setupAuthListeners();
  
  // Notify content script that popup was opened
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0]) {
      // First try to ping the content script
      chrome.tabs.sendMessage(tabs[0].id, {action: 'ping'}, (response) => {
        if (chrome.runtime.lastError) {
          console.log('Content script not available on this page');
        } else if (response && response.status === 'ready') {
          console.log('Content script ready on:', response.currentUrl);
          // Send popup opened message
          chrome.tabs.sendMessage(tabs[0].id, {action: 'popupOpened'}).catch(() => {
            console.log('Error sending popup opened message');
          });
        }
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
      setupAuthListeners();
    }
  });
} else {
  // DOM already loaded
  if (typeof analytics === 'undefined') {
    loadProductData();
    setupAuthListeners();
  }
}

async function loadProductData() {
  const startTime = Date.now();
  
  try {
    // Get stored product data and user info
    const data = await chrome.storage.local.get([
      'currentProduct', 
      'comparisons', 
      'isLoggedIn', 
      'user',
      'pendingCoupons'
    ]);
    
    // Update user account section
    updateUserAccount(data.isLoggedIn, data.user);
    
    if (data.currentProduct) {
      displayProduct(data.currentProduct, data.isLoggedIn, data.pendingCoupons);
      
      // Track popup view with product
      if (typeof analytics !== 'undefined') {
        analytics.track('Popup Viewed With Product', {
          product_name: data.currentProduct.title,
          product_price: data.currentProduct.price,
          currency: data.currentProduct.currency,
          site: data.currentProduct.site,
          load_time_ms: Date.now() - startTime,
          user_logged_in: data.isLoggedIn || false
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
      showNoProduct(data.isLoggedIn);
      
      // Track popup view without product
      if (typeof analytics !== 'undefined') {
        analytics.track('Popup Viewed Without Product', {
          load_time_ms: Date.now() - startTime,
          user_logged_in: data.isLoggedIn || false
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

function updateUserAccount(isLoggedIn, user) {
  const userAccountEl = document.getElementById('userAccount');
  
  if (isLoggedIn && user) {
    // Show user account section
    userAccountEl.classList.remove('hidden');
    
    // Update user info
    document.getElementById('userName').textContent = user.firstName;
    document.getElementById('userSavings').textContent = 
      `$${(user.totalSavings || 0).toLocaleString()} saved`;
    document.getElementById('userCoupons').textContent = 
      `${user.couponsEarned || 0} coupons`;
  } else {
    // Hide user account section
    userAccountEl.classList.add('hidden');
  }
}

function displayProduct(product, isLoggedIn, pendingCoupons) {
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
  
  // Handle authentication prompt and coupon notification
  const authPrompt = document.getElementById('authPrompt');
  const couponNotification = document.getElementById('couponNotification');
  
  if (isLoggedIn) {
    // User is logged in - hide auth prompt and potentially show coupon notification
    authPrompt.classList.add('hidden');
    
    if (pendingCoupons && pendingCoupons.length > 0) {
      couponNotification.classList.remove('hidden');
    } else {
      couponNotification.classList.add('hidden');
    }
  } else {
    // User not logged in - show auth prompt
    authPrompt.classList.remove('hidden');
    couponNotification.classList.add('hidden');
  }
  
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

function showNoProduct(isLoggedIn) {
  document.getElementById('productInfo').classList.add('hidden');
  document.getElementById('comparisons').classList.add('hidden');
  document.getElementById('authPrompt').classList.add('hidden');
  document.getElementById('noProduct').classList.remove('hidden');
  
  // Show/hide auth CTA based on login status
  const authCTA = document.querySelector('.auth-cta');
  if (authCTA) {
    if (isLoggedIn) {
      authCTA.style.display = 'none';
    } else {
      authCTA.style.display = 'block';
    }
  }
  
  showStatus('No product detected');
}

function showStatus(message) {
  document.getElementById('status').textContent = message;
}

// Add authentication event listeners
function setupAuthListeners() {
  // Auth buttons
  const openAuthBtn = document.getElementById('openAuthBtn');
  const noProductAuthBtn = document.getElementById('noProductAuthBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  
  if (openAuthBtn) {
    openAuthBtn.addEventListener('click', openAuthWindow);
  }
  
  if (noProductAuthBtn) {
    noProductAuthBtn.addEventListener('click', openAuthWindow);
  }
  
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
}

function openAuthWindow() {
  // Track auth button click
  if (typeof analytics !== 'undefined') {
    analytics.track('Auth Button Clicked', {
      source: 'popup',
      button_location: event.target.id
    });
  }
  
  // Send message to background script to open auth window
  chrome.runtime.sendMessage({
    action: 'openAuth'
  });
}

async function handleLogout() {
  // Get current user data before logout for tracking
  const userData = await chrome.storage.local.get(['user']);
  const currentUser = userData.user;
  
  // Confirm logout
  if (!confirm('Are you sure you want to sign out?')) {
    return;
  }
  
  try {
    // Calculate session duration
    const sessionDuration = await calculateSessionDuration();
    
    // Track logout before clearing data
    if (typeof analytics !== 'undefined' && currentUser) {
      analytics.track('User Signed Out', {
        user_id: currentUser.id,
        email: currentUser.email,
        first_name: currentUser.firstName,
        logout_method: 'manual',
        logout_source: 'popup_button',
        session_duration_minutes: sessionDuration,
        total_savings: currentUser.totalSavings || 0,
        total_coupons: currentUser.couponsEarned || 0,
        timestamp: new Date().toISOString()
      });

      // Track session end
      analytics.track('Session Ended', {
        user_id: currentUser.id,
        session_type: 'authenticated',
        session_duration_minutes: sessionDuration,
        logout_reason: 'user_initiated',
        timestamp: new Date().toISOString()
      });
    }
    
    // Clear user data
    await chrome.storage.local.remove(['user', 'isLoggedIn', 'pendingCoupons', 'sessionStartTime']);
    
    // Reload popup data
    loadProductData();
    
    showSuccess('Signed out successfully');
  } catch (error) {
    console.error('Logout error:', error);
    showError('Failed to sign out. Please try again.');
    
    // Track logout error
    if (typeof analytics !== 'undefined') {
      analytics.track('Logout Failed', {
        error: error.message,
        user_id: currentUser?.id,
        timestamp: new Date().toISOString()
      });
    }
  }
}

// Calculate session duration
function calculateSessionDuration() {
  try {
    // Try to get session start time from Chrome storage instead of localStorage
    return new Promise((resolve) => {
      chrome.storage.local.get(['sessionStartTime'], (data) => {
        if (data.sessionStartTime) {
          const startTime = new Date(data.sessionStartTime);
          const endTime = new Date();
          const durationMs = endTime - startTime;
          resolve(Math.round(durationMs / (1000 * 60))); // Convert to minutes
        } else {
          resolve(0);
        }
      });
    });
  } catch (error) {
    console.warn('Could not calculate session duration:', error);
    return Promise.resolve(0);
  }
}

// Add showError and showSuccess functions
function showError(message) {
  // Create or update error message element
  let errorEl = document.querySelector('.temp-error-message');
  if (!errorEl) {
    errorEl = document.createElement('div');
    errorEl.className = 'temp-error-message';
    errorEl.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--error);
      color: white;
      padding: 8px 15px;
      border-radius: 4px;
      font-size: 13px;
      z-index: 1000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(errorEl);
  }
  
  errorEl.textContent = message;
  errorEl.style.display = 'block';
  
  setTimeout(() => {
    errorEl.style.display = 'none';
  }, 4000);
}

function showSuccess(message) {
  // Create or update success message element
  let successEl = document.querySelector('.temp-success-message');
  if (!successEl) {
    successEl = document.createElement('div');
    successEl.className = 'temp-success-message';
    successEl.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--success);
      color: white;
      padding: 8px 15px;
      border-radius: 4px;
      font-size: 13px;
      z-index: 1000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(successEl);
  }
  
  successEl.textContent = message;
  successEl.style.display = 'block';
  
  setTimeout(() => {
    successEl.style.display = 'none';
  }, 3000);
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
    // Reload popup data if user login status changes
    if (changes.isLoggedIn || changes.user) {
      loadProductData();
    }
    
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
      chrome.storage.local.get(['isLoggedIn', 'pendingCoupons'], (data) => {
        displayProduct(changes.currentProduct.newValue, data.isLoggedIn, data.pendingCoupons);
      });
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