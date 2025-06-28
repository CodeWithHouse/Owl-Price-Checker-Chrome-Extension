// popup.js - Fixed Owl Price Checker Popup Script

// Global variables
let analytics = null;
window.openTime = Date.now();

// Load analytics with better error handling
function loadAnalytics() {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'analytics.js';
    script.onload = function() {
      analytics = window.analytics || null;
      if (analytics) {
        console.log('🦉 Analytics loaded successfully in popup');
        // Track popup opened
        analytics.screen('Price Comparison Popup', {
          timestamp: new Date().toISOString()
        });
      }
      resolve();
    };
    script.onerror = function(error) {
      console.warn('🦉 Failed to load analytics in popup:', error);
      analytics = null;
      resolve();
    };
    document.head.appendChild(script);
    
    // Timeout fallback
    setTimeout(() => {
      if (!analytics) {
        console.warn('🦉 Analytics load timeout in popup');
      }
      resolve();
    }, 2000);
  });
}

// Initialize popup
async function initializePopup() {
  try {
    // Load analytics first
    await loadAnalytics();
    
    // Setup auth listeners
    setupAuthListeners();
    
    // Notify content script that popup was opened
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs && tabs[0]) {
        // First try to ping the content script
        chrome.tabs.sendMessage(tabs[0].id, {action: 'ping'}, (response) => {
          if (chrome.runtime.lastError) {
            console.log('🦉 Content script not available on this page');
          } else if (response && response.status === 'ready') {
            console.log('🦉 Content script ready on:', response.currentUrl);
            // Send popup opened message
            chrome.tabs.sendMessage(tabs[0].id, {action: 'popupOpened'}).catch(() => {
              console.log('🦉 Error sending popup opened message');
            });
          }
        });
      }
    });
    
    // Load product data
    loadProductData();
  } catch (error) {
    console.error('🦉 Error initializing popup:', error);
    showStatus('Error loading extension');
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePopup);
} else {
  initializePopup();
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
      if (analytics) {
        analytics.track('Popup Viewed With Product', {
          product_name: data.currentProduct.title,
          product_price: data.currentProduct.price,
          currency: data.currentProduct.currency,
          site: data.currentProduct.site,
          load_time_ms: Date.now() - startTime,
          user_logged_in: data.isLoggedIn || false
        });
      }
      
      if (data.comparisons && Array.isArray(data.comparisons)) {
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
      if (analytics) {
        analytics.track('Popup Viewed Without Product', {
          load_time_ms: Date.now() - startTime,
          user_logged_in: data.isLoggedIn || false
        });
      }
    }
  } catch (error) {
    console.error('🦉 Error loading data:', error);
    showStatus('Error loading data');
    
    // Track error
    if (analytics) {
      analytics.track('Popup Error', {
        error: error.message,
        type: 'data_load_error'
      });
    }
  }
}

function updateUserAccount(isLoggedIn, user) {
  try {
    const userAccountEl = document.getElementById('userAccount');
    
    if (!userAccountEl) {
      console.warn('🦉 User account element not found');
      return;
    }
    
    if (isLoggedIn && user) {
      // Show user account section
      userAccountEl.classList.remove('hidden');
      
      // Update user info safely
      const userNameEl = document.getElementById('userName');
      const userSavingsEl = document.getElementById('userSavings');
      const userCouponsEl = document.getElementById('userCoupons');
      
      if (userNameEl) {
        userNameEl.textContent = user.firstName || 'User';
      }
      if (userSavingsEl) {
        userSavingsEl.textContent = `$${(user.totalSavings || 0).toLocaleString()} saved`;
      }
      if (userCouponsEl) {
        userCouponsEl.textContent = `${user.couponsEarned || 0} coupons`;
      }
    } else {
      // Hide user account section
      userAccountEl.classList.add('hidden');
    }
  } catch (error) {
    console.error('🦉 Error updating user account:', error);
  }
}

