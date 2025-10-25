importJS(chrome.runtime.getURL("core/loader.js"));

function importJS(src) {
  var s, r, t;
  r = false;
  s = document.createElement("script");
  s.id = "agenty";
  s.type = "text/javascript";
  s.src = src;
  s.setAttribute("data-agenty-id", chrome.runtime.id);
  s.setAttribute("data-page-url", document.location.href);
  s.setAttribute(
    "data-viewport-width",
    Math.max(document.documentElement.clientWidth, window.innerWidth || 0)
  );
  s.setAttribute(
    "data-viewport-height",
    Math.max(document.documentElement.clientHeight, window.innerHeight || 0)
  );
  s.onload = s.onreadystatechange = function () {
    if (!r && (!this.readyState || this.readyState == "complete")) {
      r = true;
    }
  };
  var head = document.getElementsByTagName("head")[0];
  if (head) {
    head.appendChild(s);
  } else {
    document.body.appendChild(s);
  }
}
