// analytics.js - Fixed Segment Analytics Integration for Owl Price Checker

class SegmentAnalytics {
  constructor() {
    // Replace with your actual Segment Write Key
    this.writeKey = '77QBsvffW2u7PC23bxMa84IwLKnHdAAT'; // Your key from the original file
    this.apiUrl = 'https://api.segment.io/v1';
    this.userId = null;
    this.anonymousId = null;
    this.sessionId = null;
    this.debug = true; // Enable debug for troubleshooting
    
    // Prevent duplicate calls
    this.lastIdentifyHash = null;
    this.identifyQueue = new Set();
    this.trackQueue = new Set();
    
    // Initialize
    this.init();
  }

  async init() {
    try {
      await this.initializeUser();
      this.startSession();
      
      if (this.debug) {
        console.log('🦉 Owl Analytics initialized:', {
          writeKey: this.writeKey ? '✅ Set' : '❌ Missing',
          anonymousId: this.anonymousId,
          sessionId: this.sessionId
        });
      }
    } catch (error) {
      console.error('🦉 Analytics init error:', error);
    }
  }

  // Initialize or retrieve user identifiers
  async initializeUser() {
    try {
      const stored = await chrome.storage.local.get(['userId', 'anonymousId', 'userTraits']);
      
      if (stored.userId) {
        this.userId = stored.userId;
      }
      
      if (stored.anonymousId) {
        this.anonymousId = stored.anonymousId;
      } else {
        // Generate anonymous ID if not exists
        this.anonymousId = this.generateUUID();
        await chrome.storage.local.set({ anonymousId: this.anonymousId });
      }

      // Don't auto-identify on init to prevent duplicate calls
      // The auth system will handle identification
    } catch (error) {
      console.error('🦉 Error initializing user:', error);
    }
  }

  // Start a new session
  startSession() {
    this.sessionId = this.generateUUID();
    if (this.debug) {
      console.log('🦉 New session started:', this.sessionId);
    }
  }

  // Generate UUID v4
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Base64 encode for Basic Auth
  encodeBase64(str) {
    try {
      return btoa(str);
    } catch (error) {
      console.error('🦉 Base64 encoding error:', error);
      return '';
    }
  }

  // Get device and browser context
  getContext() {
    try {
      const manifest = chrome?.runtime?.getManifest() || {};
      
      return {
        active: true,
        app: {
          name: manifest.name || 'Owl Price Checker',
          version: manifest.version || '1.0.0',
          namespace: 'com.owlpricechecker.extension'
        },
        campaign: {},
        device: {
          type: 'desktop'
        },
        library: {
          name: 'owl-price-checker',
          version: '1.0.0'
        },
        locale: (typeof navigator !== 'undefined' ? navigator.language : null) || 'en-US',
        page: {
          referrer: typeof document !== 'undefined' ? document.referrer : '',
          url: typeof window !== 'undefined' && window.location ? window.location.href : '',
          title: typeof document !== 'undefined' ? document.title : ''
        },
        screen: {
          width: typeof screen !== 'undefined' ? screen.width : 1920,
          height: typeof screen !== 'undefined' ? screen.height : 1080
        },
        session: {
          id: this.sessionId
        },
        timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Chrome Extension'
      };
    } catch (error) {
      console.error('🦉 Error getting context:', error);
      return {
        app: {
          name: 'Owl Price Checker',
          version: '1.0.0'
        },
        library: {
          name: 'owl-price-checker',
          version: '1.0.0'
        },
        session: {
          id: this.sessionId
        }
      };
    }
  }

