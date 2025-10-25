function importJS(src, callback) {
  var s, r, t;
  r = false;
  s = document.createElement("script");
  s.type = "text/javascript";
  s.src = src;
  s.onload = s.onreadystatechange = function () {
    if (!r && (!this.readyState || this.readyState == "complete")) {
      r = true;
      callback();
    }
  };
  var head = document.getElementsByTagName("head")[0];
  if (head) {
    head.appendChild(s);
  } else {
    document.body.appendChild(s);
  }
}

function importCSS(href) {
  var s = document.createElement("link");
  s.setAttribute("rel", "stylesheet");
  s.setAttribute("type", "text/css");
  s.setAttribute("media", "screen");
  s.setAttribute("href", href);
  var head = document.getElementsByTagName("head")[0];
  if (head) {
    head.appendChild(s);
  } else {
    document.body.appendChild(s);
  }
}

var script =
  document.currentScript ||
  (function () {
    var scripts = document.getElementById("agenty");
    return scripts;
  })();

var baseUrl =
  "chrome-extension://" + script.getAttribute("data-agenty-id") + "/core/";

var load = function () {
  importCSS(baseUrl + "selectorgadget/selectorgadget.css");
  importCSS(baseUrl + "agenty-chrome.css");
  importJS(baseUrl + "jquery.min.js", function () {
    window.jQuerySG = jQuery.noConflict();
    importJS(baseUrl + "diff_match_patch.js", function () {
      importJS(baseUrl + "selectorgadget/dom.js", function () {
        importJS(baseUrl + "selectorgadget/core.js", function () {
          importJS(baseUrl + "agenty-chrome.js", function () {
            window.jQuerySG(".selector_gadget_loading").remove();
            agentyChrome.enable(baseUrl + "agenty-iframe.html");
          });
        });
      });
    });
  });
};

try {
  load();
} catch (err) {
  console.log(
    "Agenty failed to load, error :: " +
      err.message +
      ". See the help documentation https://agenty.com/docs/"
  );
}
