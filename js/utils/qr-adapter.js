/**
 * Routes the app's generateQRCodeSVG() calls through the proven
 * qrcode-generator library (js/vendor/qrcode.js, MIT, Kazuhiko Arase).
 * The older in-house encoder produced codes phones could not scan.
 */
(function (global) {
  "use strict";
  if (typeof global.qrcode !== "function") return;
  global.generateQRCodeSVG = function (text, size, fgColor, bgColor) {
    size = size || 200;
    var fg = fgColor || "#14233F";
    var bg = bgColor || "#FFFFFF";
    try {
      var qr = global.qrcode(0, "M");
      qr.addData(String(text || ""));
      qr.make();
      var n = qr.getModuleCount();
      var margin = 2;
      var total = n + margin * 2;
      var parts = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size +
        '" viewBox="0 0 ' + total + " " + total + '" shape-rendering="crispEdges">',
        '<rect width="' + total + '" height="' + total + '" fill="' + bg + '"/>',
        '<path fill="' + fg + '" d="'
      ];
      for (var r = 0; r < n; r++) {
        for (var c = 0; c < n; c++) {
          if (qr.isDark(r, c)) parts.push("M" + (c + margin) + " " + (r + margin) + "h1v1h-1z");
        }
      }
      parts.push('"/></svg>');
      return parts.join("");
    } catch (e) {
      return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 100 100"><rect width="100" height="100" fill="#f0f0f0"/></svg>';
    }
  };
})(window);