  // Send to Segment API with enhanced error handling
  async sendToSegment(endpoint, payload) {
    try {
      // Check if analytics is enabled
      const settings = await chrome.storage.local.get(['analyticsEnabled']);
      if (settings.analyticsEnabled === false) {
        if (this.debug) {
          console.log('🦉 Analytics disabled, not sending:', endpoint, payload);
        }
        return false;
      }

      // Validate write key
      if (!this.writeKey || this.writeKey === 'REPLACE_WITH_YOUR_WRITE_KEY') {
        console.error('🦉 Segment Write Key not configured!');
        return false;
      }

      if (this.debug) {
        console.log(`🦉 Sending to Segment ${endpoint}:`, {
          event: payload.event || payload.name || 'identify',
          userId: payload.userId,
          anonymousId: payload.anonymousId,
          properties: payload.properties || payload.traits,
          writeKey: this.writeKey.substring(0, 8) + '...' // Hide full key
        });
      }

      const authHeader = `Basic ${this.encodeBase64(this.writeKey + ':')}`;
      
      const response = await fetch(`${this.apiUrl}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify(payload)
      });

      if (this.debug) {
        console.log(`🦉 Segment API response status:`, response.status);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`🦉 Segment API error (${response.status}):`, errorText);
        
        // Log specific error details
        if (response.status === 401) {
          console.error('🦉 Authentication failed - check your Segment Write Key');
        } else if (response.status === 400) {
          console.error('🦉 Bad request - check payload format:', payload);
        }
        
        return false;
      }

      if (this.debug) {
        console.log('🦉 ✅ Successfully sent to Segment');
      }

      return true;
    } catch (error) {
      console.error('🦉 Error sending to Segment:', error);
      
      // Log more details about the error
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.error('🦉 Network error - check internet connection and CORS');
      }
      
      return false;
    }
  }

  // Create hash for deduplication
  createCallHash(type, userId, data) {
    const hashData = {
      type,
      userId: userId || this.anonymousId,
      data: typeof data === 'object' ? JSON.stringify(data) : data,
      timestamp: Math.floor(Date.now() / 10000) // 10 second window
    };
    return btoa(JSON.stringify(hashData)).substring(0, 16);
  }

  // Track event (following Segment Track spec) with deduplication
  async track(event, properties = {}) {
    try {
      if (!event) {
        console.error('🦉 Track event name is required');
        return false;
      }

      // Create hash for deduplication
      const callHash = this.createCallHash('track', this.userId, { event, properties });
      
      if (this.trackQueue.has(callHash)) {
        if (this.debug) {
          console.log('🦉 Duplicate track call prevented:', event);
        }
        return false;
      }
      
      this.trackQueue.add(callHash);
      
      // Clean up old hashes after 30 seconds
      setTimeout(() => {
        this.trackQueue.delete(callHash);
      }, 30000);

      // Add common e-commerce properties if applicable
      const enhancedProperties = this.enhanceProperties(event, properties);
      
      const payload = {
        anonymousId: this.anonymousId,
        event: event,
        properties: {
          ...enhancedProperties,
          session_id: this.sessionId
        },
        context: this.getContext(),
        timestamp: new Date().toISOString(),
        type: 'track'
      };

      if (this.userId) {
        payload.userId = this.userId;
      }

      // Store event locally for debugging
      await this.logEvent('track', event, enhancedProperties);

      return await this.sendToSegment('track', payload);
    } catch (error) {
      console.error('🦉 Error tracking event:', error);
      return false;
    }
  }

  // Identify user (following Segment Identify spec) with strict deduplication
  async identify(userId, traits = {}) {
    try {
      // Create hash for deduplication - more strict for identify calls
      const identifyData = {
        userId: userId || this.userId,
        traits: JSON.stringify(traits),
        timestamp: Math.floor(Date.now() / 5000) // 5 second window for identify
      };
      const identifyHash = btoa(JSON.stringify(identifyData)).substring(0, 20);
      
      if (this.lastIdentifyHash === identifyHash) {
        if (this.debug) {
          console.log('🦉 Duplicate identify call prevented for user:', userId);
        }
        return false;
      }
      
      if (this.identifyQueue.has(identifyHash)) {
        if (this.debug) {
          console.log('🦉 Identify call already in queue:', userId);
        }
        return false;
      }
      
      this.identifyQueue.add(identifyHash);
      this.lastIdentifyHash = identifyHash;
      
      // Clean up after 60 seconds
      setTimeout(() => {
        this.identifyQueue.delete(identifyHash);
        if (this.lastIdentifyHash === identifyHash) {
          this.lastIdentifyHash = null;
        }
      }, 60000);

      if (userId) {
        this.userId = userId;
        await chrome.storage.local.set({ userId: userId, userTraits: traits });
      }

      // Calculate computed traits
      const computedTraits = await this.computeUserTraits();
      
      const payload = {
        userId: userId || this.userId,
        anonymousId: this.anonymousId,
        traits: {
          ...computedTraits,
          ...traits,
          extension_version: chrome?.runtime?.getManifest()?.version || '1.0.0',
          last_seen: new Date().toISOString()
        },
        context: this.getContext(),
        timestamp: new Date().toISOString(),
        type: 'identify'
      };

      // Store event locally for debugging
      await this.logEvent('identify', userId, traits);

      return await this.sendToSegment('identify', payload);
    } catch (error) {
      console.error('🦉 Error identifying user:', error);
      return false;
    }
  }

  // Page view (following Segment Page spec)
  async page(category, name, properties = {}) {
    try {
      const payload = {
        anonymousId: this.anonymousId,
        name: name,
        category: category,
        properties: {
          ...properties,
          session_id: this.sessionId
        },
        context: this.getContext(),
        timestamp: new Date().toISOString(),
        type: 'page'
      };

      if (this.userId) {
        payload.userId = this.userId;
      }

      // Store event locally for debugging
      await this.logEvent('page', name, properties);

      return await this.sendToSegment('page', payload);
    } catch (error) {
      console.error('🦉 Error tracking page:', error);
      return false;
    }
  }

  // Screen view (for extension popup) with deduplication
  async screen(name, properties = {}) {
    try {
      // Create hash for deduplication
      const callHash = this.createCallHash('screen', this.userId, { name, properties });
      
      if (this.trackQueue.has(callHash)) {
        if (this.debug) {
          console.log('🦉 Duplicate screen call prevented:', name);
        }
        return false;
      }
      
      this.trackQueue.add(callHash);
      
      // Clean up old hashes after 30 seconds
      setTimeout(() => {
        this.trackQueue.delete(callHash);
      }, 30000);

      const payload = {
        anonymousId: this.anonymousId,
        name: name,
        properties: {
          ...properties,
          session_id: this.sessionId
        },
        context: this.getContext(),
        timestamp: new Date().toISOString(),
        type: 'screen'
      };

      if (this.userId) {
        payload.userId = this.userId;
      }

      return await this.sendToSegment('screen', payload);
    } catch (error) {
      console.error('🦉 Error tracking screen:', error);
      return false;
    }
  }

  // Enhance properties based on event type
  enhanceProperties(event, properties) {
    try {
      const enhanced = { ...properties };

      // Add revenue for transaction events
      if (enhanced.price && !enhanced.revenue) {
        enhanced.revenue = enhanced.price;
      }

      // Add currency if price is present and not already set
      if (enhanced.price && !enhanced.currency) {
        enhanced.currency = 'USD'; // Default currency
      }

      // Add timestamp if not present
      if (!enhanced.timestamp) {
        enhanced.timestamp = new Date().toISOString();
      }

      // Add extension context
      enhanced.extension_id = chrome?.runtime?.id || 'unknown';
      enhanced.extension_name = 'Owl Price Checker';

      return enhanced;
    } catch (error) {
      console.error('🦉 Error enhancing properties:', error);
      return properties;
    }
  }

  // Compute user traits from stored data
  async computeUserTraits() {
    try {
      const data = await chrome.storage.local.get([
        'totalComparisons',
        'totalSavings',
        'preferredSites',
        'installDate'
      ]);

      return {
        total_comparisons: data.totalComparisons || 0,
        total_savings: data.totalSavings || 0,
        preferred_sites: data.preferredSites || [],
        days_since_install: data.installDate ? 
          Math.floor((Date.now() - new Date(data.installDate)) / (1000 * 60 * 60 * 24)) : 0,
        browser: 'Chrome',
        browser_version: (typeof navigator !== 'undefined' ? 
          navigator.userAgent.match(/Chrome\/([0-9.]+)/)?.[1] : null) || 'unknown'
      };
    } catch (error) {
      console.error('🦉 Error computing user traits:', error);
      return {};
    }
  }

  // Log events locally for debugging
  async logEvent(type, name, data) {
    try {
      if (chrome?.runtime?.lastError) return;
      
      const result = await chrome.storage.local.get(['eventLog']);
      const log = result.eventLog || [];
      
      log.push({
        type: type,
        name: name,
        data: data,
        timestamp: new Date().toISOString()
      });
      
      // Keep only last 100 events
      if (log.length > 100) {
        log.shift();
      }
      
      await chrome.storage.local.set({ eventLog: log });
      
      if (this.debug) {
        console.log('🦉 Event logged locally:', type, name);
      }
    } catch (error) {
      console.error('🦉 Error logging event locally:', error);
    }
  }

  // Test connection to Segment
  async testConnection() {
    console.log('🦉 Testing Segment connection...');
    
    const testResult = await this.track('Test Connection', {
      test: true,
      timestamp: new Date().toISOString()
    });
    
    if (testResult) {
      console.log('🦉 ✅ Segment connection successful!');
    } else {
      console.log('🦉 ❌ Segment connection failed!');
    }
    
    return testResult;
  }

  // Get debug information
  async getDebugInfo() {
    const storage = await chrome.storage.local.get([
      'userId',
      'anonymousId',
      'analyticsEnabled',
      'eventLog'
    ]);

    return {
      writeKeyConfigured: !!(this.writeKey && this.writeKey !== 'REPLACE_WITH_YOUR_WRITE_KEY'),
      userId: this.userId,
      anonymousId: this.anonymousId,
      sessionId: this.sessionId,
      analyticsEnabled: storage.analyticsEnabled !== false,
      eventCount: storage.eventLog?.length || 0,
      lastEvents: storage.eventLog?.slice(-5) || [],
      queueSizes: {
        identifyQueue: this.identifyQueue.size,
        trackQueue: this.trackQueue.size
      }
    };
  }

  // Enable/disable debug mode
  setDebugMode(enabled) {
    this.debug = enabled;
    console.log(`🦉 Analytics debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Clear all queues (for testing)
  clearQueues() {
    this.identifyQueue.clear();
    this.trackQueue.clear();
    this.lastIdentifyHash = null;
    if (this.debug) {
      console.log('🦉 Analytics queues cleared');
    }
  }

  // Batch events (for future implementation)
  async batch(events) {
    try {
      const payload = {
        batch: events.map(event => ({
          ...event,
          context: this.getContext(),
          timestamp: event.timestamp || new Date().toISOString()
        })),
        timestamp: new Date().toISOString()
      };

      return await this.sendToSegment('batch', payload);
    } catch (error) {
      console.error('🦉 Error batching events:', error);
      return false;
    }
  }

  // Alias user (for future implementation)
  async alias(userId, previousId) {
    try {
      const payload = {
        userId: userId,
        previousId: previousId || this.anonymousId,
        context: this.getContext(),
        timestamp: new Date().toISOString(),
        type: 'alias'
      };

      return await this.sendToSegment('alias', payload);
    } catch (error) {
      console.error('🦉 Error aliasing user:', error);
      return false;
    }
  }

  // Group user (for future implementation)
  async group(groupId, traits = {}) {
    try {
      const payload = {
        userId: this.userId,
        anonymousId: this.anonymousId,
        groupId: groupId,
        traits: traits,
        context: this.getContext(),
        timestamp: new Date().toISOString(),
        type: 'group'
      };

      return await this.sendToSegment('group', payload);
    } catch (error) {
      console.error('🦉 Error grouping user:', error);
      return false;
    }
  }
}

// Create global instance
const analytics = new SegmentAnalytics();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = analytics;
}

// Add test function to global scope for debugging
if (typeof window !== 'undefined') {
  window.owlAnalyticsTest = async () => {
    console.log('🦉 Testing analytics...');
    await analytics.testConnection();
    const debugInfo = await analytics.getDebugInfo();
    console.log('🦉 Debug info:', debugInfo);
  };
  
  window.owlAnalyticsClear = () => {
    analytics.clearQueues();
    console.log('🦉 Analytics queues cleared');
  };
}