function displayProduct(product, isLoggedIn, pendingCoupons) {
  try {
    // Validate product data
    if (!product || !product.title || !product.price) {
      console.error('🦉 Invalid product data:', product);
      showNoProduct(isLoggedIn);
      return;
    }

    // Hide no product message
    const noProductEl = document.getElementById('noProduct');
    if (noProductEl) {
      noProductEl.classList.add('hidden');
    }
    
    // Show product info
    const productInfo = document.getElementById('productInfo');
    if (!productInfo) {
      console.error('🦉 Product info element not found');
      return;
    }
    productInfo.classList.remove('hidden');
    
    // Set product details safely
    const productImage = document.getElementById('productImage');
    if (productImage) {
      productImage.src = product.image || 'icons/icon48.png';
      productImage.onerror = function() {
        this.src = 'icons/icon48.png'; // Fallback if image fails to load
      };
    }
    
    const productTitle = document.getElementById('productTitle');
    if (productTitle) {
      productTitle.textContent = product.title;
    }
    
    // Use the currency symbol from the product
    const currencySymbol = product.currencySymbol || '$';
    const currentPrice = document.getElementById('currentPrice');
    if (currentPrice) {
      currentPrice.textContent = `${currencySymbol}${product.price.toLocaleString()}`;
    }
    
    const siteName = document.getElementById('siteName');
    if (siteName) {
      siteName.textContent = product.site || 'Unknown Site';
    }
    
    // Handle authentication prompt and coupon notification
    const authPrompt = document.getElementById('authPrompt');
    const couponNotification = document.getElementById('couponNotification');
    
    if (isLoggedIn) {
      // User is logged in - hide auth prompt and potentially show coupon notification
      if (authPrompt) {
        authPrompt.classList.add('hidden');
      }
      
      if (couponNotification) {
        if (pendingCoupons && Array.isArray(pendingCoupons) && pendingCoupons.length > 0) {
          couponNotification.classList.remove('hidden');
        } else {
          couponNotification.classList.add('hidden');
        }
      }
    } else {
      // User not logged in - show auth prompt
      if (authPrompt) {
        authPrompt.classList.remove('hidden');
      }
      if (couponNotification) {
        couponNotification.classList.add('hidden');
      }
    }
    
    showStatus(`Comparing prices for ${product.site || 'this site'}`);
  } catch (error) {
    console.error('🦉 Error displaying product:', error);
    showNoProduct(isLoggedIn);
  }
}

function displayComparisons(comparisons, currentPrice, currencySymbol = '$') {
  try {
    // Validate inputs
    if (!Array.isArray(comparisons)) {
      console.error('🦉 Invalid comparisons data:', comparisons);
      return;
    }

    const comparisonsDiv = document.getElementById('comparisons');
    const comparisonList = document.getElementById('comparisonList');
    
    if (!comparisonsDiv || !comparisonList) {
      console.error('🦉 Comparison elements not found');
      return;
    }
    
    // Clear existing comparisons
    comparisonList.innerHTML = '';
    
    // Show comparisons section
    comparisonsDiv.classList.remove('hidden');
    
    // Add each comparison
    comparisons.forEach(comp => {
      if (comp && comp.site && comp.price !== undefined) {
        const item = createComparisonItem(comp, currencySymbol);
        if (item) {
          comparisonList.appendChild(item);
        }
      }
    });
    
    // Update status and track
    const validComparisons = comparisons.filter(c => c && c.price !== undefined);
    const cheaperCount = validComparisons.filter(c => c.price < currentPrice).length;
    const prices = validComparisons.map(c => c.price);
    const lowestPrice = prices.length > 0 ? Math.min(...prices) : currentPrice;
    const savings = currentPrice - lowestPrice;
    
    if (cheaperCount > 0) {
      showStatus(`Found ${cheaperCount} site${cheaperCount > 1 ? 's' : ''} with lower prices! Save up to ${currencySymbol}${Math.max(0, savings).toLocaleString()}`);
      
      // Track savings opportunity shown
      if (analytics) {
        analytics.track('Savings Opportunity Shown', {
          cheaper_sites_count: cheaperCount,
          potential_savings: Math.max(0, savings),
          savings_percentage: Math.round((Math.max(0, savings) / currentPrice) * 100),
          lowest_price: lowestPrice,
          current_price: currentPrice
        });
      }
    } else {
      showStatus('This is the best price available! 🎉');
      
      // Track best price confirmation
      if (analytics) {
        analytics.track('Best Price Confirmed', {
          price: currentPrice,
          sites_checked: validComparisons.length
        });
      }
    }
  } catch (error) {
    console.error('🦉 Error displaying comparisons:', error);
  }
}

