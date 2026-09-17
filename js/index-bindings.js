'use strict';
document.querySelector('[data-bind-click="index-1"]').addEventListener("click",function(event){if(event.target.matches('input[type="file"]')) return;enterStore('embroidery');});
document.querySelector('[data-bind-click="index-2"]').addEventListener("click",function(event){if(event.target.matches('input[type="file"]')) return;enterStore('printing');});
document.querySelector('[data-bind-click="index-3"]').addEventListener("click",function(event){if(event.target.matches('input[type="file"]')) return;goBack();});
document.querySelector('[data-bind-click="index-4"]').addEventListener("click",function(event){if(event.target.matches('input[type="file"]')) return;backToCategories();});
document.querySelector('[data-bind-click="index-7"]').addEventListener("click",function(event){if(event.target.matches('input[type="file"]')) return;showReviews();});
document.querySelector('[data-bind-click="index-8"]').addEventListener("click",function(event){if(event.target.matches('input[type="file"]')) return;closeProductModal();});
document.querySelector('[data-bind-click="index-9"]').addEventListener("click",function(event){if(event.target.matches('input[type="file"]')) return;this.classList.remove('active');});
