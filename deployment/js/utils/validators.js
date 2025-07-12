// Validation Utilities
export class Validators {
  // Email validation
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Password validation
  static validatePassword(password) {
    return {
      isValid: password.length >= 6,
      hasMinLength: password.length >= 6,
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };
  }

  // Name validation
  static validateName(name) {
    return name.trim().length >= 2 && name.trim().length <= 50;
  }

  // Item title validation
  static validateItemTitle(title) {
    return title.trim().length >= 3 && title.trim().length <= 100;
  }

  // Item description validation
  static validateItemDescription(description) {
    return description.trim().length >= 10 && description.trim().length <= 1000;
  }

  // Points value validation
  static validatePointsValue(points) {
    const pointsNum = parseInt(points);
    return !isNaN(pointsNum) && pointsNum >= 1 && pointsNum <= 1000;
  }

  // Image file validation
  static validateImageFile(file) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSize = 2 * 1024 * 1024; // 2MB

    return {
      isValid: allowedTypes.includes(file.type) && file.size <= maxSize,
      validType: allowedTypes.includes(file.type),
      validSize: file.size <= maxSize,
      sizeInMB: (file.size / (1024 * 1024)).toFixed(2)
    };
  }

  // Category validation
  static validateCategory(category) {
    const allowedCategories = [
      'tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 
      'accessories', 'bags', 'jewelry', 'activewear', 'formal'
    ];
    return allowedCategories.includes(category.toLowerCase());
  }

  // Size validation
  static validateSize(size) {
    const allowedSizes = [
      'xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl',
      '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16',
      'one-size', 'free-size'
    ];
    return allowedSizes.includes(size.toLowerCase());
  }

  // Condition validation
  static validateCondition(condition) {
    const allowedConditions = ['excellent', 'good', 'fair', 'poor'];
    return allowedConditions.includes(condition.toLowerCase());
  }

  // Search query validation
  static validateSearchQuery(query) {
    return query.trim().length >= 1 && query.trim().length <= 100;
  }

  // Real-time form validation
  static setupRealTimeValidation(formId) {
    const form = document.getElementById(formId);
    if (!form) return;

    const inputs = form.querySelectorAll('input, textarea, select');
    
    inputs.forEach(input => {
      input.addEventListener('blur', () => this.validateField(input));
      input.addEventListener('input', () => this.clearFieldError(input));
    });
  }

  static validateField(field) {
    const fieldName = field.name;
    const value = field.value;
    let isValid = true;
    let errorMessage = '';

    switch (fieldName) {
      case 'email':
        isValid = this.validateEmail(value);
        errorMessage = 'Please enter a valid email address';
        break;
      case 'password':
        const passwordValidation = this.validatePassword(value);
        isValid = passwordValidation.isValid;
        errorMessage = 'Password must be at least 6 characters long';
        break;
      case 'displayName':
      case 'name':
        isValid = this.validateName(value);
        errorMessage = 'Name must be between 2 and 50 characters';
        break;
      case 'title':
        isValid = this.validateItemTitle(value);
        errorMessage = 'Title must be between 3 and 100 characters';
        break;
      case 'description':
        isValid = this.validateItemDescription(value);
        errorMessage = 'Description must be between 10 and 1000 characters';
        break;
      case 'pointsValue':
        isValid = this.validatePointsValue(value);
        errorMessage = 'Points must be between 1 and 1000';
        break;
      case 'category':
        isValid = this.validateCategory(value);
        errorMessage = 'Please select a valid category';
        break;
      case 'size':
        isValid = this.validateSize(value);
        errorMessage = 'Please select a valid size';
        break;
      case 'condition':
        isValid = this.validateCondition(value);
        errorMessage = 'Please select a valid condition';
        break;
    }

    this.showFieldValidation(field, isValid, errorMessage);
    return isValid;
  }

  static showFieldValidation(field, isValid, errorMessage) {
    const errorElement = document.getElementById(`${field.name}-error`);
    
    if (isValid) {
      field.classList.remove('border-red-500');
      field.classList.add('border-green-500');
      if (errorElement) {
        errorElement.textContent = '';
        errorElement.classList.add('hidden');
      }
    } else {
      field.classList.remove('border-green-500');
      field.classList.add('border-red-500');
      if (errorElement) {
        errorElement.textContent = errorMessage;
        errorElement.classList.remove('hidden');
      }
    }
  }

  static clearFieldError(field) {
    field.classList.remove('border-red-500');
    const errorElement = document.getElementById(`${field.name}-error`);
    if (errorElement) {
      errorElement.classList.add('hidden');
    }
  }
}

// Toast notification system
export function showToast(message, type = 'info', duration = 5000) {
  const toastContainer = getOrCreateToastContainer();
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type} fade-in`;
  toast.innerHTML = `
    <div class="flex items-center">
      <div class="flex-shrink-0">
        ${getToastIcon(type)}
      </div>
      <div class="ml-3">
        <p class="text-sm font-medium">${message}</p>
      </div>
      <div class="ml-auto pl-3">
        <button onclick="this.parentElement.parentElement.remove()" class="text-white hover:text-gray-200">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
          </svg>
        </button>
      </div>
    </div>
  `;

  toastContainer.appendChild(toast);

  // Auto remove after duration
  setTimeout(() => {
    if (toast.parentElement) {
      toast.classList.add('opacity-0');
      setTimeout(() => toast.remove(), 300);
    }
  }, duration);
}

function getOrCreateToastContainer() {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed top-4 right-4 z-50 space-y-2';
    document.body.appendChild(container);
  }
  return container;
}

function getToastIcon(type) {
  const icons = {
    success: '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>',
    error: '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>',
    warning: '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>',
    info: '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path></svg>'
  };
  return icons[type] || icons.info;
}

// Loading spinner
export function showSpinner(element = null) {
  if (element) {
    element.innerHTML = '<div class="spinner mx-auto"></div>';
  } else {
    const spinner = document.createElement('div');
    spinner.id = 'global-spinner';
    spinner.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    spinner.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(spinner);
  }
}

export function hideSpinner(element = null) {
  if (element) {
    element.innerHTML = '';
  } else {
    const spinner = document.getElementById('global-spinner');
    if (spinner) {
      spinner.remove();
    }
  }
}

// Debounce function for search
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Format date
export function formatDate(date) {
  if (!date) return '';
  const now = new Date();
  const diffTime = Math.abs(now - date.toDate());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.ceil(diffDays / 30)} months ago`;
  
  return date.toDate().toLocaleDateString();
}

// Format file size
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Lazy loading images
export function setupLazyLoading() {
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.classList.remove('lazy-image');
        img.classList.add('loaded');
        observer.unobserve(img);
      }
    });
  });

  document.querySelectorAll('.lazy-image').forEach(img => {
    imageObserver.observe(img);
  });
}

// Generate random ID
export function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// Deep clone object
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