function createComparisonItem(comparison, currencySymbol = '$') {
  try {
    if (!comparison || !comparison.site || comparison.price === undefined) {
      console.error('🦉 Invalid comparison data:', comparison);
      return null;
    }

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
        <div class="diff-amount">${diffSymbol}${currencySymbol}${Math.abs(comparison.difference || 0).toLocaleString()}</div>
        <div class="diff-percent">${diffSymbol}${comparison.percentDiff || 0}%</div>
      </div>
    `;
    
    // Track clicks on comparison items
    div.addEventListener('click', () => {
      // Track comparison click
      if (analytics) {
        analytics.track('Comparison Site Clicked', {
          target_site: comparison.site,
          target_price: comparison.price,
          price_difference: comparison.difference || 0,
          percent_difference: comparison.percentDiff || 0,
          is_cheaper: (comparison.percentDiff || 0) < 0,
          url: comparison.url
        });
      }
      
      // Open site
      if (comparison.url) {
        chrome.tabs.create({ url: comparison.url });
      }
    });
    
    return div;
  } catch (error) {
    console.error('🦉 Error creating comparison item:', error);
    return null;
  }
}

function showNoProduct(isLoggedIn) {
  try {
    const productInfoEl = document.getElementById('productInfo');
    const comparisonsEl = document.getElementById('comparisons');
    const authPromptEl = document.getElementById('authPrompt');
    const noProductEl = document.getElementById('noProduct');
    
    if (productInfoEl) productInfoEl.classList.add('hidden');
    if (comparisonsEl) comparisonsEl.classList.add('hidden');
    if (authPromptEl) authPromptEl.classList.add('hidden');
    if (noProductEl) noProductEl.classList.remove('hidden');
    
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
  } catch (error) {
    console.error('🦉 Error showing no product state:', error);
  }
}

function showStatus(message) {
  try {
    const statusEl = document.getElementById('status');
    if (statusEl) {
      statusEl.textContent = message;
    }
  } catch (error) {
    console.error('🦉 Error showing status:', error);
  }
}

// Add authentication event listeners
function setupAuthListeners() {
  try {
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
  } catch (error) {
    console.error('🦉 Error setting up auth listeners:', error);
  }
}

function openAuthWindow() {
  try {
    // Track auth button click
    if (analytics) {
      analytics.track('Auth Button Clicked', {
        source: 'popup',
        button_location: event.target ? event.target.id : 'unknown'
      });
    }
    
    // Send message to background script to open auth window
    chrome.runtime.sendMessage({
      action: 'openAuth'
    });
  } catch (error) {
    console.error('🦉 Error opening auth window:', error);
  }
}

async function handleLogout() {
  try {
    // Get current user data before logout for tracking
    const userData = await chrome.storage.local.get(['user']);
    const currentUser = userData.user;
    
    // Confirm logout
    if (!confirm('Are you sure you want to sign out?')) {
      return;
    }
    
    // Calculate session duration
    const sessionDuration = await calculateSessionDuration();
    
    // Track logout before clearing data
    if (analytics && currentUser) {
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
    console.error('🦉 Logout error:', error);
    showError('Failed to sign out. Please try again.');
    
    // Track logout error
    if (analytics) {
      analytics.track('Logout Failed', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
}

// Calculate session duration
function calculateSessionDuration() {
  try {
    // Try to get session start time from Chrome storage
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
    console.warn('🦉 Could not calculate session duration:', error);
    return Promise.resolve(0);
  }
}

// Add showError and showSuccess functions
function showError(message) {
  try {
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
  } catch (error) {
    console.error('🦉 Error showing error message:', error);
  }
}

function showSuccess(message) {
  try {
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
  } catch (error) {
    console.error('🦉 Error showing success message:', error);
  }
}

// Track popup interactions
document.addEventListener('click', function(e) {
  try {
    // Skip if clicking on comparison items (already tracked separately)
    if (e.target.closest('.comparison-item')) {
      return;
    }
    
    // Track general clicks
    if ((e.target.id || e.target.className) && analytics) {
      analytics.track('Popup Element Clicked', {
        element_id: e.target.id || null,
        element_class: e.target.className || null,
        element_type: e.target.tagName
      });
    }
  } catch (error) {
    console.error('🦉 Error tracking click:', error);
  }
});

// Track popup close
window.addEventListener('beforeunload', function() {
  try {
    if (analytics) {
      analytics.track('Popup Closed', {
        time_open_seconds: Math.round((Date.now() - window.openTime) / 1000)
      });
    }
  } catch (error) {
    console.error('🦉 Error tracking popup close:', error);
  }
});

// Listen for storage changes (real-time updates)
chrome.storage.onChanged.addListener((changes, namespace) => {
  try {
    if (namespace === 'local') {
      // Reload popup data if user login status changes
      if (changes.isLoggedIn || changes.user) {
        loadProductData();
      }
      
      // Update comparisons if they change
      if (changes.comparisons && changes.comparisons.newValue) {
        chrome.storage.local.get(['currentProduct'], (data) => {
          if (data.currentProduct) {
            const currencySymbol = data.currentProduct.currencySymbol || '$';
            displayComparisons(changes.comparisons.newValue, data.currentProduct.price, currencySymbol);
            
            // Track real-time update
            if (analytics) {
              analytics.track('Comparison Data Updated', {
                update_type: 'real-time',
                comparisons_count: changes.comparisons.newValue.length
              });
            }
          }
        });
      }
      
      // Update product info if it changes
      if (changes.currentProduct && changes.currentProduct.newValue) {
        chrome.storage.local.get(['isLoggedIn', 'pendingCoupons'], (data) => {
          displayProduct(changes.currentProduct.newValue, data.isLoggedIn, data.pendingCoupons);
        });
      }
    }
  } catch (error) {
    console.error('🦉 Error handling storage change:', error);
  }
});

// Handle errors gracefully
window.addEventListener('error', function(event) {
  try {
    console.error('🦉 Popup error:', event.error);
    if (analytics) {
      analytics.track('Popup JavaScript Error', {
        message: event.error ? event.error.message : 'Unknown error',
        filename: event.filename || 'unknown',
        line: event.lineno || 0,
        column: event.colno || 0
      });
    }
  } catch (error) {
    console.error('🦉 Error in error handler:', error);
  }
});