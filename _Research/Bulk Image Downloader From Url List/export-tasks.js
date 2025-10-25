// Initialize tab system
    document.addEventListener('DOMContentLoaded', function() {
      // Load help content when tab is first activated
      document.querySelector('.tab[data-tab="helpTab"]').addEventListener('click', function() {
        if (document.getElementById('helpTab').innerHTML.trim() === '') {
          fetch('documentation/help-content.html')
            .then(response => response.text())
            .then(html => {
              document.getElementById('helpTab').innerHTML = html;
              // Initialize any help-specific JS here
            });
        }
      });
    });