"use strict";
const urlCache = [];

window.updatePanel = (req) => {
  const url = req.url || req.request.url;

  // Keep cache to avoid duplicates
  if (urlCache.indexOf(url) > -1) return;
  urlCache.push(url);

  let mime = "";
  let status = 0;
  let size = 0;
  let time = 0;

  const id = "chk" + +new Date() * Math.random();
  if (req.response) {
    mime = req.response.content.mimeType;
    status = req.response.status;
    size = req.response.content.size;
    time = req.time;
  } else if (req.type) {
    mime = req.type;
  }
  const preview = mime.match(/^image|img/)
    ? '<img alt="" src="' + url + '">'
    : "";

  const html =
    '<tr id="tr' +
    id +
    '">' +
    '<td class="check"><input type="checkbox" id="' +
    id +
    '" value="' +
    url +
    '"></td>' +
    "<td>" +
    preview +
    "</td>" +
    '<td class="url">' +
    url +
    "</td>" +
    "<td>" +
    mime +
    "</td>" +
    "<td>" +
    status +
    "</td>" +
    "<td>" +
    formatBytes(size) +
    "</td>" +
    "<td>" +
    formatTime(time) +
    "</td>" +
    "</tr>";

  $("#tools").find("tbody").append(html);
};

$(() => {
  // TABLE

  const $tools = $("#tools");

  new Tablesort($tools[0]);

  $tools

    .on("click", "input[type=checkbox]", (event) => {
      event.stopPropagation();
    })

    // Check td
    .on("click", "td", (event) => {
      const checkbox = $(event.target)
        .parent()
        .find("input[type=checkbox]:first");
      checkbox.prop("checked", !checkbox.prop("checked"));
    })

    .on("click", "#checkall", () =>
      // Check all
      $tools
        .find("tbody input[type=checkbox]:visible")
        .prop("checked", !!$("#checkall:checked").length)
    );

  // FOOTER
  $("#dl-button")
    .on("click", "#btn", () =>
      // Click on Download
      Promise.all(
        $("input[type=checkbox]:checked")
          .toArray()
          .map((input) => $(input).val())
          .map((url) => chrome.runtime.sendMessage({ download: url }))
      ).catch((err) => console.error(err))
    )

    .on("input", "#filter", (event) => {
      // Type in Filter
      const $trs = $tools.find("tbody tr");
      return "" === event.target.value
        ? $trs.show()
        : $trs
            .hide()
            .parent()
            .find('tr:contains("' + event.target.value + '")')
            .show();
    });

  $("#filter").focus();
});

const formatBytes = (bytes, decimals) => {
  if (bytes === 0) return "0 B";
  const k = 1000,
    dm = decimals + 1 || 3,
    sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"],
    i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

const formatTime = (time) => parseFloat(time).toFixed(2);
