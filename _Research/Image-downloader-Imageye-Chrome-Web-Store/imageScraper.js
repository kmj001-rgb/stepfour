var __webpack_exports__ = {};
// Scrap images from a page
// Calling by popup.js

(function (_window$frameElement) {
  var ID_SCRAPING_FRAME = 'bbf98b9d-7a7f-48fb-a5b2-03c45332969e';

  // ignore iframe for scraping (initIframeScraper.js)
  if (window !== window.top && ((_window$frameElement = window.frameElement) === null || _window$frameElement === void 0 ? void 0 : _window$frameElement.id) === ID_SCRAPING_FRAME) return;
  var imageManager = {
    imageType: {
      IMG: 'IMG',
      TEXT: 'TEXT',
      LINK: 'LINK',
      INPUT_IMG: 'INPUT_IMG',
      BACKGROUND: 'BACKGROUND',
      DATAURL: 'DATAURL'
    },
    imgList: [],
    getImages: function getImages() {
      this.imgList = [];
      var imgs = document.getElementsByTagName('img');
      for (var i = 0; i < imgs.length; i++) {
        var img = imgs[i];
        var newImg = new Image();
        newImg.src = img.src;
        var width = 0;
        var height = 0;
        width = parseInt(img.naturalWidth);
        height = parseInt(img.naturalHeight);
        nwidth = parseInt(newImg.width);
        nheight = parseInt(newImg.height);
        width = nwidth > width ? nwidth : width;
        height = nheight > height ? nheight : height;
        this.addImg(imageManager.imageType.IMG, img.src, width, height);
      }
      imgs = document.images;
      if (imgs && imgs.length > 0) {
        for (var i = 0; i < imgs.length; i++) {
          try {
            var img = imgs[i];
            var newImg = new Image();
            newImg.src = img.currentSrc;
            var width = 0;
            var height = 0;
            width = parseInt(img.naturalWidth);
            height = parseInt(img.naturalHeight);
            nwidth = parseInt(newImg.width);
            nheight = parseInt(newImg.height);
            width = nwidth > width ? nwidth : width;
            height = nheight > height ? nheight : height;
            newImg = null;
            this.addImg(imageManager.imageType.IMG, img.currentSrc, width, height);
          } catch (e) {}
        }
      }
      try {
        imgs = imageManager.querySelectorAllShadows('img');
        if (imgs && imgs.length > 0) {
          for (var i = 0; i < imgs.length; i++) {
            try {
              var img = imgs[i];
              var newImg = new Image();
              newImg.src = img.currentSrc;
              var width = 0;
              var height = 0;
              width = parseInt(img.naturalWidth);
              height = parseInt(img.naturalHeight);
              nwidth = parseInt(newImg.width);
              nheight = parseInt(newImg.height);
              width = nwidth > width ? nwidth : width;
              height = nheight > height ? nheight : height;
              newImg = null;
              this.addImg(imageManager.imageType.IMG, img.currentSrc, width, height);
            } catch (e) {}
          }
        }
      } catch (e) {
        // experimental feature lets catch everything
      }
      var sources = document.getElementsByTagName('source');
      if (sources && sources.length > 0) {
        for (var i = 0; i < sources.length; i++) {
          try {
            var source = sources[i];
            if (!source.srcset) continue;
            var newImg = new Image();
            newImg.src = source.srcset;
            var width = parseInt(newImg.naturalWidth);
            var height = parseInt(newImg.naturalHeight);
            nwidth = parseInt(newImg.width);
            nheight = parseInt(newImg.height);
            width = nwidth > width ? nwidth : width;
            height = nheight > height ? nheight : height;
            this.addImg(imageManager.imageType.IMG, newImg.src, width, height);
            newImg = null;
          } catch (e) {}
        }
      }
      var srcsets = document.querySelectorAll('img[srcset]');
      if (srcsets && srcsets.length > 0) {
        for (var i = 0; i < srcsets.length; i++) {
          try {
            var img = srcsets[i];
            if (!img.srcset) continue;
            var srcset = img.srcset.split(',');
            for (var j = 0; j < srcset.length; j++) {
              try {
                var src = srcset[j];
                src = src.substring(0, src.indexOf(' ') != -1 ? src.indexOf(' ') : src.length);
                var newImg = new Image();
                newImg.src = src;
                src = newImg.src;
                var width = parseInt(newImg.naturalWidth);
                var height = parseInt(newImg.naturalHeight);
                nwidth = parseInt(newImg.width);
                nheight = parseInt(newImg.height);
                width = nwidth > width ? nwidth : width;
                height = nheight > height ? nheight : height;
                newImg = null;
                console.log("adding img from srcset: ".concat(src, " w: ").concat(width, " h:").concat(height));
                this.addImg(imageManager.imageType.IMG, src, width, height);
              } catch (e) {
                console.error('cannot add image of srcset: ');
              }
            }
          } catch (e) {}
        }
      }
      var inputs = document.getElementsByTagName('input');
      for (var i = 0; i < inputs.length; i++) {
        var input = inputs[i];
        var type = input.type;
        if (type.toUpperCase() == 'IMAGE') {
          var src = input.src;
          this.addImg(imageManager.imageType.INPUT_IMG, src, 0, 0);
        }
      }
      var links = document.getElementsByTagName('a');
      for (var i = 0; i < links.length; i++) {
        var link = links[i];
        var href = link.href;
        if (href.endsWith('.jpg') || href.endsWith('.jpeg') || href.endsWith('.bmp') || href.endsWith('.ico') || href.endsWith('.gif') || href.endsWith('.png')) {
          this.addImg(imageManager.imageType.LINK, href, 0, 0);
        }
      }
      var svgs = document.getElementsByTagName('svg');
      for (var i = 0; i < svgs.length; i++) {
        var svg = svgs[i];
        var dataUrl = "data:image/svg+xml;base64,".concat(btoa(unescape(encodeURIComponent(svg.outerHTML))));
        this.addImg(imageManager.imageType.DATAURL, dataUrl, 0, 0);
      }
      var url;
      var B = [];
      var A = document.getElementsByTagName('*');
      A = B.slice.call(A, 0, A.length);
      while (A.length) {
        url = imageManager.deepCss(A.shift(), 'background-image');
        try {
          if (url && url != 'none') {
            var re = /url\(['"]?([^")]+)/g;
            var matches;
            while ((matches = re.exec(url)) != null) {
              var src = matches[1];
              if (src && imageManager.arrayIndexOf(B, src) == -1) {
                var newImg = new Image();
                newImg.src = src;
                src = newImg.src;
                this.addImg(imageManager.imageType.BACKGROUND, src, 0, 0);
              }
            }
          }
        } catch (e) {
          console.error('cannot add image background-image');
        }
      }
      url, B = [], A = document.getElementsByTagName('*');
      A = B.slice.call(A, 0, A.length);
      while (A.length) {
        url = imageManager.deepCss(A.shift(), 'background');
        try {
          if (url && url != 'none') {
            var re = /url\(['"]?([^")]+)/g;
            var matches;
            while ((matches = re.exec(url)) != null) {
              var src = matches[1];
              if (src && imageManager.arrayIndexOf(B, src) == -1) {
                var newImg = new Image();
                newImg.src = src;
                src = newImg.src;
                this.addImg(imageManager.imageType.BACKGROUND, src, 0, 0);
              }
            }
          }
        } catch (e) {
          console.error('cannot add image background-image');
        }
      }
      try {
        var urls = document.body.innerHTML.match(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,4}\b([-a-zA-Z0-9@:%_\+.~#?//=]*)/gi).filter(function (itm, i, a) {
          return i == a.indexOf(itm);
        });
        for (var i = 0; i < urls.length; i++) if (urls[i].match(/.*(\.png|\.svg|\.jpg|\.gif|\.jpeg|\.bmp|\.ico|\.webp|\.tif|\.apng|\.jfif|\.pjpeg|\.pjp).*/i) != null) this.addImg(imageManager.imageType.LINK, urls[i], 0, 0);
      } catch (e) {
        console.log("getImages error retreiving images by url: ".concat(e));
      }
      // move popup into html of the page
      /* https://github.com/mitchas/Keyframes.app/tree/master/Keyframes.app%20(Extension)/js
      $.get(chrome.extension.getURL('popup.html'), function (data) {
        debugger;
        $("body").append(data);
      });
      */
      return this.imgList;
    },
    addImg: function addImg(d, f, c, a) {
      this.imgList.push({
        type: d,
        src: f,
        width: c,
        height: a
      });
    },
    getUniqueImagesSrcs: function getUniqueImagesSrcs() {
      var images = imageManager.getImages();
      var imagesStrArray = new Array();
      for (var i = 0; i < images.length; i++) {
        imagesStrArray[imagesStrArray.length] = images[i].src;
      }
      var uniques = imagesStrArray.reverse().filter(function (e, i, arr) {
        return arr.indexOf(e, i + 1) === -1;
      }).reverse();
      return uniques;
    },
    deepCss: function deepCss(who, css) {
      if (!who || !who.style) return '';
      var sty = css.replace(/\-([a-z])/g, function (a, b) {
        return b.toUpperCase();
      });
      if (who.currentStyle) {
        return who.style[sty] || who.currentStyle[sty] || '';
      }
      var dv = document.defaultView || window;
      return who.style[sty] || dv.getComputedStyle(who, '').getPropertyValue(css) || '';
    },
    arrayIndexOf: function arrayIndexOf(array, what, index) {
      index = index || 0;
      var L = array.length;
      while (index < L) {
        if (array[index] === what) return index;
        ++index;
      }
      return -1;
    },
    querySelectorAllShadows: function querySelectorAllShadows(selector) {
      var el = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : document.body;
      // recurse on childShadows
      var childShadows = Array.from(el.querySelectorAll('*')).map(function (el) {
        return el.shadowRoot;
      }).filter(Boolean);

      // console.log('[querySelectorAllShadows]', selector, el, `(${childShadows.length} shadowRoots)`);

      var childResults = childShadows.map(function (child) {
        return imageManager.querySelectorAllShadows(selector, child);
      });

      // fuse all results into singular, flat array
      var result = Array.from(el.querySelectorAll(selector));
      return result.concat(childResults).flat();
    }
  };
  var result = {
    images: imageManager.getUniqueImagesSrcs(),
    title: document.title,
    isTop: window.top == window.self,
    origin: window.location.origin
  };
  try {
    result.isArc = getComputedStyle(document.documentElement).getPropertyValue('--arc-palette-title');
  } catch (e) {
    // empty string
  }
  return result;
})();

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1hZ2VTY3JhcGVyLmpzIiwibWFwcGluZ3MiOiI7QUFBQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQUE7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFFQTtBQUFBO0FBQ0E7QUFPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFFQTtBQUFBO0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUFBO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQUE7O0FBR0E7O0FBRUE7QUFBQTtBQUFBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUFBO0FBR0E7QUFDQSIsInNvdXJjZXMiOlsid2VicGFjazovL2ltYWdleWUvLi9zcmMvbGVnYWN5L2ltYWdlU2NyYXBlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBTY3JhcCBpbWFnZXMgZnJvbSBhIHBhZ2Vcbi8vIENhbGxpbmcgYnkgcG9wdXAuanNcblxuKCgpID0+IHtcbiAgY29uc3QgSURfU0NSQVBJTkdfRlJBTUUgPSAnYmJmOThiOWQtN2E3Zi00OGZiLWE1YjItMDNjNDUzMzI5NjllJztcblxuICAvLyBpZ25vcmUgaWZyYW1lIGZvciBzY3JhcGluZyAoaW5pdElmcmFtZVNjcmFwZXIuanMpXG4gIGlmICh3aW5kb3cgIT09IHdpbmRvdy50b3AgJiYgd2luZG93LmZyYW1lRWxlbWVudD8uaWQgPT09IElEX1NDUkFQSU5HX0ZSQU1FKSByZXR1cm47XG5cbiAgdmFyIGltYWdlTWFuYWdlciA9IHtcbiAgICBpbWFnZVR5cGU6IHtcbiAgICAgIElNRzogJ0lNRycsXG4gICAgICBURVhUOiAnVEVYVCcsXG4gICAgICBMSU5LOiAnTElOSycsXG4gICAgICBJTlBVVF9JTUc6ICdJTlBVVF9JTUcnLFxuICAgICAgQkFDS0dST1VORDogJ0JBQ0tHUk9VTkQnLFxuICAgICAgREFUQVVSTDogJ0RBVEFVUkwnLFxuICAgIH0sXG4gICAgaW1nTGlzdDogW10sXG4gICAgZ2V0SW1hZ2VzKCkge1xuICAgICAgdGhpcy5pbWdMaXN0ID0gW107XG4gICAgICBsZXQgaW1ncyA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdpbWcnKTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgaW1ncy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgaW1nID0gaW1nc1tpXTtcbiAgICAgICAgdmFyIG5ld0ltZyA9IG5ldyBJbWFnZSgpO1xuICAgICAgICBuZXdJbWcuc3JjID0gaW1nLnNyYztcbiAgICAgICAgdmFyIHdpZHRoID0gMDtcbiAgICAgICAgdmFyIGhlaWdodCA9IDA7XG4gICAgICAgIHdpZHRoID0gcGFyc2VJbnQoaW1nLm5hdHVyYWxXaWR0aCk7XG4gICAgICAgIGhlaWdodCA9IHBhcnNlSW50KGltZy5uYXR1cmFsSGVpZ2h0KTtcbiAgICAgICAgbndpZHRoID0gcGFyc2VJbnQobmV3SW1nLndpZHRoKTtcbiAgICAgICAgbmhlaWdodCA9IHBhcnNlSW50KG5ld0ltZy5oZWlnaHQpO1xuICAgICAgICB3aWR0aCA9IG53aWR0aCA+IHdpZHRoID8gbndpZHRoIDogd2lkdGg7XG4gICAgICAgIGhlaWdodCA9IG5oZWlnaHQgPiBoZWlnaHQgPyBuaGVpZ2h0IDogaGVpZ2h0O1xuICAgICAgICB0aGlzLmFkZEltZyhpbWFnZU1hbmFnZXIuaW1hZ2VUeXBlLklNRywgaW1nLnNyYywgd2lkdGgsIGhlaWdodCk7XG4gICAgICB9XG4gICAgICBpbWdzID0gZG9jdW1lbnQuaW1hZ2VzO1xuICAgICAgaWYgKGltZ3MgJiYgaW1ncy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgaW1ncy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICB2YXIgaW1nID0gaW1nc1tpXTtcbiAgICAgICAgICAgIHZhciBuZXdJbWcgPSBuZXcgSW1hZ2UoKTtcbiAgICAgICAgICAgIG5ld0ltZy5zcmMgPSBpbWcuY3VycmVudFNyYztcbiAgICAgICAgICAgIHZhciB3aWR0aCA9IDA7XG4gICAgICAgICAgICB2YXIgaGVpZ2h0ID0gMDtcbiAgICAgICAgICAgIHdpZHRoID0gcGFyc2VJbnQoaW1nLm5hdHVyYWxXaWR0aCk7XG4gICAgICAgICAgICBoZWlnaHQgPSBwYXJzZUludChpbWcubmF0dXJhbEhlaWdodCk7XG4gICAgICAgICAgICBud2lkdGggPSBwYXJzZUludChuZXdJbWcud2lkdGgpO1xuICAgICAgICAgICAgbmhlaWdodCA9IHBhcnNlSW50KG5ld0ltZy5oZWlnaHQpO1xuICAgICAgICAgICAgd2lkdGggPSBud2lkdGggPiB3aWR0aCA/IG53aWR0aCA6IHdpZHRoO1xuICAgICAgICAgICAgaGVpZ2h0ID0gbmhlaWdodCA+IGhlaWdodCA/IG5oZWlnaHQgOiBoZWlnaHQ7XG4gICAgICAgICAgICBuZXdJbWcgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5hZGRJbWcoaW1hZ2VNYW5hZ2VyLmltYWdlVHlwZS5JTUcsIGltZy5jdXJyZW50U3JjLCB3aWR0aCwgaGVpZ2h0KTtcbiAgICAgICAgICB9IGNhdGNoIChlKSB7fVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0cnkge1xuICAgICAgICBpbWdzID0gaW1hZ2VNYW5hZ2VyLnF1ZXJ5U2VsZWN0b3JBbGxTaGFkb3dzKCdpbWcnKTtcbiAgICAgICAgaWYgKGltZ3MgJiYgaW1ncy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBpbWdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICB2YXIgaW1nID0gaW1nc1tpXTtcbiAgICAgICAgICAgICAgdmFyIG5ld0ltZyA9IG5ldyBJbWFnZSgpO1xuICAgICAgICAgICAgICBuZXdJbWcuc3JjID0gaW1nLmN1cnJlbnRTcmM7XG4gICAgICAgICAgICAgIHZhciB3aWR0aCA9IDA7XG4gICAgICAgICAgICAgIHZhciBoZWlnaHQgPSAwO1xuICAgICAgICAgICAgICB3aWR0aCA9IHBhcnNlSW50KGltZy5uYXR1cmFsV2lkdGgpO1xuICAgICAgICAgICAgICBoZWlnaHQgPSBwYXJzZUludChpbWcubmF0dXJhbEhlaWdodCk7XG4gICAgICAgICAgICAgIG53aWR0aCA9IHBhcnNlSW50KG5ld0ltZy53aWR0aCk7XG4gICAgICAgICAgICAgIG5oZWlnaHQgPSBwYXJzZUludChuZXdJbWcuaGVpZ2h0KTtcbiAgICAgICAgICAgICAgd2lkdGggPSBud2lkdGggPiB3aWR0aCA/IG53aWR0aCA6IHdpZHRoO1xuICAgICAgICAgICAgICBoZWlnaHQgPSBuaGVpZ2h0ID4gaGVpZ2h0ID8gbmhlaWdodCA6IGhlaWdodDtcbiAgICAgICAgICAgICAgbmV3SW1nID0gbnVsbDtcbiAgICAgICAgICAgICAgdGhpcy5hZGRJbWcoaW1hZ2VNYW5hZ2VyLmltYWdlVHlwZS5JTUcsIGltZy5jdXJyZW50U3JjLCB3aWR0aCwgaGVpZ2h0KTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHt9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIC8vIGV4cGVyaW1lbnRhbCBmZWF0dXJlIGxldHMgY2F0Y2ggZXZlcnl0aGluZ1xuICAgICAgfVxuICAgICAgY29uc3Qgc291cmNlcyA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdzb3VyY2UnKTtcbiAgICAgIGlmIChzb3VyY2VzICYmIHNvdXJjZXMubGVuZ3RoID4gMCkge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNvdXJjZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgc291cmNlID0gc291cmNlc1tpXTtcbiAgICAgICAgICAgIGlmICghc291cmNlLnNyY3NldCkgY29udGludWU7XG4gICAgICAgICAgICB2YXIgbmV3SW1nID0gbmV3IEltYWdlKCk7XG4gICAgICAgICAgICBuZXdJbWcuc3JjID0gc291cmNlLnNyY3NldDtcbiAgICAgICAgICAgIHZhciB3aWR0aCA9IHBhcnNlSW50KG5ld0ltZy5uYXR1cmFsV2lkdGgpO1xuICAgICAgICAgICAgdmFyIGhlaWdodCA9IHBhcnNlSW50KG5ld0ltZy5uYXR1cmFsSGVpZ2h0KTtcbiAgICAgICAgICAgIG53aWR0aCA9IHBhcnNlSW50KG5ld0ltZy53aWR0aCk7XG4gICAgICAgICAgICBuaGVpZ2h0ID0gcGFyc2VJbnQobmV3SW1nLmhlaWdodCk7XG4gICAgICAgICAgICB3aWR0aCA9IG53aWR0aCA+IHdpZHRoID8gbndpZHRoIDogd2lkdGg7XG4gICAgICAgICAgICBoZWlnaHQgPSBuaGVpZ2h0ID4gaGVpZ2h0ID8gbmhlaWdodCA6IGhlaWdodDtcbiAgICAgICAgICAgIHRoaXMuYWRkSW1nKGltYWdlTWFuYWdlci5pbWFnZVR5cGUuSU1HLCBuZXdJbWcuc3JjLCB3aWR0aCwgaGVpZ2h0KTtcbiAgICAgICAgICAgIG5ld0ltZyA9IG51bGw7XG4gICAgICAgICAgfSBjYXRjaCAoZSkge31cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zdCBzcmNzZXRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnaW1nW3NyY3NldF0nKTtcbiAgICAgIGlmIChzcmNzZXRzICYmIHNyY3NldHMubGVuZ3RoID4gMCkge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNyY3NldHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgdmFyIGltZyA9IHNyY3NldHNbaV07XG4gICAgICAgICAgICBpZiAoIWltZy5zcmNzZXQpIGNvbnRpbnVlO1xuICAgICAgICAgICAgY29uc3Qgc3Jjc2V0ID0gaW1nLnNyY3NldC5zcGxpdCgnLCcpO1xuICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBzcmNzZXQubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICB2YXIgc3JjID0gc3Jjc2V0W2pdO1xuICAgICAgICAgICAgICAgIHNyYyA9IHNyYy5zdWJzdHJpbmcoMCwgc3JjLmluZGV4T2YoJyAnKSAhPSAtMSA/IHNyYy5pbmRleE9mKCcgJykgOiBzcmMubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICB2YXIgbmV3SW1nID0gbmV3IEltYWdlKCk7XG4gICAgICAgICAgICAgICAgbmV3SW1nLnNyYyA9IHNyYztcbiAgICAgICAgICAgICAgICBzcmMgPSBuZXdJbWcuc3JjO1xuICAgICAgICAgICAgICAgIHZhciB3aWR0aCA9IHBhcnNlSW50KG5ld0ltZy5uYXR1cmFsV2lkdGgpO1xuICAgICAgICAgICAgICAgIHZhciBoZWlnaHQgPSBwYXJzZUludChuZXdJbWcubmF0dXJhbEhlaWdodCk7XG4gICAgICAgICAgICAgICAgbndpZHRoID0gcGFyc2VJbnQobmV3SW1nLndpZHRoKTtcbiAgICAgICAgICAgICAgICBuaGVpZ2h0ID0gcGFyc2VJbnQobmV3SW1nLmhlaWdodCk7XG4gICAgICAgICAgICAgICAgd2lkdGggPSBud2lkdGggPiB3aWR0aCA/IG53aWR0aCA6IHdpZHRoO1xuICAgICAgICAgICAgICAgIGhlaWdodCA9IG5oZWlnaHQgPiBoZWlnaHQgPyBuaGVpZ2h0IDogaGVpZ2h0O1xuICAgICAgICAgICAgICAgIG5ld0ltZyA9IG51bGw7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYGFkZGluZyBpbWcgZnJvbSBzcmNzZXQ6ICR7c3JjfSB3OiAke3dpZHRofSBoOiR7aGVpZ2h0fWApO1xuICAgICAgICAgICAgICAgIHRoaXMuYWRkSW1nKGltYWdlTWFuYWdlci5pbWFnZVR5cGUuSU1HLCBzcmMsIHdpZHRoLCBoZWlnaHQpO1xuICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignY2Fubm90IGFkZCBpbWFnZSBvZiBzcmNzZXQ6ICcpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBjYXRjaCAoZSkge31cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zdCBpbnB1dHMgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaW5wdXQnKTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgaW5wdXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGlucHV0ID0gaW5wdXRzW2ldO1xuICAgICAgICBjb25zdCB7IHR5cGUgfSA9IGlucHV0O1xuICAgICAgICBpZiAodHlwZS50b1VwcGVyQ2FzZSgpID09ICdJTUFHRScpIHtcbiAgICAgICAgICB2YXIgeyBzcmMgfSA9IGlucHV0O1xuICAgICAgICAgIHRoaXMuYWRkSW1nKGltYWdlTWFuYWdlci5pbWFnZVR5cGUuSU5QVVRfSU1HLCBzcmMsIDAsIDApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjb25zdCBsaW5rcyA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdhJyk7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxpbmtzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGxpbmsgPSBsaW5rc1tpXTtcbiAgICAgICAgY29uc3QgeyBocmVmIH0gPSBsaW5rO1xuICAgICAgICBpZiAoXG4gICAgICAgICAgaHJlZi5lbmRzV2l0aCgnLmpwZycpIHx8XG4gICAgICAgICAgaHJlZi5lbmRzV2l0aCgnLmpwZWcnKSB8fFxuICAgICAgICAgIGhyZWYuZW5kc1dpdGgoJy5ibXAnKSB8fFxuICAgICAgICAgIGhyZWYuZW5kc1dpdGgoJy5pY28nKSB8fFxuICAgICAgICAgIGhyZWYuZW5kc1dpdGgoJy5naWYnKSB8fFxuICAgICAgICAgIGhyZWYuZW5kc1dpdGgoJy5wbmcnKVxuICAgICAgICApIHtcbiAgICAgICAgICB0aGlzLmFkZEltZyhpbWFnZU1hbmFnZXIuaW1hZ2VUeXBlLkxJTkssIGhyZWYsIDAsIDApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjb25zdCBzdmdzID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3N2ZycpO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IHN2ZyA9IHN2Z3NbaV07XG4gICAgICAgIGNvbnN0IGRhdGFVcmwgPSBgZGF0YTppbWFnZS9zdmcreG1sO2Jhc2U2NCwke2J0b2EodW5lc2NhcGUoZW5jb2RlVVJJQ29tcG9uZW50KHN2Zy5vdXRlckhUTUwpKSl9YDtcbiAgICAgICAgdGhpcy5hZGRJbWcoaW1hZ2VNYW5hZ2VyLmltYWdlVHlwZS5EQVRBVVJMLCBkYXRhVXJsLCAwLCAwKTtcbiAgICAgIH1cbiAgICAgIGxldCB1cmw7XG4gICAgICBsZXQgQiA9IFtdO1xuICAgICAgbGV0IEEgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnKicpO1xuICAgICAgQSA9IEIuc2xpY2UuY2FsbChBLCAwLCBBLmxlbmd0aCk7XG4gICAgICB3aGlsZSAoQS5sZW5ndGgpIHtcbiAgICAgICAgdXJsID0gaW1hZ2VNYW5hZ2VyLmRlZXBDc3MoQS5zaGlmdCgpLCAnYmFja2dyb3VuZC1pbWFnZScpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGlmICh1cmwgJiYgdXJsICE9ICdub25lJykge1xuICAgICAgICAgICAgdmFyIHJlID0gL3VybFxcKFsnXCJdPyhbXlwiKV0rKS9nO1xuICAgICAgICAgICAgdmFyIG1hdGNoZXM7XG4gICAgICAgICAgICB3aGlsZSAoKG1hdGNoZXMgPSByZS5leGVjKHVybCkpICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgdmFyIHNyYyA9IG1hdGNoZXNbMV07XG4gICAgICAgICAgICAgIGlmIChzcmMgJiYgaW1hZ2VNYW5hZ2VyLmFycmF5SW5kZXhPZihCLCBzcmMpID09IC0xKSB7XG4gICAgICAgICAgICAgICAgdmFyIG5ld0ltZyA9IG5ldyBJbWFnZSgpO1xuICAgICAgICAgICAgICAgIG5ld0ltZy5zcmMgPSBzcmM7XG4gICAgICAgICAgICAgICAgc3JjID0gbmV3SW1nLnNyYztcbiAgICAgICAgICAgICAgICB0aGlzLmFkZEltZyhpbWFnZU1hbmFnZXIuaW1hZ2VUeXBlLkJBQ0tHUk9VTkQsIHNyYywgMCwgMCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKCdjYW5ub3QgYWRkIGltYWdlIGJhY2tncm91bmQtaW1hZ2UnKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB1cmwsIChCID0gW10pLCAoQSA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCcqJykpO1xuICAgICAgQSA9IEIuc2xpY2UuY2FsbChBLCAwLCBBLmxlbmd0aCk7XG4gICAgICB3aGlsZSAoQS5sZW5ndGgpIHtcbiAgICAgICAgdXJsID0gaW1hZ2VNYW5hZ2VyLmRlZXBDc3MoQS5zaGlmdCgpLCAnYmFja2dyb3VuZCcpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGlmICh1cmwgJiYgdXJsICE9ICdub25lJykge1xuICAgICAgICAgICAgdmFyIHJlID0gL3VybFxcKFsnXCJdPyhbXlwiKV0rKS9nO1xuICAgICAgICAgICAgdmFyIG1hdGNoZXM7XG4gICAgICAgICAgICB3aGlsZSAoKG1hdGNoZXMgPSByZS5leGVjKHVybCkpICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgdmFyIHNyYyA9IG1hdGNoZXNbMV07XG4gICAgICAgICAgICAgIGlmIChzcmMgJiYgaW1hZ2VNYW5hZ2VyLmFycmF5SW5kZXhPZihCLCBzcmMpID09IC0xKSB7XG4gICAgICAgICAgICAgICAgdmFyIG5ld0ltZyA9IG5ldyBJbWFnZSgpO1xuICAgICAgICAgICAgICAgIG5ld0ltZy5zcmMgPSBzcmM7XG4gICAgICAgICAgICAgICAgc3JjID0gbmV3SW1nLnNyYztcbiAgICAgICAgICAgICAgICB0aGlzLmFkZEltZyhpbWFnZU1hbmFnZXIuaW1hZ2VUeXBlLkJBQ0tHUk9VTkQsIHNyYywgMCwgMCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKCdjYW5ub3QgYWRkIGltYWdlIGJhY2tncm91bmQtaW1hZ2UnKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgdXJscyA9IGRvY3VtZW50LmJvZHkuaW5uZXJIVE1MXG4gICAgICAgICAgLm1hdGNoKC9odHRwcz86XFwvXFwvKHd3d1xcLik/Wy1hLXpBLVowLTlAOiUuX1xcK34jPV17MiwyNTZ9XFwuW2Etel17Miw0fVxcYihbLWEtekEtWjAtOUA6JV9cXCsufiM/Ly89XSopL2dpKVxuICAgICAgICAgIC5maWx0ZXIoKGl0bSwgaSwgYSkgPT4gaSA9PSBhLmluZGV4T2YoaXRtKSk7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdXJscy5sZW5ndGg7IGkrKylcbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICB1cmxzW2ldLm1hdGNoKFxuICAgICAgICAgICAgICAvLiooXFwucG5nfFxcLnN2Z3xcXC5qcGd8XFwuZ2lmfFxcLmpwZWd8XFwuYm1wfFxcLmljb3xcXC53ZWJwfFxcLnRpZnxcXC5hcG5nfFxcLmpmaWZ8XFwucGpwZWd8XFwucGpwKS4qL2ksXG4gICAgICAgICAgICApICE9IG51bGxcbiAgICAgICAgICApXG4gICAgICAgICAgICB0aGlzLmFkZEltZyhpbWFnZU1hbmFnZXIuaW1hZ2VUeXBlLkxJTkssIHVybHNbaV0sIDAsIDApO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjb25zb2xlLmxvZyhgZ2V0SW1hZ2VzIGVycm9yIHJldHJlaXZpbmcgaW1hZ2VzIGJ5IHVybDogJHtlfWApO1xuICAgICAgfVxuICAgICAgLy8gbW92ZSBwb3B1cCBpbnRvIGh0bWwgb2YgdGhlIHBhZ2VcbiAgICAgIC8qIGh0dHBzOi8vZ2l0aHViLmNvbS9taXRjaGFzL0tleWZyYW1lcy5hcHAvdHJlZS9tYXN0ZXIvS2V5ZnJhbWVzLmFwcCUyMChFeHRlbnNpb24pL2pzXG4gICAgJC5nZXQoY2hyb21lLmV4dGVuc2lvbi5nZXRVUkwoJ3BvcHVwLmh0bWwnKSwgZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgZGVidWdnZXI7XG4gICAgICAgICQoXCJib2R5XCIpLmFwcGVuZChkYXRhKTtcbiAgICB9KTtcbiAgICAqL1xuICAgICAgcmV0dXJuIHRoaXMuaW1nTGlzdDtcbiAgICB9LFxuICAgIGFkZEltZyhkLCBmLCBjLCBhKSB7XG4gICAgICB0aGlzLmltZ0xpc3QucHVzaCh7XG4gICAgICAgIHR5cGU6IGQsXG4gICAgICAgIHNyYzogZixcbiAgICAgICAgd2lkdGg6IGMsXG4gICAgICAgIGhlaWdodDogYSxcbiAgICAgIH0pO1xuICAgIH0sXG4gICAgZ2V0VW5pcXVlSW1hZ2VzU3JjcygpIHtcbiAgICAgIGNvbnN0IGltYWdlcyA9IGltYWdlTWFuYWdlci5nZXRJbWFnZXMoKTtcbiAgICAgIGNvbnN0IGltYWdlc1N0ckFycmF5ID0gbmV3IEFycmF5KCk7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGltYWdlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpbWFnZXNTdHJBcnJheVtpbWFnZXNTdHJBcnJheS5sZW5ndGhdID0gaW1hZ2VzW2ldLnNyYztcbiAgICAgIH1cbiAgICAgIGNvbnN0IHVuaXF1ZXMgPSBpbWFnZXNTdHJBcnJheVxuICAgICAgICAucmV2ZXJzZSgpXG4gICAgICAgIC5maWx0ZXIoKGUsIGksIGFycikgPT4gYXJyLmluZGV4T2YoZSwgaSArIDEpID09PSAtMSlcbiAgICAgICAgLnJldmVyc2UoKTtcbiAgICAgIHJldHVybiB1bmlxdWVzO1xuICAgIH0sXG4gICAgZGVlcENzcyh3aG8sIGNzcykge1xuICAgICAgaWYgKCF3aG8gfHwgIXdoby5zdHlsZSkgcmV0dXJuICcnO1xuICAgICAgY29uc3Qgc3R5ID0gY3NzLnJlcGxhY2UoL1xcLShbYS16XSkvZywgKGEsIGIpID0+IGIudG9VcHBlckNhc2UoKSk7XG4gICAgICBpZiAod2hvLmN1cnJlbnRTdHlsZSkge1xuICAgICAgICByZXR1cm4gd2hvLnN0eWxlW3N0eV0gfHwgd2hvLmN1cnJlbnRTdHlsZVtzdHldIHx8ICcnO1xuICAgICAgfVxuICAgICAgY29uc3QgZHYgPSBkb2N1bWVudC5kZWZhdWx0VmlldyB8fCB3aW5kb3c7XG4gICAgICByZXR1cm4gd2hvLnN0eWxlW3N0eV0gfHwgZHYuZ2V0Q29tcHV0ZWRTdHlsZSh3aG8sICcnKS5nZXRQcm9wZXJ0eVZhbHVlKGNzcykgfHwgJyc7XG4gICAgfSxcbiAgICBhcnJheUluZGV4T2YoYXJyYXksIHdoYXQsIGluZGV4KSB7XG4gICAgICBpbmRleCA9IGluZGV4IHx8IDA7XG4gICAgICBjb25zdCBMID0gYXJyYXkubGVuZ3RoO1xuICAgICAgd2hpbGUgKGluZGV4IDwgTCkge1xuICAgICAgICBpZiAoYXJyYXlbaW5kZXhdID09PSB3aGF0KSByZXR1cm4gaW5kZXg7XG4gICAgICAgICsraW5kZXg7XG4gICAgICB9XG4gICAgICByZXR1cm4gLTE7XG4gICAgfSxcbiAgICBxdWVyeVNlbGVjdG9yQWxsU2hhZG93cyhzZWxlY3RvciwgZWwgPSBkb2N1bWVudC5ib2R5KSB7XG4gICAgICAvLyByZWN1cnNlIG9uIGNoaWxkU2hhZG93c1xuICAgICAgY29uc3QgY2hpbGRTaGFkb3dzID0gQXJyYXkuZnJvbShlbC5xdWVyeVNlbGVjdG9yQWxsKCcqJykpXG4gICAgICAgIC5tYXAoZWwgPT4gZWwuc2hhZG93Um9vdClcbiAgICAgICAgLmZpbHRlcihCb29sZWFuKTtcblxuICAgICAgLy8gY29uc29sZS5sb2coJ1txdWVyeVNlbGVjdG9yQWxsU2hhZG93c10nLCBzZWxlY3RvciwgZWwsIGAoJHtjaGlsZFNoYWRvd3MubGVuZ3RofSBzaGFkb3dSb290cylgKTtcblxuICAgICAgY29uc3QgY2hpbGRSZXN1bHRzID0gY2hpbGRTaGFkb3dzLm1hcChjaGlsZCA9PiBpbWFnZU1hbmFnZXIucXVlcnlTZWxlY3RvckFsbFNoYWRvd3Moc2VsZWN0b3IsIGNoaWxkKSk7XG5cbiAgICAgIC8vIGZ1c2UgYWxsIHJlc3VsdHMgaW50byBzaW5ndWxhciwgZmxhdCBhcnJheVxuICAgICAgY29uc3QgcmVzdWx0ID0gQXJyYXkuZnJvbShlbC5xdWVyeVNlbGVjdG9yQWxsKHNlbGVjdG9yKSk7XG4gICAgICByZXR1cm4gcmVzdWx0LmNvbmNhdChjaGlsZFJlc3VsdHMpLmZsYXQoKTtcbiAgICB9LFxuICB9O1xuXG4gIGNvbnN0IHJlc3VsdCA9IHtcbiAgICBpbWFnZXM6IGltYWdlTWFuYWdlci5nZXRVbmlxdWVJbWFnZXNTcmNzKCksXG4gICAgdGl0bGU6IGRvY3VtZW50LnRpdGxlLFxuICAgIGlzVG9wOiB3aW5kb3cudG9wID09IHdpbmRvdy5zZWxmLFxuICAgIG9yaWdpbjogd2luZG93LmxvY2F0aW9uLm9yaWdpbixcbiAgfTtcblxuICB0cnkge1xuICAgIHJlc3VsdC5pc0FyYyA9IGdldENvbXB1dGVkU3R5bGUoZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50KS5nZXRQcm9wZXJ0eVZhbHVlKCctLWFyYy1wYWxldHRlLXRpdGxlJyk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICAvLyBlbXB0eSBzdHJpbmdcbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59KSgpO1xuIl0sIm5hbWVzIjpbXSwic291cmNlUm9vdCI6IiJ9