document.addEventListener('mouseover', function(e) {
    if (e.target.tagName === 'IMG') {
      // Remove any existing copy button
      const existingButton = document.querySelector('.copy-link-button');
      if (existingButton) {
        existingButton.remove();
      }
  
      // Create the copy link button
      const copyButton = document.createElement('button');
      copyButton.textContent = 'Copy Link';
      copyButton.className = 'copy-link-button';
      copyButton.style.position = 'absolute';
      copyButton.style.zIndex = '1000';
      copyButton.style.padding = '5px';
      copyButton.style.border = '1px solid black';
      copyButton.style.background = 'white';
      copyButton.style.cursor = 'pointer';
      copyButton.style.fontSize = '12px';
  
      // Append the button to the body
      document.body.appendChild(copyButton);
  
      // Position the button near the image
      const imageRect = e.target.getBoundingClientRect();
      copyButton.style.top = `${imageRect.top + window.scrollY}px`;
      copyButton.style.left = `${imageRect.left + window.scrollX}px`;
  
      // Event listener for copying the image link
      copyButton.addEventListener('click', function() {
        const imageUrl = e.target.src;
        navigator.clipboard.writeText(imageUrl).then(() => {
          alert('Image link copied to clipboard!'); // Simple alert for testing
          copyButton.remove();
        });
      });
  
      // Handling hover state to prevent flashing
      let isHovered = false;
  
      copyButton.addEventListener('mouseover', function() {
        isHovered = true;
      });
  
      copyButton.addEventListener('mouseout', function() {
        isHovered = false;
        setTimeout(() => {
          if (!isHovered) {
            copyButton.remove();
          }
        }, 200);
      });
  
      e.target.addEventListener('mouseout', function() {
        setTimeout(() => {
          if (!isHovered) {
            copyButton.remove();
          }
        }, 200);
      });
    }
  });
  