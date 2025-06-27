// auth.js - Authentication logic for Owl Price Checker

class AuthManager {
  constructor() {
    this.init();
  }

  async init() {
    // Load analytics
    await this.loadAnalytics();
    
    // Check if user is already logged in
    const userData = await chrome.storage.local.get(['user', 'isLoggedIn']);
    if (userData.isLoggedIn && userData.user) {
      this.showSuccessState(userData.user);
      return;
    }

    // Set up event listeners
    this.setupEventListeners();
    
    // Track page view
    if (typeof analytics !== 'undefined') {
      analytics.screen('Authentication Page', {
        timestamp: new Date().toISOString()
      });
    }
  }

  async loadAnalytics() {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'analytics.js';
      script.onload = resolve;
      script.onerror = resolve; // Continue even if analytics fails
      document.head.appendChild(script);
    });
  }

  setupEventListeners() {
    // Form switching
    document.getElementById('showLoginForm').addEventListener('click', (e) => {
      e.preventDefault();
      this.showLoginForm();
    });

    document.getElementById('showSignupForm').addEventListener('click', (e) => {
      e.preventDefault();
      this.showSignupForm();
    });

    // Form submissions
    document.getElementById('signupFormElement').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSignup();
    });

    document.getElementById('loginFormElement').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    // Continue button
    document.getElementById('continueBtn').addEventListener('click', () => {
      window.close(); // Close the auth window
    });

    // Terms and privacy links
    document.getElementById('termsLink').addEventListener('click', (e) => {
      e.preventDefault();
      this.openTerms();
    });

    document.getElementById('privacyLink').addEventListener('click', (e) => {
      e.preventDefault();
      this.openPrivacy();
    });

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
    if (typeof analytics !== 'undefined') {
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
    if (typeof analytics !== 'undefined') {
      analytics.track('Auth Form Switched', {
        from: 'login',
        to: 'signup'
      });
    }
  }

  async handleSignup() {
    const form = document.getElementById('signupFormElement');
    const formData = new FormData(form);
    
    const firstName = formData.get('firstName').trim();
    const email = formData.get('email').trim();
    const agreeTerms = document.getElementById('agreeTerms').checked;
    const marketingEmails = document.getElementById('marketingEmails').checked;

    // Validation
    if (!this.validateName(document.getElementById('firstName')) || 
        !this.validateEmail(document.getElementById('email'))) {
      return;
    }

    if (!agreeTerms) {
      this.showError('Please agree to the Terms of Service and Privacy Policy');
      return;
    }

    // Check if email already exists
    const existingUsers = await chrome.storage.local.get(['registeredUsers']);
    const users = existingUsers.registeredUsers || [];
    
    if (users.find(user => user.email.toLowerCase() === email.toLowerCase())) {
      this.showError('An account with this email already exists. Please sign in instead.');
      document.getElementById('showLoginForm').click();
      setTimeout(() => {
        document.getElementById('loginEmail').value = email;
      }, 300);
      return;
    }

    this.setLoading(true, 'signupBtn');

    try {
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

      // Save user data
      users.push(user);
      await chrome.storage.local.set({
        user: user,
        isLoggedIn: true,
        registeredUsers: users
      });

      // Track successful signup
      if (typeof analytics !== 'undefined') {
        analytics.identify(user.id, {
          firstName: user.firstName,
          email: user.email,
          marketing_emails: user.marketingEmails,
          signup_date: user.createdAt,
          user_type: 'registered'
        });

        analytics.track('User Signed Up', {
          user_id: user.id,
          marketing_emails_opted_in: user.marketingEmails,
          signup_method: 'extension',
          welcome_coupon_earned: true
        });
      }

      // Send welcome email (simulated)
      this.sendWelcomeEmail(user);

      // Show success state
      this.showSuccessState(user);
      this.showSuccess(`Welcome ${firstName}! Check your email for exclusive coupons.`);

    } catch (error) {
      console.error('Signup error:', error);
      this.showError('Failed to create account. Please try again.');
      
      // Track signup error
      if (typeof analytics !== 'undefined') {
        analytics.track('Signup Failed', {
          error: error.message,
          email: email
        });
      }
    } finally {
      this.setLoading(false, 'signupBtn');
    }
  }

  async handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();

    if (!this.validateEmail(document.getElementById('loginEmail'))) {
      return;
    }

    this.setLoading(true, 'loginBtn');

    try {
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

      // Track successful login
      if (typeof analytics !== 'undefined') {
        analytics.identify(user.id, {
          firstName: user.firstName,
          email: user.email,
          last_login: user.lastLogin,
          user_type: 'returning'
        });

        analytics.track('User Logged In', {
          user_id: user.id,
          login_method: 'extension'
        });
      }

      // Show success state
      this.showSuccessState(user);
      this.showSuccess(`Welcome back, ${user.firstName}!`);

    } catch (error) {
      console.error('Login error:', error);
      this.showError('Failed to sign in. Please try again.');
      
      // Track login error
      if (typeof analytics !== 'undefined') {
        analytics.track('Login Failed', {
          error: error.message,
          email: email
        });
      }
    } finally {
      this.setLoading(false, 'loginBtn');
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

  generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
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

    console.log('Welcome email queued:', welcomeEmail);
  }

  openTerms() {
    chrome.tabs.create({ 
      url: 'https://owlpricechecker.com/terms' // Replace with your actual terms URL
    });
    
    if (typeof analytics !== 'undefined') {
      analytics.track('Terms of Service Viewed', {
        source: 'auth_page'
      });
    }
  }

  openPrivacy() {
    chrome.tabs.create({ 
      url: 'https://owlpricechecker.com/privacy' // Replace with your actual privacy URL
    });
    
    if (typeof analytics !== 'undefined') {
      analytics.track('Privacy Policy Viewed', {
        source: 'auth_page'
      });
    }
  }
}

// Initialize auth manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
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