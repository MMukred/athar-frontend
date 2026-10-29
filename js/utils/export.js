/**
 * Export Utility for Athar
 * - UTF-8 BOM (for Arabic Excel compatibility)
 * - RFC 4180 compliant escaping
 * - CSV / Formula Injection protection (OWASP)
 * - Printable views
 */

window.ExportUtil = (function () {
  "use strict";

  // Characters that trigger formula interpretation in Excel / Sheets / LibreOffice
  const DANGEROUS_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

  /**
   * Neutralize a CSV cell against formula injection.
   * Strategy:
   * 1. Coerce to string.
   * 2. Strip control characters that break CSV parsers.
   * 3. If the first non-whitespace character is dangerous, prefix with a single quote.
   * 4. Escape embedded double-quotes by doubling them (RFC 4180).
   * 5. Wrap in double quotes.
   */
  function sanitizeCell(value) {
    if (value === null || value === undefined) return '""';

    let str = String(value);

    // Remove null bytes and non-printable control chars (except \n and \t which we handle below)
    str = str.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

    // Detect dangerous leading char (allow leading spaces before check)
    const trimmedStart = str.replace(/^[ \u00A0]+/, "");
    if (trimmedStart.length > 0 && DANGEROUS_PREFIXES.includes(trimmedStart[0])) {
      str = "'" + str;
    }

    // RFC 4180: escape double-quotes by doubling them
    str = str.replace(/"/g, '""');

    return '"' + str + '"';
  }

  /**
   * Download an array of rows as a CSV file.
   * @param {string} filename
   * @param {string[]} headers
   * @param {Array<Array<any>>} rows
   */
  function downloadCSV(filename, headers, rows) {
    if (!rows || !rows.length) {
      if (window.AtharApp && window.AtharApp.showToast) {
        window.AtharApp.showToast("No data available to export.", "warning");
      } else {
        alert("No data available to export.");
      }
      return;
    }

    // UTF-8 BOM so Excel renders Arabic correctly
    let csvContent = "\uFEFF";

    // Header row (also sanitized — in case a column name ever contains a formula char)
    csvContent += (headers || []).map(sanitizeCell).join(",") + "\r\n";

    // Data rows
    rows.forEach(function (row) {
      const line = (row || []).map(sanitizeCell).join(",");
      csvContent += line + "\r\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename.endsWith(".csv") ? filename : filename + ".csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Free the blob URL
    setTimeout(() => URL.revokeObjectURL(url), 500);

    // Toast feedback confirmation
    if (window.AtharApp && window.AtharApp.showToast) {
      window.AtharApp.showToast("Export ready: " + (filename.endsWith(".csv") ? filename : filename + ".csv"), "success");
    }
  }

  /**
   * Download a text file (e.g. .ics calendar invites).
   * @param {string} filename
   * @param {string} content
   * @param {string} mime
   */
  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 500);
    if (window.AtharApp && window.AtharApp.showToast) {
      window.AtharApp.showToast("Downloaded: " + filename, "success");
    }
  }

  /**
   * Open a print-friendly window for a DOM element.
   */
  function printElement(elementId, title) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      window.print();
      return;
    }

    const isRTL = document.documentElement.getAttribute("dir") === "rtl";
    const lang = document.documentElement.getAttribute("lang") || "en";
    const cssUrl = new URL("css/style.css", window.location.href).href;
    const rtlCssUrl = new URL("css/rtl.css", window.location.href).href;

    printWindow.document.write(`
<!DOCTYPE html>
<html lang="${lang}" dir="${isRTL ? "rtl" : "ltr"}">
<head>
  <meta charset="utf-8">
  <title>${title || "Athar Export"}</title>
  <link rel="stylesheet" href="${cssUrl}">
  <link rel="stylesheet" href="${rtlCssUrl}">
  <style>
    body { background: white !important; padding: 24px !important; color: #111 !important; }
    .no-print, button, .btn { display: none !important; }
    .card, .table-container { box-shadow: none !important; border: 1px solid #ddd !important; }
    @page { size: auto; margin: 15mm; }
  </style>
</head>
<body>
  <div class="print-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #1F6FEB; padding-bottom:12px; margin-bottom:24px;">
    <div>
      <h1 style="margin:0; font-size:20px; color:#1F6FEB;">${document.querySelector(".org-name-text")?.textContent || "Athar Volunteer Management"}</h1>
      <p style="margin:4px 0 0; color:#555; font-size:13px;">${title || ""} &bull; ${new Date().toLocaleDateString()}</p>
    </div>
    <div style="font-weight:700; color:#2DA44E; font-size:18px;">أثر &bull; Athar</div>
  </div>
  ${element.outerHTML}
  <script>
    setTimeout(function() { window.print(); window.close(); }, 400);
  </script>
</body>
</html>
    `);
    printWindow.document.close();
  }

  return {
    downloadCSV: downloadCSV,
    downloadFile: downloadFile,
    printElement: printElement,
    // Exposed for testing
    _sanitizeCell: sanitizeCell
  };
})();
