'use strict';
document.querySelector('[data-bind-click="login-1"]').addEventListener("click",function(event){if(event.target.matches('input[type="file"]')) return;login();});
