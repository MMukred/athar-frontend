/**
 * JSON Diff viewer utility for Athar Audit Log
 * Renders beautiful visual before-and-after diffs
 */

window.DiffViewer = {
  renderDiff: function (oldVal, newVal) {
    if (!oldVal && !newVal) {
      return '<div class="diff-empty">No change details available</div>';
    }

    var oldObj = typeof oldVal === "string" ? this.safeParse(oldVal) : (oldVal || {});
    var newObj = typeof newVal === "string" ? this.safeParse(newVal) : (newVal || {});

    var allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));
    if (allKeys.length === 0) {
      return '<div class="diff-empty">No structural field differences</div>';
    }

    var html = '<div class="diff-table-wrapper"><table class="diff-table"><thead><tr><th>Field</th><th>Previous State</th><th>New State</th><th>Change</th></tr></thead><tbody>';

    allKeys.forEach(function (k) {
      var vOld = oldObj[k];
      var vNew = newObj[k];
      var oldStr = vOld !== undefined ? (typeof vOld === 'object' ? JSON.stringify(vOld, null, 1) : String(vOld)) : '—';
      var newStr = vNew !== undefined ? (typeof vNew === 'object' ? JSON.stringify(vNew, null, 1) : String(vNew)) : '—';

      var type = 'unchanged';
      var badge = '<span class="badge badge-neutral">Unchanged</span>';
      if (vOld === undefined && vNew !== undefined) {
        type = 'added';
        badge = '<span class="badge badge-success">+ Added</span>';
      } else if (vOld !== undefined && vNew === undefined) {
        type = 'removed';
        badge = '<span class="badge badge-danger">- Removed</span>';
      } else if (JSON.stringify(vOld) !== JSON.stringify(vNew)) {
        type = 'modified';
        badge = '<span class="badge badge-warning">~ Modified</span>';
      }

      html += `<tr class="diff-row diff-${type}">
        <td class="diff-key"><code>${DiffViewer.escapeHtml(k)}</code></td>
        <td class="diff-val diff-val-old">${DiffViewer.escapeHtml(oldStr)}</td>
        <td class="diff-val diff-val-new">${DiffViewer.escapeHtml(newStr)}</td>
        <td class="diff-badge">${badge}</td>
      </tr>`;
    });

    html += '</tbody></table></div>';
    return html;
  },

  safeParse: function (str) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return { raw: str };
    }
  },

  escapeHtml: function (unsafe) {
    if (unsafe == null) return '';
    return String(unsafe)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};
