// user-manager.js - User and Coupon Management for Owl Price Checker

class UserManager {
  constructor() {
    this.init();
  }

  async init() {
    // Set up periodic coupon checks
    this.setupCouponChecker();
    
    // Clean up expired coupons
    this.cleanupExpiredCoupons();
  }

  // Get current user data
  async getCurrentUser() {
    const data = await chrome.storage.local.get(['isLoggedIn', 'user']);
    return data.isLoggedIn ? data.user : null;
  }

  // Update user savings
  async updateUserSavings(amount) {
    const user = await this.getCurrentUser();
    if (!user) return;

    user.totalSavings = (user.totalSavings || 0) + amount;
    await chrome.storage.local.set({ user });

    // Track savings update
    if (typeof analytics !== 'undefined') {
      analytics.track('User Savings Updated', {
        user_id: user.id,
        savings_amount: amount,
        total_savings: user.totalSavings
      });

      // Update user traits
      analytics.identify(user.id, {
        total_savings: user.totalSavings
      });
    }
  }

  // Generate site-specific coupons based on browsing history
  async generateSiteCoupons(site, productCategory) {
    const coupons = [];
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 14); // 14 days from now

    // Site-specific coupon generation
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
      id: this.generateCouponId(),
      code: selectedTemplate.code,
      discount: selectedTemplate.discount,
      site: site,
      category: productCategory,
      minPurchase: selectedTemplate.minPurchase,
      expiresAt: expirationDate.toISOString(),
      createdAt: new Date().toISOString(),
      used: false,
      userId: (await this.getCurrentUser())?.id
    });

    return coupons;
  }

  // Add coupons to user account
  async addCouponsToUser(coupons) {
    const user = await this.getCurrentUser();
    if (!user) return;

    // Get existing coupons
    const data = await chrome.storage.local.get(['userCoupons']);
    const existingCoupons = data.userCoupons || [];

    // Add new coupons
    const allCoupons = [...existingCoupons, ...coupons];

    // Update user coupon count
    user.couponsEarned = (user.couponsEarned || 0) + coupons.length;

    // Save updated data
    await chrome.storage.local.set({
      user,
      userCoupons: allCoupons,
      pendingCoupons: coupons // For immediate display
    });

    // Track coupon generation
    if (typeof analytics !== 'undefined') {
      analytics.track('Coupons Generated', {
        user_id: user.id,
        coupon_count: coupons.length,
        sites: [...new Set(coupons.map(c => c.site))],
        total_coupons: user.couponsEarned
      });
    }

    return coupons;
  }

  // Get active coupons for a specific site
  async getActiveCouponsForSite(site) {
    const data = await chrome.storage.local.get(['userCoupons']);
    const coupons = data.userCoupons || [];
    
    const now = new Date();
    return coupons.filter(coupon => 
      coupon.site.toLowerCase() === site.toLowerCase() &&
      !coupon.used &&
      new Date(coupon.expiresAt) > now
    );
  }

  // Mark coupon as used
  async useCoupon(couponId) {
    const data = await chrome.storage.local.get(['userCoupons']);
    const coupons = data.userCoupons || [];
    
    const couponIndex = coupons.findIndex(c => c.id === couponId);
    if (couponIndex !== -1) {
      coupons[couponIndex].used = true;
      coupons[couponIndex].usedAt = new Date().toISOString();
      
      await chrome.storage.local.set({ userCoupons: coupons });

      // Track coupon usage
      if (typeof analytics !== 'undefined') {
        analytics.track('Coupon Used', {
          coupon_id: couponId,
          coupon_code: coupons[couponIndex].code,
          site: coupons[couponIndex].site,
          discount: coupons[couponIndex].discount
        });
      }
    }
  }

  // Clean up expired coupons
  async cleanupExpiredCoupons() {
    const data = await chrome.storage.local.get(['userCoupons']);
    const coupons = data.userCoupons || [];
    
    const now = new Date();
    const activeCoupons = coupons.filter(coupon => 
      new Date(coupon.expiresAt) > now
    );

    if (activeCoupons.length !== coupons.length) {
      await chrome.storage.local.set({ userCoupons: activeCoupons });
      console.log(`Cleaned up ${coupons.length - activeCoupons.length} expired coupons`);
    }
  }

  // Set up periodic coupon checker
  setupCouponChecker() {
    // Check for new coupons every hour
    setInterval(async () => {
      await this.checkForNewCoupons();
      await this.cleanupExpiredCoupons();
    }, 60 * 60 * 1000); // 1 hour
  }

  // Check for new coupons based on user activity
  async checkForNewCoupons() {
    const user = await this.getCurrentUser();
    if (!user) return;

    // Get user's recent browsing activity
    const data = await chrome.storage.local.get(['userActivity']);
    const activity = data.userActivity || [];

    // Find sites user has visited recently
    const recentSites = activity
      .filter(a => Date.now() - new Date(a.timestamp).getTime() < 7 * 24 * 60 * 60 * 1000) // Last 7 days
      .map(a => a.site);

    const uniqueSites = [...new Set(recentSites)];

    // Generate coupons for frequently visited sites
    for (const site of uniqueSites.slice(0, 3)) { // Limit to top 3 sites
      const existingCoupons = await this.getActiveCouponsForSite(site);
      
      // Only generate new coupons if user has less than 2 active coupons for this site
      if (existingCoupons.length < 2) {
        const newCoupons = await this.generateSiteCoupons(site, 'General');
        if (newCoupons.length > 0) {
          await this.addCouponsToUser(newCoupons);
          
          // Notify user about new coupons
          this.notifyNewCoupons(newCoupons);
        }
      }
    }
  }

  // Notify user about new coupons
  async notifyNewCoupons(coupons) {
    const user = await this.getCurrentUser();
    if (!user) return;

    // Check if notifications are enabled
    const settings = await chrome.storage.local.get(['notifications']);
    if (settings.notifications === false) return;

    // Create notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'New Coupons Available! 🎟️',
      message: `You've earned ${coupons.length} new coupon${coupons.length > 1 ? 's' : ''} for ${coupons[0].site}!`,
      buttons: [
        { title: 'View Coupons' },
        { title: 'Dismiss' }
      ]
    });

    // Track notification
    if (typeof analytics !== 'undefined') {
      analytics.track('Coupon Notification Sent', {
        user_id: user.id,
        coupon_count: coupons.length,
        site: coupons[0].site
      });
    }
  }

  // Track user activity for coupon personalization
  async trackUserActivity(site, category, productName) {
    const data = await chrome.storage.local.get(['userActivity']);
    const activity = data.userActivity || [];
    
    activity.push({
      site,
      category,
      productName,
      timestamp: new Date().toISOString()
    });

    // Keep only last 100 activities
    if (activity.length > 100) {
      activity.splice(0, activity.length - 100);
    }

    await chrome.storage.local.set({ userActivity: activity });
  }

  // Get user statistics
  async getUserStats() {
    const user = await this.getCurrentUser();
    if (!user) return null;

    const data = await chrome.storage.local.get(['userCoupons', 'userActivity']);
    const coupons = data.userCoupons || [];
    const activity = data.userActivity || [];

    const activeCoupons = coupons.filter(c => !c.used && new Date(c.expiresAt) > new Date());
    const usedCoupons = coupons.filter(c => c.used);
    const recentActivity = activity.filter(a => 
      Date.now() - new Date(a.timestamp).getTime() < 30 * 24 * 60 * 60 * 1000 // Last 30 days
    );

    return {
      totalSavings: user.totalSavings || 0,
      activeCoupons: activeCoupons.length,
      usedCoupons: usedCoupons.length,
      totalCoupons: coupons.length,
      recentSites: [...new Set(recentActivity.map(a => a.site))],
      memberSince: user.createdAt
    };
  }

  // Utility functions
  generateCouponId() {
    return 'coupon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Export user data (for privacy compliance)
  async exportUserData() {
    const user = await this.getCurrentUser();
    if (!user) return null;

    const data = await chrome.storage.local.get([
      'userCoupons',
      'userActivity',
      'emailHistory'
    ]);

    return {
      user: user,
      coupons: data.userCoupons || [],
      activity: data.userActivity || [],
      emails: data.emailHistory || [],
      exportedAt: new Date().toISOString()
    };
  }

  // Delete user data (for privacy compliance)
  async deleteUserData() {
    await chrome.storage.local.remove([
      'user',
      'isLoggedIn',
      'userCoupons',
      'userActivity',
      'emailHistory',
      'pendingCoupons',
      'registeredUsers'
    ]);

    console.log('User data deleted successfully');
  }
}

// Create global instance
const userManager = new UserManager();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = userManager;
}