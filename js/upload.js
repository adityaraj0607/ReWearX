// Upload Item Functionality
import { storage } from './firebase-config.js';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ItemOperations } from './utils/firestore-ops.js';
import { Validators, showToast, showSpinner, hideSpinner } from './utils/validators.js';
import authManager from './auth.js';

class ItemUploader {
  constructor() {
    this.selectedFiles = [];
    this.maxFiles = 5;
    this.maxFileSize = 2 * 1024 * 1024; // 2MB
    this.init();
  }

  init() {
    this.setupDropZone();
    this.setupFileInput();
    this.setupForm();
    this.loadFormData();
  }

  setupDropZone() {
    const dropZone = document.getElementById('drop-zone');
    if (!dropZone) {
      return;
    }

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, this.preventDefaults, false);
      document.body.addEventListener(eventName, this.preventDefaults, false);
    });

    // Highlight drop zone when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
    });

    // Handle dropped files
    dropZone.addEventListener('drop', (e) => {
      const files = Array.from(e.dataTransfer.files);
      this.handleFiles(files);
    }, false);

    // Handle click to select files
    dropZone.addEventListener('click', (e) => {
      // Only trigger file input if clicking on the drop zone itself, not the button
      if (e.target.id !== 'select-photos-btn' && !e.target.closest('#select-photos-btn')) {
        document.getElementById('file-input').click();
      }
    });

    // Handle button click separately
    const selectPhotosBtn = document.getElementById('select-photos-btn');
    if (selectPhotosBtn) {
      selectPhotosBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('file-input').click();
      });
    }
  }

  setupFileInput() {
    const fileInput = document.getElementById('file-input');
    if (!fileInput) {
      return;
    }

    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      this.handleFiles(files);
    });
  }

  preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  handleFiles(files) {
    // Filter and validate files
    const validFiles = files.filter(file => {
      const validation = Validators.validateImageFile(file);
      
      if (!validation.validType) {
        showToast(`${file.name} is not a valid image type`, 'error');
        return false;
      }
      
      if (!validation.validSize) {
        showToast(`${file.name} is too large (${validation.sizeInMB}MB). Max size is 2MB`, 'error');
        return false;
      }
      
      return true;
    });

    // Check total file count
    if (this.selectedFiles.length + validFiles.length > this.maxFiles) {
      showToast(`You can only upload up to ${this.maxFiles} images`, 'error');
      return;
    }

    // Add files to selection
    validFiles.forEach(file => {
      // Check for duplicates
      const isDuplicate = this.selectedFiles.some(existing => 
        existing.name === file.name && existing.size === file.size
      );
      
      if (!isDuplicate) {
        this.selectedFiles.push(file);
      }
    });

    this.updatePreview();
  }

  updatePreview() {
    const preview = document.getElementById('image-preview');
    const dropZone = document.getElementById('drop-zone');
    
    if (this.selectedFiles.length === 0) {
      preview.innerHTML = '';
      dropZone.classList.remove('hidden');
      return;
    }

    dropZone.classList.add('hidden');
    
    preview.innerHTML = this.selectedFiles.map((file, index) => `
      <div class="relative group">
        <img 
          src="${URL.createObjectURL(file)}" 
          alt="Preview ${index + 1}"
          class="w-24 h-24 object-cover rounded-lg shadow-md"
        >
        <button
          type="button"
          onclick="itemUploader.removeFile(${index})"
          class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
        >
          ×
        </button>
        <div class="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 rounded-b-lg">
          ${index === 0 ? 'Main' : `${index + 1}`}
        </div>
      </div>
    `).join('');

    // Show add more button if under limit
    if (this.selectedFiles.length < this.maxFiles) {
      preview.innerHTML += `
        <div class="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-eco-green-500 transition-colors"
             onclick="document.getElementById('file-input').click()">
          <i class="fas fa-plus text-gray-400 text-xl"></i>
        </div>
      `;
    }
  }

  removeFile(index) {
    this.selectedFiles.splice(index, 1);
    this.updatePreview();
    
    if (this.selectedFiles.length === 0) {
      document.getElementById('drop-zone').classList.remove('hidden');
    }
  }

  setupForm() {
    const form = document.getElementById('upload-form');
    if (!form) {
      return;
    }

    // Setup real-time validation
    Validators.setupRealTimeValidation('upload-form');

    // Handle form submission
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });

    // Auto-generate tags based on title and description
    const titleInput = document.getElementById('title');
    const descriptionInput = document.getElementById('description');
    const tagsInput = document.getElementById('tags');

    [titleInput, descriptionInput].forEach(input => {
      if (input) {
        input.addEventListener('input', () => {
          this.generateTags(tagsInput);
        });
      }
    });
  }

  generateTags(tagsInput) {
    const title = document.getElementById('title').value.toLowerCase();
    const description = document.getElementById('description').value.toLowerCase();
    const category = document.getElementById('category').value;
    const size = document.getElementById('size').value;
    const condition = document.getElementById('condition').value;

    const suggestedTags = new Set();

    // Add category and condition as tags
    if (category) {
      suggestedTags.add(category);
    }
    if (condition) {
      suggestedTags.add(condition);
    }
    if (size && size !== 'one-size') {
      suggestedTags.add(size);
    }

    // Extract keywords from title and description
    const text = `${title} ${description}`;
    const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should'];
    
    const words = text.match(/\b\w{3,}\b/g) || [];
    words.forEach(word => {
      if (!commonWords.includes(word) && word.length >= 3) {
        suggestedTags.add(word);
      }
    });

    // Limit to 10 tags
    const tagsArray = Array.from(suggestedTags).slice(0, 10);
    tagsInput.value = tagsArray.join(', ');
  }

  async handleSubmit() {
    if (!authManager.isAuthenticated()) {
      showToast('Please sign in to upload items', 'error');
      return;
    }

    // Validate form data
    const formData = this.getFormData();
    if (!this.validateFormData(formData)) {
      return;
    }

    // Check if images are selected
    if (this.selectedFiles.length === 0) {
      showToast('Please select at least one image', 'error');
      return;
    }

    showSpinner();

    try {
      // Upload images first
      const imageUrls = await this.uploadImages();
      
      // Create item document
      const itemData = {
        ...formData,
        images: imageUrls,
        ownerId: authManager.getCurrentUser().uid,
        status: 'pending', // Items need admin approval
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
      };

      await ItemOperations.createItem(itemData);
      
      showToast('Item uploaded successfully! It will be available after admin approval.', 'success');
      
      // Clear form and redirect
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 2000);

    } catch (error) {
      showToast('Upload failed: ' + error.message, 'error');
      showToast('Failed to upload item. Please try again.', 'error');
    } finally {
      hideSpinner();
    }
  }

  async uploadItem(formData) {
    try {
      showSpinner();
      
      // Validate input data
      if (!this.validateFormData(formData)) {
        hideSpinner();
        return false;
      }
      
      // 1. First upload images and get URLs
      const uploadedImageUrls = await this.uploadImagesToStorage(formData.images);
      
      if (!uploadedImageUrls || uploadedImageUrls.length === 0) {
        showToast('Error uploading images. Please try again.', 'error');
        hideSpinner();
        return false;
      }
      
      // 2. Prepare item data with image URLs
      const itemData = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        type: formData.type,
        size: formData.size,
        color: formData.color,
        condition: formData.condition,
        brand: formData.brand,
        tags: formData.tags,
        pointsValue: parseInt(formData.pointsValue, 10),
        imageUrl: uploadedImageUrls[0], // Primary image
        imageUrls: uploadedImageUrls, // All images
        uploadedBy: authManager.currentUser.uid,
        userName: authManager.currentUser.displayName || authManager.currentUser.email?.split('@')[0] || 'User',
        userPhoto: authManager.currentUser.photoURL || '',
        status: 'available',
        createdAt: new Date(),
        likes: 0,
        views: 0
      };
      
      // 3. Store in Firestore
      const itemId = await ItemOperations.createItem(itemData);
      
      if (!itemId) {
        showToast('Error saving item to database. Please try again.', 'error');
        hideSpinner();
        return false;
      }
      
      showToast('Item uploaded successfully!', 'success');
      
      // Reset form and redirect after delay
      setTimeout(() => {
        window.location.href = `dashboard.html?new_item=${itemId}`;
      }, 1500);
      
      return true;
    } catch (error) {
      showToast('Error uploading item: ' + error.message, 'error');
      console.error('Upload error:', error);
      return false;
    } finally {
      hideSpinner();
    }
  }
  
  validateFormData(formData) {
    // Required fields
    const requiredFields = ['title', 'category', 'condition', 'size', 'pointsValue'];
    
    for (const field of requiredFields) {
      if (!formData[field]) {
        showToast(`Please provide the ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`, 'error');
        return false;
      }
    }
    
    // Check for images
    if (!formData.images || formData.images.length === 0) {
      showToast('Please upload at least one image of your item', 'error');
      return false;
    }
    
    return true;
  }
  
  async uploadImagesToStorage(images) {
    if (!images || images.length === 0) {
      return [];
    }
    
    try {
      const uploadPromises = images.map(async (file, index) => {
        const timestamp = new Date().getTime();
        const fileName = `${authManager.currentUser.uid}_${timestamp}_${index}`;
        const storageRef = ref(storage, `images/${authManager.currentUser.uid}/${fileName}`);
        
        // Upload the file
        await uploadBytes(storageRef, file);
        
        // Get download URL
        return getDownloadURL(storageRef);
      });
      
      return Promise.all(uploadPromises);
    } catch (error) {
      console.error('Image upload error:', error);
      showToast('Error uploading images. Please try again.', 'error');
      return [];
    }
  }

  getFormData() {
    return {
      title: document.getElementById('title').value.trim(),
      description: document.getElementById('description').value.trim(),
      category: document.getElementById('category').value,
      type: document.getElementById('type').value,
      size: document.getElementById('size').value,
      condition: document.getElementById('condition').value,
      pointsValue: parseInt(document.getElementById('pointsValue').value),
      tags: document.getElementById('tags').value,
      allowSwap: document.getElementById('allowSwap').checked,
      allowRedeem: document.getElementById('allowRedeem').checked
    };
  }

  validateFormData(data) {
    const errors = [];

    if (!Validators.validateItemTitle(data.title)) {
      errors.push('Title must be between 3 and 100 characters');
    }

    if (!Validators.validateItemDescription(data.description)) {
      errors.push('Description must be between 10 and 1000 characters');
    }

    if (!Validators.validateCategory(data.category)) {
      errors.push('Please select a valid category');
    }

    if (!Validators.validateSize(data.size)) {
      errors.push('Please select a valid size');
    }

    if (!Validators.validateCondition(data.condition)) {
      errors.push('Please select a valid condition');
    }

    if (!Validators.validatePointsValue(data.pointsValue)) {
      errors.push('Points value must be between 1 and 1000');
    }

    if (!data.allowSwap && !data.allowRedeem) {
      errors.push('Please allow at least one exchange method (swap or redeem)');
    }

    if (errors.length > 0) {
      showToast(errors[0], 'error');
      return false;
    }

    return true;
  }

  async uploadImages() {
    const uploadPromises = this.selectedFiles.map(async (file, index) => {
      const timestamp = Date.now();
      const fileName = `${timestamp}_${index}_${file.name}`;
      const storageRef = ref(storage, `item-images/${fileName}`);
      
      const snapshot = await uploadBytes(storageRef, file);
      return await getDownloadURL(snapshot.ref);
    });

    return await Promise.all(uploadPromises);
  }

  loadFormData() {
    // Load categories, sizes, conditions from cache or constants
    this.populateSelects();
  }

  populateSelects() {
    const categories = [
      { value: 'tops', label: 'Tops' },
      { value: 'bottoms', label: 'Bottoms' },
      { value: 'dresses', label: 'Dresses' },
      { value: 'outerwear', label: 'Outerwear' },
      { value: 'shoes', label: 'Shoes' },
      { value: 'accessories', label: 'Accessories' },
      { value: 'bags', label: 'Bags' },
      { value: 'jewelry', label: 'Jewelry' },
      { value: 'activewear', label: 'Activewear' },
      { value: 'formal', label: 'Formal Wear' }
    ];

    const types = [
      { value: 'mens', label: 'Men\'s' },
      { value: 'womens', label: 'Women\'s' },
      { value: 'unisex', label: 'Unisex' },
      { value: 'kids', label: 'Kids' }
    ];

    const sizes = [
      { value: 'xs', label: 'XS' },
      { value: 's', label: 'S' },
      { value: 'm', label: 'M' },
      { value: 'l', label: 'L' },
      { value: 'xl', label: 'XL' },
      { value: 'xxl', label: 'XXL' },
      { value: 'xxxl', label: 'XXXL' },
      { value: '6', label: '6' },
      { value: '7', label: '7' },
      { value: '8', label: '8' },
      { value: '9', label: '9' },
      { value: '10', label: '10' },
      { value: '11', label: '11' },
      { value: '12', label: '12' },
      { value: 'one-size', label: 'One Size' }
    ];

    const conditions = [
      { value: 'excellent', label: 'Excellent - Like new' },
      { value: 'good', label: 'Good - Minor wear' },
      { value: 'fair', label: 'Fair - Noticeable wear' },
      { value: 'poor', label: 'Poor - Significant wear' }
    ];

    this.populateSelect('category', categories);
    this.populateSelect('type', types);
    this.populateSelect('size', sizes);
    this.populateSelect('condition', conditions);
  }

  populateSelect(selectId, options) {
    const select = document.getElementById(selectId);
    if (!select) {
      return;
    }

    // Clear existing options except the first one (placeholder)
    const firstOption = select.firstElementChild;
    select.innerHTML = '';
    if (firstOption) {
      select.appendChild(firstOption);
    }

    options.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value;
      optionElement.textContent = option.label;
      select.appendChild(optionElement);
    });
  }
}

// Initialize uploader when DOM is loaded
let itemUploader;
document.addEventListener('DOMContentLoaded', () => {
  // Check authentication
  if (!authManager.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }

  itemUploader = new ItemUploader();
});

// Make it globally accessible for HTML onclick handlers
window.itemUploader = itemUploader;
