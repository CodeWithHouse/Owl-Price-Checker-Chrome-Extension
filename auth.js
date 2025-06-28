// auth.js - Fixed Authentication logic for Owl Price Checker

class AuthManager {
  constructor() {
    this.isProcessing = false; // Prevent double submissions
    this.analyticsLoaded = false;
    this.init();
  }

  async init() {
    console.log('🦉 AuthManager initializing...');
    
    // Load analytics first
    await this.loadAnalytics();
    
    // Check if user is already logged in
    const userData = await chrome.storage.local.get(['user', 'isLoggedIn']);
    if (userData.isLoggedIn && userData.user) {
      console.log('🦉 User already logged in:', userData.user.firstName);
      this.showSuccessState(userData.user);
      return;
    }

    // Set up event listeners
    this.setupEventListeners();
    
    // Track page view (only once)
    if (this.analyticsLoaded && typeof analytics !== 'undefined') {
      setTimeout(() => {
        try {
          analytics.screen('Authentication Page', {
            timestamp: new Date().toISOString()
          });
          console.log('🦉 Analytics screen event tracked');
        } catch (screenError) {
          console.error('🦉 Error tracking screen event:', screenError);
        }
      }, 200);
    } else {
      console.log('🦉 Skipping screen tracking - analytics not ready');
    }
    
    // Test analytics after setup
    this.testAnalytics();
  }

  async loadAnalytics() {
    return new Promise((resolve) => {
      // Check if analytics is already loaded
      if (typeof analytics !== 'undefined') {
        this.analyticsLoaded = true;
        console.log('🦉 Analytics already available');
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'analytics.js';
      script.onload = () => {
        console.log('🦉 Analytics loaded successfully');
        this.analyticsLoaded = true;
        
        // Wait a bit for analytics to initialize properly
        setTimeout(() => {
          if (typeof analytics !== 'undefined') {
            console.log('🦉 Analytics confirmed available for tracking');
          } else {
            console.warn('🦉 Analytics script loaded but global object not found');
            this.analyticsLoaded = false;
          }
          resolve();
        }, 500);
      };
      script.onerror = (error) => {
        console.error('🦉 Failed to load analytics:', error);
        this.analyticsLoaded = false;
        resolve(); // Continue even if analytics fails
      };
      document.head.appendChild(script);
      
      // Timeout fallback
      setTimeout(() => {
        if (!this.analyticsLoaded) {
          console.warn('🦉 Analytics load timeout');
          this.analyticsLoaded = false;
        }
        resolve();
      }, 3000);
    });
  }

  testAnalytics() {
    setTimeout(() => {
      console.log('🦉 Testing analytics availability...');
      console.log('🦉 analyticsLoaded:', this.analyticsLoaded);
      console.log('🦉 typeof analytics:', typeof analytics);
      console.log('🦉 analytics object:', typeof analytics !== 'undefined' ? analytics : 'undefined');
      
      if (this.analyticsLoaded && typeof analytics !== 'undefined') {
        try {
          // Test analytics call
          analytics.track('Auth Page Test', {
            test: true,
            timestamp: new Date().toISOString()
          });
          console.log('🦉 ✅ Analytics test successful!');
        } catch (testError) {
          console.error('🦉 ❌ Analytics test failed:', testError);
        }
      } else {
        console.warn('🦉 ❌ Analytics not available for testing');
      }
    }, 1000);
  }

  setupEventListeners() {
    // Form switching
    const showLoginBtn = document.getElementById('showLoginForm');
    const showSignupBtn = document.getElementById('showSignupForm');
    
    if (showLoginBtn) {
      showLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.showLoginForm();
      });
    }

