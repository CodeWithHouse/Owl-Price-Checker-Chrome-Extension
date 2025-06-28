// analytics.js - Segment Analytics Integration for Owl Price Checker

class SegmentAnalytics {
  constructor() {
    // Replace with your actual Segment Write Key
    this.writeKey = "REPLACE_WITH_YOUR_WRITE_KEY";
    this.apiUrl = 'https://api.segment.io/v1';
    this.userId = null;
    this.anonymousId = null;
    this.sessionId = null;
    this.debug = false; // Set to true for debugging
    
    // Initialize
    this.init();
  }

  async init() {
    await this.initializeUser();
    this.startSession();
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

      // Auto-identify with stored traits
      if (stored.userTraits) {
        await this.identify(this.userId, stored.userTraits);
      }
    } catch (error) {
      console.error('Error initializing user:', error);
    }
  }

  // Start a new session
  startSession() {
    this.sessionId = this.generateUUID();
    if (this.debug) {
      console.log('New session started:', this.sessionId);
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
    return btoa(str);
  }

  // Get device and browser context
  getContext() {
    try {
      const manifest = chrome.runtime.getManifest();
      
      return {
        active: true,
        app: {
          name: manifest.name,
          version: manifest.version,
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
        locale: navigator.language || 'en-US',
        page: {
          referrer: typeof document !== 'undefined' ? document.referrer : '',
          url: typeof window !== 'undefined' && window.location ? window.location.href : '',
          title: typeof document !== 'undefined' ? document.title : ''
        },
        screen: {
          width: typeof screen !== 'undefined' ? screen.width : 0,
          height: typeof screen !== 'undefined' ? screen.height : 0
        },
        session: {
          id: this.sessionId
        },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        userAgent: navigator.userAgent
      };
    } catch (error) {
      console.error('Error getting context:', error);
      return {
        app: {
          name: 'Owl Price Checker',
          version: '1.0.0'
        },
        library: {
          name: 'owl-price-checker',
          version: '1.0.0'
        }
      };
    }
  }

  // Send to Segment API
  async sendToSegment(endpoint, payload) {
    try {
      // Check if analytics is enabled
      const settings = await chrome.storage.local.get(['analyticsEnabled']);
      if (settings.analyticsEnabled === false) {
        if (this.debug) {
          console.log('Analytics disabled, not sending:', endpoint, payload);
        }
        return false;
      }

      if (this.debug) {
        console.log(`Sending to Segment ${endpoint}:`, payload);
      }

      const response = await fetch(`${this.apiUrl}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${this.encodeBase64(this.writeKey + ':')}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Segment API error:', response.status, errorText);
        return false;
      }

      if (this.debug) {
        console.log('Successfully sent to Segment');
      }

      return true;
    } catch (error) {
      console.error('Error sending to Segment:', error);
      return false;
    }
  }

  // Track event (following Segment Track spec)
  async track(event, properties = {}) {
    try {
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
      this.logEvent('track', event, enhancedProperties);

      return await this.sendToSegment('track', payload);
    } catch (error) {
      console.error('Error tracking event:', error);
      return false;
    }
  }

  // Identify user (following Segment Identify spec)
  async identify(userId, traits = {}) {
    try {
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
          extension_version: chrome.runtime.getManifest().version,
          last_seen: new Date().toISOString()
        },
        context: this.getContext(),
        timestamp: new Date().toISOString(),
        type: 'identify'
      };

      // Store event locally for debugging
      this.logEvent('identify', userId, traits);

      return await this.sendToSegment('identify', payload);
    } catch (error) {
      console.error('Error identifying user:', error);
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
      this.logEvent('page', name, properties);

      return await this.sendToSegment('page', payload);
    } catch (error) {
      console.error('Error tracking page:', error);
      return false;
    }
  }

  // Screen view (for extension popup)
  async screen(name, properties = {}) {
    try {
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
      console.error('Error tracking screen:', error);
      return false;
    }
  }

  // Enhance properties based on event type
  enhanceProperties(event, properties) {
    // Add revenue for transaction events
    if (properties.price && !properties.revenue) {
      properties.revenue = properties.price;
    }

    // Add currency if price is present and not already set
    if (properties.price && !properties.currency) {
      properties.currency = 'USD'; // Default currency
    }

    // Add timestamp if not present
    if (!properties.timestamp) {
      properties.timestamp = new Date().toISOString();
    }

    // Add extension context
    properties.extension_id = chrome.runtime.id;
    properties.extension_name = 'Owl Price Checker';

    return properties;
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
        browser_version: navigator.userAgent.match(/Chrome\/([0-9.]+)/)?.[1] || 'unknown'
      };
    } catch (error) {
      console.error('Error computing user traits:', error);
      return {};
    }
  }

  // Log events locally for debugging
  async logEvent(type, name, data) {
    try {
      if (chrome.runtime.lastError) return;
      
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
        console.log('Event logged:', type, name, data);
      }
    } catch (error) {
      console.error('Error logging event:', error);
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
      console.error('Error batching events:', error);
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
      console.error('Error aliasing user:', error);
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
      console.error('Error grouping user:', error);
      return false;
    }
  }

  // Helper method to get debug information
  async getDebugInfo() {
    const storage = await chrome.storage.local.get([
      'userId',
      'anonymousId',
      'analyticsEnabled',
      'eventLog'
    ]);

    return {
      userId: this.userId,
      anonymousId: this.anonymousId,
      sessionId: this.sessionId,
      analyticsEnabled: storage.analyticsEnabled !== false,
      eventCount: storage.eventLog?.length || 0,
      lastEvents: storage.eventLog?.slice(-5) || []
    };
  }

  // Enable/disable debug mode
  setDebugMode(enabled) {
    this.debug = enabled;
    console.log(`Analytics debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }
}

// Create global instance
const analytics = new SegmentAnalytics();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = analytics;
}