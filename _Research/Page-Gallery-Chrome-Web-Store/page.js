'use strict';

(() => {
    sendImagesToPopup();

    async function sendImagesToPopup() {
        const regularImageNodes = Array.from(document.querySelectorAll('img'));
    
        const backgroundNodes = Array.from(document.getElementsByTagName('*')).filter(node => {
            return getComputedStyle(node).backgroundImage !== 'none';
        });
        const backgroundImageURLs = backgroundNodes.map(node => {
            return urlFromCssBackgroundImage(getComputedStyle(node).backgroundImage);
        })
        .filter(x => x !== null);
        const backgroundImageNodes = backgroundImageURLs.map(url => {
            const image = document.createElement('img');
            image.crossOrigin = '';
            image.src = url;
            return image;
        });
    
        const imageNodes = regularImageNodes.concat(backgroundImageNodes);
        const images = await Promise.all(imageNodes.map(image => ({
            url: image.src,
            width: image.naturalWidth ? image.naturalWidth : image.width,
            height: image.naturalHeight ? image.naturalHeight : image.height,
            thumbnail: image.src,
        })));
    
        chrome.runtime.sendMessage({type: 'images-from-page', images});

        // Note that multiple background images are currently not supported. Doing
        // this properly would probably require implementing a complicated regex or
        // a proper parser based on the CSS syntax rules. Simply splitting on commas
        // would fail on inputs like data URLs.
        function urlFromCssBackgroundImage(cssValue) {
            if (!cssValue.startsWith('url(')) {
                return null;
            }

            const afterOpeningParen = cssValue.slice('url('.length);
            const hasQuote =
                afterOpeningParen.charAt(0) === '"' ||
                afterOpeningParen.charAt(0) === "'";
            const url = hasQuote ?
                afterOpeningParen.slice(1, -2) :
                afterOpeningParen.slice(0, -1);

            // Set the URL as the `src` of an `img` on the page, so that it's fully
            // resolved relative to the page, not to the extension. Note that this
            // will still fail if the URL relative to the stylesheet resolves to
            // something different than relative to the page.
            const image = document.createElement('img');
            image.src = url;
            return image.src;
        }

        function imageURLToDataURL(url) {
            return new Promise((resolve, reject) => {
                const image = document.createElement('img');
                image.crossOrigin = '';
                
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                image.onload = () => {
                    const size = 105;
                    canvas.width = size;
                    canvas.height = size * (image.naturalHeight / image.naturalWidth);
                    context.drawImage(image, 0, 0, canvas.width, canvas.height);
                    const dataURL = canvas.toDataURL('image/jpeg');
                    resolve(dataURL);
                };

                image.src = url;
            });
        }
    }
})();
