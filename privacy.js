// privacy.js - Handle privacy settings for Owl Price Checker

document.addEventListener('DOMContentLoaded', async function() {
  // Load current settings
  const settings = await chrome.storage.local.get([
    'analyticsEnabled',
    'trackPrices',
    'notifications',
    'totalComparisons',
    'totalSavings',
    'installDate'
  ]);
  
  // Set checkbox states
  document.getElementById('analyticsEnabled').checked = 
    settings.analyticsEnabled !== false;
  document.getElementById('trackPrices').checked = 
    settings.trackPrices !== false;
  document.getElementById('notifications').checked = 
    settings.notifications !== false;
    
  // Display stats
  displayStats(settings);
  
  // Handle save button click
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
  
  // Track page view
  if (typeof analytics !== 'undefined') {
    analytics.screen('Privacy Settings', {
      timestamp: new Date().toISOString()
    });
  }
});

async function saveSettings() {
  const analyticsEnabled = document.getElementById('analyticsEnabled').checked;
  const trackPrices = document.getElementById('trackPrices').checked;
  const notifications = document.getElementById('notifications').checked;
  
  // Save settings
  await chrome.storage.local.set({
    analyticsEnabled: analyticsEnabled,
    trackPrices: trackPrices,
    notifications: notifications
  });
  
  // Show success message
  const successMessage = document.getElementById('successMessage');
  successMessage.style.display = 'block';
  setTimeout(() => {
    successMessage.style.display = 'none';
  }, 3000);
  
  // Track settings change
  if (typeof analytics !== 'undefined' && analyticsEnabled) {
    analytics.track('Privacy Settings Updated', {
      analytics_enabled: analyticsEnabled,
      track_prices: trackPrices,
      notifications: notifications,
      timestamp: new Date().toISOString()
    });
  }
  
  // Update notification permissions if needed
  if (notifications) {
    chrome.notifications.getPermissionLevel((level) => {
      if (level !== 'granted') {
        // Request notification permission
        Notification.requestPermission();
      }
    });
  }
}

function displayStats(settings) {
  // Calculate days since install
  let daysSinceInstall = 0;
  if (settings.installDate) {
    const installDate = new Date(settings.installDate);
    const now = new Date();
    daysSinceInstall = Math.floor((now - installDate) / (1000 * 60 * 60 * 24));
  }
  
  // Get currency symbol (default to $)
  // In a real implementation, you might want to detect or store the user's preferred currency
  const currencySymbol = '$';
  
  // Update stat displays
  document.getElementById('totalComparisons').textContent = 
    settings.totalComparisons || 0;
  document.getElementById('totalSavings').textContent = 
    `${currencySymbol}${(settings.totalSavings || 0).toLocaleString()}`;
  document.getElementById('daysSinceInstall').textContent = daysSinceInstall;
}

// Load analytics script
const script = document.createElement('script');
script.src = 'analytics.js';
document.head.appendChild(script);

// Add checkbox change tracking
document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
  checkbox.addEventListener('change', function() {
    if (typeof analytics !== 'undefined') {
      analytics.track('Privacy Setting Toggled', {
        setting: this.id,
        enabled: this.checked,
        timestamp: new Date().toISOString()
      });
    }
  });
});