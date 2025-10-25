var agentyChrome;

window.agentyChrome = agentyChrome = (function (window, $, SelectorGadget) {
  function agentyChrome() {}

  agentyChrome.selectorGadget = null;

  agentyChrome.customCss = null;

  agentyChrome.updateCssFieldInterval = null;

  agentyChrome.offsetBeforeHighlight = 0;

  agentyChrome.enable = function (iframeUrl) {
    var self = this;
    if (!window.agentySidebar) {
      this.iframe = $("<iframe>")
        .attr("id", "agentychrome")
        .attr("class", "selectorgadget_ignore")
        .attr("src", iframeUrl)
        .attr("allowtransparency", true)
        .appendTo("body");
      this.highlightFrame = $("<div>")
        .attr("class", "agentychrome_highlight")
        .hide()
        .appendTo("body");
      this.overlay = $("<div>")
        .attr("class", "agentychrome_overlay")
        .appendTo("body");
      this.extract = "HTML";
      this.attribute = "";
      this.boundIframeListener = function (e) {
        self.iframeListener.call(self, e);
      };
      window.addEventListener("message", this.boundIframeListener, false);
      window.agentySidebar = this;
    }
  };

  agentyChrome.disable = function () {
    this.disableSelectorGadget();
    if (window.agentySidebar) {
      window.removeEventListener("message", this.boundIframeListener, false);
      this.iframe.remove();
      this.highlightFrame.remove();
      this.overlay.remove();
      window.agentySidebar = null;
    }
  };

  agentyChrome.iframeListener = function (e) {
    var methodParts = e.data[0].split("agenty_");
    if (methodParts[0] == "") {
      e.data.splice(0, 1);
      this[methodParts[1]].apply(this, e.data);
    }
  };

  agentyChrome.enableSelectorGadget = function (selector, extract, attribute) {
    this.extract = extract;
    this.attribute = attribute;
    var self = this;
    this.disableSelectorGadget();
    if (!this.selectorGadget) {
      this.overlay.show().animate({ opacity: 0 }, 1000, function () {
        $(this).hide();
      });
      SelectorGadget.toggle();
      this.selectorGadget = window.selector_gadget;
      this.selectorGadget.sg_div.attr("style", "display: none !important");
      $(".selectorgadget_iframe_info").hide();
      this.enableUpdatingCssField();
    }
  };

  agentyChrome.disableSelectorGadget = function () {
    // remove custom selection
    this.disableUpdatingCssField();
    this.customCss = null;
    $(".agentychrome_selected").removeClass("agentychrome_selected");
    if (this.selectorGadget) {
      SelectorGadget.toggle();
      this.selectorGadget = null;
    }
  };

  agentyChrome.enableUpdatingCssField = function () {
    var self = this;
    this.disableUpdatingCssField();
    this.updateCssFieldInterval = setInterval(function () {
      self.updateCssAndResults();
    }, 200);
  };

  agentyChrome.disableUpdatingCssField = function () {
    if (this.updateCssFieldInterval !== null) {
      clearInterval(this.updateCssFieldInterval);
      this.updateCssFieldInterval = null;
    }
  };

  agentyChrome.updateCssAndResults = function () {
    var self = this;
    if (
      this.selectorGadget === null &&
      (this.customCss === null || this.customCss === "")
    ) {
      return;
    }
    var css = this.customCss;
    if (
      this.selectorGadget != null &&
      $(this.selectorGadget) != null &&
      $(this.selectorGadget.path_output_field) != null
    ) {
      css = $(this.selectorGadget.path_output_field).val();
    }

    var ignored = ".selectorgadget_ignore";
    var results = [];
    var xpaths = [];
    if (css != "No valid path found.") {
      $(css)
        .not(ignored)
        .each(function () {
          if (self.customCss) {
            $(this).addClass("agentychrome_selected");
          }
          var cleaned = self.cleanElement(this);
          switch (self.extract) {
            case "HTML":
              results.push(cleaned.get(0).outerHTML || "(empty)");
              break;
            case "TEXT":
              results.push(cleaned.text() || "(empty)");
              break;
            case "ATTR":
              results.push(
                (self.attribute ? cleaned.attr(self.attribute) : null) ||
                  "(empty)"
              );
          }
          // we are using xpaths here, because we can not pass elements
          // to highlight into the iframe
          xpaths.push(self.getXPath(this));
        });
    }
    self.iframe
      .get(0)
      .contentWindow.postMessage(
        ["agenty_updateCssAndResults", css, results, xpaths],
        "*"
      );
  };

  agentyChrome.updateSourceURL = function () {
    var self = this;
    var source = [];
    source.push(script.getAttribute("data-page-url"));
    source.push(script.getAttribute("data-viewport-width"));
    source.push(script.getAttribute("data-viewport-height"));

    self.iframe.get(0).contentWindow.postMessage(["source_url", source], "*");
  };

  agentyChrome.cleanElement = function (element) {
    var clone = $(element).clone();
    var elementsToClean = clone.add(clone.find("*"));
    elementsToClean.each(function () {
      if (typeof $(this).attr("class") === "string") {
        $(this).removeClass(
          "selectorgadget_rejected " +
            "selectorgadget_suggested selectorgadget_selected " +
            "agentychrome_highlight agentychrome_selected"
        );
      }
    });
    return clone;
  };

  agentyChrome.selectCustom = function (selector, extract, attribute) {
    var self = this;
    this.disableSelectorGadget();
    this.customCss = selector;
    this.extract = extract;
    this.attribute = attribute;
    this.enableUpdatingCssField();
  };

  agentyChrome.getXPath = function (element) {
    var xpath = "";
    for (; element && element.nodeType == 1; element = element.parentNode) {
      var id =
        $(element.parentNode).children(element.tagName).index(element) + 1;
      id = "[" + id + "]";
      xpath = "/" + element.tagName.toLowerCase() + id + xpath;
    }
    return xpath;
  };

  agentyChrome.highlight = function (xpath) {
    // it won't work in IE, but jQuery not seems to support indexed xpaths
    element = $(
      document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE
      ).singleNodeValue
    );
    offset = element.offset();
    this.highlightFrame.show().css({
      left: offset.left - 2,
      top: offset.top - 2,
      width: element.width(),
      height: element.height(),
    });
    this.offsetBeforeHighlight = $("body").scrollTop();
    $("body").scrollTop(offset.top - 100);
  };

  agentyChrome.unhighlight = function () {
    this.highlightFrame.hide();
    $("body").scrollTop(this.offsetBeforeHighlight);
  };

  agentyChrome.togglePosition = function () {
    this.iframe.toggleClass("left");
  };

  agentyChrome.toggleiFramefullWidth = function () {
    this.iframe.toggleClass("fullWidth");
  };

  agentyChrome.updateLeafAndAttr = function (extract, attribute) {
    this.extract = extract;
    this.attribute = attribute;
  };
  return agentyChrome;
})(window, jQuerySG, SelectorGadget);
