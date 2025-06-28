# Owl-Price-Checker-Chrome-Extension

# 🦉 Owl Price Checker - Smart Shopping Chrome Extension

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://chrome.google.com/webstore)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/yourusername/owl-price-checker)
[![License](https://img.shields.io/badge/license-MIT-orange.svg)](LICENSE)
[![JavaScript](https://img.shields.io/badge/javascript-ES6+-yellow.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

> **Smart price comparison extension that helps users save money while shopping online. Features user authentication, exclusive coupons, and real-time price comparisons across major e-commerce sites.**

![Owl Price Checker Demo](https://via.placeholder.com/800x400/D61E37/FFFFFF?text=Owl+Price+Checker+Demo)

## ✨ Features

### 🛒 **Universal E-commerce Support**
- Works on **any e-commerce website** (Amazon, Nike, Target, Walmart, eBay, etc.)
- **Real-time price detection** with smart product recognition
- **Automatic price comparisons** across 10+ major retailers
- **Currency detection** and localization support

### 🎟️ **User Authentication & Coupons**
- **Beautiful signup/login interface** with real-time validation
- **Exclusive coupon generation** based on browsing history
- **Site-specific discount codes** (Nike, Amazon, Target, Walmart)
- **Automated coupon expiration** and cleanup
- **Email marketing integration** with opt-in preferences

### 📊 **Advanced Analytics**
- **Segment Analytics integration** for user behavior tracking (** Remember to change and replace with your Write Key!)
- **E-commerce event tracking** (product views, savings, coupon usage)
- **Privacy-compliant analytics** with user consent management
- **Custom user traits** and behavioral insights

### 🎨 **Modern UI/UX**
- **Nike-inspired design** with premium aesthetics
- **Responsive popup interface** with smooth animations
- **Dark/light theme support** with CSS variables
- **Accessibility features** and keyboard navigation

### 🔒 **Privacy & Security**
- **Local data storage** - no external servers required
- **GDPR compliance** with data export/deletion features
- **Transparent privacy controls** with granular settings
- **No tracking without consent**

## 🚀 Quick Start

### Prerequisites
- Google Chrome browser (version 88+)
- Basic knowledge of Chrome extension development
- Node.js (optional, for development tools)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/owl-price-checker.git
   cd owl-price-checker
   ```

2. **Set up your analytics** (optional)
   ```javascript
   // In analytics.js, replace with your Segment Write Key
   this.writeKey = 'YOUR_SEGMENT_WRITE_KEY_HERE';
   ```

3. **Load the extension in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked" and select the project folder
   - The Owl Price Checker icon should appear in your toolbar

4. **Test the extension**
   - Visit any product page (e.g., Nike.com, Amazon.com)
   - Click the Owl Price Checker extension icon
   - Sign up to unlock exclusive coupons and price alerts

## 📁 Project Structure

```
owl-price-checker/
├── 📁 icons/                 # Extension icons (16px, 48px, 128px)
├── 📄 manifest.json          # Extension configuration
├── 📄 background.js          # Service worker (main logic)
├── 📄 content.js             # Content script (page analysis)
├── 📄 popup.html             # Main popup interface
├── 📄 popup.css              # Popup styling
├── 📄 popup.js               # Popup functionality
├── 📄 auth.html              # Authentication page
├── 📄 auth.css               # Authentication styling  
├── 📄 auth.js                # Authentication logic
├── 📄 privacy.html           # Privacy settings page
├── 📄 privacy.js             # Privacy settings logic
├── 📄 analytics.js           # Segment analytics integration
├── 📄 user-manager.js        # User and coupon management
└── 📄 README.md              # This file
```

## 🛠️ Development

### Core Components

#### **Content Script (`content.js`)**
Analyzes product pages and extracts:
- Product titles, prices, and images
- Currency detection and normalization
- Site-specific selectors for major retailers
- Real-time navigation detection

#### **Background Service Worker (`background.js`)**
Handles:
- Price comparison logic and API calls
- User authentication and session management
- Coupon generation and expiration
- Analytics event tracking

#### **Popup Interface (`popup.html/js/css`)**
Features:
- Product information display
- Price comparison results
- User authentication prompts
- Account management and logout

#### **Authentication System (`auth.html/js/css`)**
Provides:
- User registration and login forms
- Real-time form validation
- Welcome email simulation
- Privacy policy integration

### Key Technologies

- **Manifest V3** - Latest Chrome extension format
- **Vanilla JavaScript** - No external dependencies
- **CSS Grid/Flexbox** - Modern responsive layouts
- **Chrome Storage API** - Local data persistence
- **Chrome Notifications API** - User engagement alerts
- **Segment Analytics** - User behavior tracking

### Adding New Retailers

To add support for a new e-commerce site:

1. **Update product detection patterns** in `content.js`:
   ```javascript
   const UNIVERSAL_PATTERNS = {
     price: [
       // Add new site-specific selectors
       '.your-site-price-selector',
     ],
     title: [
       '.your-site-title-selector',
     ]
   };
   ```

2. **Add site-specific extraction logic**:
   ```javascript
   function extractPriceFromYourSite() {
     const selectors = ['.price-class-1', '.price-class-2'];
     // Implementation here
   }
   ```

3. **Update comparison sites** in `background.js`:
   ```javascript
   const comparisonSites = [
     {
       name: 'Your Site',
       searchUrl: (query) => `https://yoursite.com/search?q=${encodeURIComponent(query)}`,
       enabled: true
     }
   ];
   ```

### Customizing Coupons

Add new coupon templates in `background.js`:

```javascript
const couponTemplates = {
  'YourSite': [
    { code: 'WELCOME10', discount: '10% off', minPurchase: 50 },
    { code: 'FREESHIP', discount: 'Free shipping', minPurchase: 25 }
  ]
};
```

## 📊 Analytics Setup

### Segment Integration

1. **Create a Segment account** at [segment.com](https://segment.com)
2. **Get your Write Key** from the Segment dashboard
3. **Update analytics.js**:
   ```javascript
   this.writeKey = 'YOUR_SEGMENT_WRITE_KEY_HERE';
   ```

### Tracked Events

The extension automatically tracks:

- **User Events**: Sign up, login, logout
- **Shopping Events**: Product views, price comparisons
- **Engagement Events**: Popup opens, coupon clicks
- **Conversion Events**: Coupon usage, savings achieved

### Custom Properties

All events include rich context:
```javascript
analytics.track('Product Viewed', {
  product_id: 'ABC123',
  product_name: 'Nike Air Force 1',
  price: 90,
  currency: 'USD',
  category: 'Sports',
  brand: 'Nike',
  site: 'Nike'
});
```

## 🎨 Customization

### Theming

The extension uses CSS custom properties for easy theming:

```css
:root {
  --primary: #D61E37;        /* Nike red */
  --secondary: #000a1e;      /* Dark blue */
  --text-primary: #FFFFFF;   /* White text */
  --hover-primary: #B01830;  /* Darker red */
  --light-bg: #f5f5f5;      /* Light background */
  --success: #0F9D58;       /* Success green */
  --error: #DC3545;         /* Error red */
}
```

### Popup Dimensions

Adjust popup size in `popup.css`:
```css
body {
  width: 420px;
  min-height: 500px;
}
```

### Authentication Window

Customize auth window size in `background.js`:
```javascript
chrome.windows.create({
  width: 500,
  height: 650,
  type: 'popup'
});
```

## 🔧 Configuration

### Extension Permissions

Required permissions in `manifest.json`:
```json
{
  "permissions": [
    "activeTab",        // Access current tab
    "storage",          // Local data storage
    "notifications",    // User notifications
    "scripting"         // Dynamic script injection
  ],
  "host_permissions": [
    "https://*/*",      // All HTTPS sites
    "http://*/*"        // All HTTP sites
  ]
}
```

### Privacy Settings

Users can control:
- Analytics data collection
- Price history tracking
- Email notifications
- Marketing communications

Access via the privacy settings page or popup footer.

## 🧪 Testing

### Manual Testing Checklist

- [ ] **Product Detection**: Visit various e-commerce sites
- [ ] **Price Comparison**: Verify accurate price extraction
- [ ] **User Authentication**: Test signup/login/logout flows
- [ ] **Coupon Generation**: Check coupon creation and expiration
- [ ] **Navigation Handling**: Test SPA and traditional navigation
- [ ] **Analytics Tracking**: Verify events in Segment dashboard

### Supported Sites

Tested and optimized for:
- ✅ **Nike.com** - Full product detection and coupon integration
- ✅ **Amazon.com** - ASIN detection and price monitoring
- ✅ **Target.com** - Product pages and search results
- ✅ **Walmart.com** - Item pages and price comparison
- ✅ **eBay.com** - Auction and Buy It Now listings
- ✅ **Best Buy** - Electronics and tech products
- ✅ **Etsy.com** - Handmade and vintage items
- ✅ **AliExpress** - International marketplace items

### Browser Compatibility

- ✅ **Chrome 88+** (Primary target)
- ✅ **Edge 88+** (Chromium-based)
- ⚠️ **Firefox** (Requires Manifest V2 conversion)
- ❌ **Safari** (Different extension format)

## 🚀 Deployment

### Chrome Web Store

1. **Prepare for submission**:
   - Update version in `manifest.json`
   - Create promotional images (1280x800, 440x280, 220x140)
   - Write store description and feature list
   - Test thoroughly across different sites

2. **Create developer account**:
   - Visit [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard)
   - Pay one-time $5 registration fee
   - Complete publisher verification

3. **Upload extension**:
   - Zip all files (excluding `.git`, `node_modules`, etc.)
   - Upload to developer dashboard
   - Fill out store listing details
   - Submit for review (typically 1-3 days)