    if (showSignupBtn) {
      showSignupBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.showSignupForm();
      });
    }

    // Form submissions
    const signupForm = document.getElementById('signupFormElement');
    const loginForm = document.getElementById('loginFormElement');
    
    if (signupForm) {
      signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!this.isProcessing) {
          this.handleSignup();
        }
      });
    }

    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!this.isProcessing) {
          this.handleLogin();
        }
      });
    }

    // Continue button
    const continueBtn = document.getElementById('continueBtn');
    if (continueBtn) {
      continueBtn.addEventListener('click', () => {
        window.close(); // Close the auth window
      });
    }

    // Terms and privacy links
    const termsLink = document.getElementById('termsLink');
    const privacyLink = document.getElementById('privacyLink');
    
    if (termsLink) {
      termsLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.openTerms();
      });
    }

    if (privacyLink) {
      privacyLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.openPrivacy();
      });
    }

    // Real-time validation
    this.setupValidation();
  }

  setupValidation() {
    const emailInputs = document.querySelectorAll('input[type="email"]');
    const nameInput = document.getElementById('firstName');

    emailInputs.forEach(input => {
      input.addEventListener('blur', () => this.validateEmail(input));
      input.addEventListener('input', () => this.clearFieldError(input));
    });

    if (nameInput) {
      nameInput.addEventListener('blur', () => this.validateName(nameInput));
      nameInput.addEventListener('input', () => this.clearFieldError(nameInput));
    }
  }

  validateEmail(input) {
    const email = input.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (email && !emailRegex.test(email)) {
      this.showFieldError(input, 'Please enter a valid email address');
      return false;
    }
    
    this.clearFieldError(input);
    return true;
  }

  validateName(input) {
    const name = input.value.trim();
    
    if (name.length < 2) {
      this.showFieldError(input, 'Name must be at least 2 characters');
      return false;
    }
    
    if (!/^[a-zA-Z\s]+$/.test(name)) {
      this.showFieldError(input, 'Name can only contain letters and spaces');
      return false;
    }
    
    this.clearFieldError(input);
    return true;
  }

  showFieldError(input, message) {
    this.clearFieldError(input);
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.style.cssText = `
      color: var(--error);
      font-size: 12px;
      margin-top: 4px;
      display: flex;
      align-items: center;
      gap: 4px;
    `;
    errorDiv.innerHTML = `<span>⚠️</span> ${message}`;
    
    input.style.borderColor = 'var(--error)';
    input.parentNode.appendChild(errorDiv);
  }

  clearFieldError(input) {
    const existingError = input.parentNode.querySelector('.field-error');
    if (existingError) {
      existingError.remove();
    }
    input.style.borderColor = '';
  }

  showLoginForm() {
    document.getElementById('signupForm').classList.add('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('successState').classList.add('hidden');
    
    // Track form switch
    if (this.analyticsLoaded && typeof analytics !== 'undefined') {
      analytics.track('Auth Form Switched', {
        from: 'signup',
        to: 'login'
      });
    }
  }

  showSignupForm() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('signupForm').classList.remove('hidden');
    document.getElementById('successState').classList.add('hidden');
    
    // Track form switch
    if (this.analyticsLoaded && typeof analytics !== 'undefined') {
      analytics.track('Auth Form Switched', {
        from: 'login',
        to: 'signup'
      });
    }
  }

  async handleSignup() {
    if (this.isProcessing) {
      console.log('🦉 Signup already in progress, ignoring duplicate request');
      return;
    }

    this.isProcessing = true;
    console.log('🦉 Starting signup process...');
    
    try {
      const form = document.getElementById('signupFormElement');
      const formData = new FormData(form);
      
      const firstName = formData.get('firstName')?.trim() || '';
      const email = formData.get('email')?.trim() || '';
      const agreeTerms = document.getElementById('agreeTerms')?.checked || false;
      const marketingEmails = document.getElementById('marketingEmails')?.checked || false;

      console.log('🦉 Form data:', { firstName, email, agreeTerms, marketingEmails });

      // Enhanced validation
      if (!firstName || firstName.length < 2) {
        this.showError('Please enter a valid first name (at least 2 characters)');
        return;
      }

      if (!email || !this.isValidEmail(email)) {
        this.showError('Please enter a valid email address');
        return;
      }

      if (!agreeTerms) {
        this.showError('Please agree to the Terms of Service and Privacy Policy');
        return;
      }

      this.setLoading(true, 'signupBtn');

      console.log('🦉 Checking for existing users...');
      
      // Check if email already exists
      const existingUsers = await chrome.storage.local.get(['registeredUsers']);
      const users = existingUsers.registeredUsers || [];
      
      const existingUser = users.find(user => 
        user.email.toLowerCase() === email.toLowerCase()
      );
      
      if (existingUser) {
        this.showError('An account with this email already exists. Please sign in instead.');
        setTimeout(() => {
          document.getElementById('showLoginForm').click();
          document.getElementById('loginEmail').value = email;
        }, 2000);
        return;
      }

      console.log('🦉 Creating new user...');

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Create user object
      const user = {
        id: this.generateUserId(),
        firstName: firstName,
        email: email,
        marketingEmails: marketingEmails,
        createdAt: new Date().toISOString(),
        couponsEarned: 1, // Welcome coupon
        totalSavings: 0
      };

      console.log('🦉 New user created:', user);

      // Save user data
      users.push(user);
      await chrome.storage.local.set({
        user: user,
        isLoggedIn: true,
        registeredUsers: users
      });

      console.log('🦉 User data saved to storage');

      // Track successful signup - ONLY ONCE
      if (this.analyticsLoaded && typeof analytics !== 'undefined') {
        console.log('🦉 Tracking signup...');
        
        // Wait a moment to ensure analytics is fully ready
        setTimeout(() => {
          try {
            // Single identify call for signup
            analytics.identify(user.id, {
              firstName: user.firstName,
              email: user.email,
              marketing_emails: user.marketingEmails,
              signup_date: user.createdAt,
              user_type: 'registered',
              created_at: user.createdAt,
              coupons_earned: user.couponsEarned,
              total_savings: user.totalSavings
            });
            
            console.log('🦉 Analytics identify called for:', user.id);

            // Single track call for signup
            analytics.track('User Signed Up', {
              user_id: user.id,
              email: user.email,
              first_name: user.firstName,
              marketing_emails_opted_in: user.marketingEmails,
              signup_method: 'extension',
              signup_source: 'price_comparison_popup',
              welcome_coupon_earned: true,
              timestamp: user.createdAt
            });
            
            console.log('🦉 Analytics track "User Signed Up" called');
          } catch (analyticsError) {
            console.error('🦉 Error calling analytics:', analyticsError);
          }
        }, 100);
      } else {
        console.warn('🦉 Analytics not available for tracking signup');
        console.log('🦉 Analytics loaded:', this.analyticsLoaded);
        console.log('🦉 Analytics global:', typeof analytics !== 'undefined');
      }

      // Send welcome email (simulated)
      this.sendWelcomeEmail(user);

      // Show success state
      this.showSuccessState(user);
      this.showSuccess(`Welcome ${firstName}! Check your email for exclusive coupons.`);

    } catch (error) {
      console.error('🦉 Signup error:', error);
      this.showError('Failed to create account. Please try again.');
      
      // Track signup error
      if (this.analyticsLoaded && typeof analytics !== 'undefined') {
        analytics.track('Signup Failed', {
          error: error.message
        });
      }
    } finally {
      this.setLoading(false, 'signupBtn');
      this.isProcessing = false;
    }
  }

  async handleLogin() {
    if (this.isProcessing) {
      console.log('🦉 Login already in progress, ignoring duplicate request');
      return;
    }

    this.isProcessing = true;
    console.log('🦉 Starting login process...');
    
    try {
      const email = document.getElementById('loginEmail').value.trim();

      console.log('🦉 Login attempt for email:', email);

      if (!email || !this.isValidEmail(email)) {
        this.showError('Please enter a valid email address');
        return;
      }

      this.setLoading(true, 'loginBtn');

      console.log('🦉 Checking for existing user...');
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if user exists
      const existingUsers = await chrome.storage.local.get(['registeredUsers']);
      const users = existingUsers.registeredUsers || [];
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

      if (!user) {
        this.showError('No account found with this email. Please create an account first.');
        setTimeout(() => {
          document.getElementById('showSignupForm').click();
          document.getElementById('email').value = email;
        }, 2000);
        return;
      }

      console.log('🦉 User found, logging in:', user.firstName);

      // Update last login
      user.lastLogin = new Date().toISOString();
      const userIndex = users.findIndex(u => u.id === user.id);
      users[userIndex] = user;

      // Save updated user data
      await chrome.storage.local.set({
        user: user,
        isLoggedIn: true,
        registeredUsers: users
      });

      console.log('🦉 Login successful, user data updated');

      // Track successful login - ONLY ONCE
      if (this.analyticsLoaded && typeof analytics !== 'undefined') {
        console.log('🦉 Tracking login...');
        
        setTimeout(async () => {
          try {
            // Get additional data for enhanced identification
            const totalLogins = await this.incrementLoginCount(user.id);
            const loginStreak = await this.calculateLoginStreak(user.id);
            
            // Enhanced user identification with comprehensive profile data
            analytics.identify(user.id, {
              firstName: user.firstName,
              email: user.email,
              last_login: user.lastLogin,
              user_type: 'returning',
              signup_date: user.createdAt,
              marketing_emails: user.marketingEmails,
              total_logins: totalLogins,
              days_since_signup: this.calculateDaysSinceSignup(user.createdAt),
              account_status: 'active',
              login_streak: loginStreak,
              preferred_login_method: 'email'
            });
            
            console.log('🦉 Analytics identify called for login:', user.id);

            analytics.track('User Signed In', {
              user_id: user.id,
              email: user.email,
              first_name: user.firstName,
              login_method: 'email',
              login_source: 'extension',
              is_first_login: false,
              days_since_signup: this.calculateDaysSinceSignup(user.createdAt),
              timestamp: user.lastLogin
            });
            
            console.log('🦉 Analytics track "User Signed In" called');
          } catch (analyticsError) {
            console.error('🦉 Error calling analytics for login:', analyticsError);
          }
        }, 100);
      } else {
        console.warn('🦉 Analytics not available for tracking login');
        console.log('🦉 Analytics loaded:', this.analyticsLoaded);
        console.log('🦉 Analytics global:', typeof analytics !== 'undefined');
      }

      // Show success state
      this.showSuccessState(user);
      this.showSuccess(`Welcome back, ${user.firstName}!`);

    } catch (error) {
      console.error('🦉 Login error:', error);
      this.showError('Failed to sign in. Please try again.');
      
      // Track login error
      if (this.analyticsLoaded && typeof analytics !== 'undefined') {
        analytics.track('Login Failed', {
          error: error.message
        });
      }
    } finally {
      this.setLoading(false, 'loginBtn');
      this.isProcessing = false;
    }
  }

  showSuccessState(user) {
    document.getElementById('signupForm').classList.add('hidden');
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('successState').classList.remove('hidden');
    
    // Update welcome message
    document.getElementById('welcomeMessage').textContent = 
      `Hi ${user.firstName}! You're all set to start saving money with exclusive coupons.`;
  }

  setLoading(loading, buttonId) {
    const button = document.getElementById(buttonId);
    const spinner = button.querySelector('.loading-spinner');
    const text = button.querySelector('.btn-text');
    
    if (loading) {
      button.disabled = true;
      text.classList.add('hidden');
      spinner.classList.remove('hidden');
      button.closest('form').classList.add('form-loading');
    } else {
      button.disabled = false;
      text.classList.remove('hidden');
      spinner.classList.add('hidden');
      button.closest('form').classList.remove('form-loading');
    }
  }

  showError(message) {
    const errorEl = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    
    errorText.textContent = message;
    errorEl.classList.remove('hidden');
    
    setTimeout(() => {
      errorEl.classList.add('hidden');
    }, 5000);
  }

  showSuccess(message) {
    const successEl = document.getElementById('successMessage');
    const successText = document.getElementById('successText');
    
    successText.textContent = message;
    successEl.classList.remove('hidden');
    
    setTimeout(() => {
      successEl.classList.add('hidden');
    }, 4000);
  }

  // Helper methods
  generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async incrementLoginCount(userId) {
    try {
      const data = await chrome.storage.local.get(['userLoginCounts']);
      const counts = data.userLoginCounts || {};
      counts[userId] = (counts[userId] || 0) + 1;
      await chrome.storage.local.set({ userLoginCounts: counts });
      return counts[userId];
    } catch (error) {
      console.error('Error incrementing login count:', error);
      return 1;
    }
  }

  async calculateLoginStreak(userId) {
    try {
      // Simple implementation - return a random streak for demo
      return Math.floor(Math.random() * 10) + 1;
    } catch (error) {
      console.error('Error calculating login streak:', error);
      return 1;
    }
  }

  calculateDaysSinceSignup(signupDate) {
    try {
      const signup = new Date(signupDate);
      const now = new Date();
      const diffTime = Math.abs(now - signup);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch (error) {
      console.error('Error calculating days since signup:', error);
      return 0;
    }
  }

  async sendWelcomeEmail(user) {
    // In a real implementation, this would call your backend API
    // For now, we'll simulate it and store a local notification
    
    const welcomeEmail = {
      to: user.email,
      subject: 'Welcome to Owl Price Checker - Your Exclusive Coupons Inside!',
      template: 'welcome',
      coupons: [
        {
          code: 'WELCOME10',
          discount: '10% off',
          site: 'Amazon',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
        },
        {
          code: 'NEWUSER15',
          discount: '15% off',
          site: 'Nike',
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // 14 days
        }
      ],
      sentAt: new Date().toISOString()
    };

    // Store email locally for reference
    const emailHistory = await chrome.storage.local.get(['emailHistory']);
    const emails = emailHistory.emailHistory || [];
    emails.push(welcomeEmail);
    
    await chrome.storage.local.set({ 
      emailHistory: emails,
      pendingCoupons: welcomeEmail.coupons 
    });

    console.log('🦉 Welcome email queued:', welcomeEmail);
  }

  openTerms() {
    chrome.tabs.create({ 
      url: 'https://owlpricechecker.com/terms' // Replace with your actual terms URL
    });
    
    if (this.analyticsLoaded && typeof analytics !== 'undefined') {
      analytics.track('Terms of Service Viewed', {
        source: 'auth_page'
      });
    }
  }

  openPrivacy() {
    chrome.tabs.create({ 
      url: 'https://owlpricechecker.com/privacy' // Replace with your actual privacy URL
    });
    
    if (this.analyticsLoaded && typeof analytics !== 'undefined') {
      analytics.track('Privacy Policy Viewed', {
        source: 'auth_page'
      });
    }
  }
}

// Initialize auth manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('🦉 DOM loaded, initializing AuthManager');
  new AuthManager();
});

// Handle page visibility for analytics
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    if (typeof analytics !== 'undefined') {
      analytics.track('Auth Page Hidden');
    }
  }
});