(function () {
  "use strict";

  var SITE = window.SITE || {};

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function safeHref(href) {
    var trimmed = String(href || "").trim();
    return /^(https?:|mailto:|#|\/)/i.test(trimmed) ? trimmed : "#";
  }

  function markdownToHtml(markdown) {
    var fences = [];
    var text = String(markdown || "").replace(/\r\n/g, "\n");
    text = text.replace(/```([\w-]*)\n([\s\S]*?)```/g, function (_, lang, code) {
      var token = "@@FENCE" + fences.length + "@@";
      fences.push(
        "<pre><code>" + escapeHtml(code.replace(/\n$/, "")) + "</code></pre>"
      );
      return token;
    });
    text = escapeHtml(text);
    text = text.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
    text = text.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
    text = text.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");
    text = text.replace(/^&gt;\s+(.+)$/gm, "<blockquote>$1</blockquote>");
    text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
    text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, label, href) {
      return '<a href="' + escapeHtml(safeHref(href)) + '">' + label + "</a>";
    });
    var lines = text.split("\n");
    var html = [];
    var list = false;
    lines.forEach(function (line) {
      var item = line.match(/^[-*]\s+(.+)/);
      if (item) {
        if (!list) {
          html.push("<ul>");
          list = true;
        }
        html.push("<li>" + item[1] + "</li>");
        return;
      }
      if (list) {
        html.push("</ul>");
        list = false;
      }
      if (!line.trim()) return;
      if (/^<(h[1-3]|blockquote|pre)/.test(line)) html.push(line);
      else html.push("<p>" + line + "</p>");
    });
    if (list) html.push("</ul>");
    return html.join("\n").replace(/@@FENCE(\d+)@@/g, function (_, i) {
      return fences[Number(i)];
    });
  }

  function formatDate(iso) {
    try {
      return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
    } catch (err) {
      return iso;
    }
  }

  function query() {
    return new URLSearchParams(window.location.search);
  }

  function categoryName(categories, slug) {
    var match = (categories || []).filter(function (cat) {
      return cat.slug === slug;
    })[0];
    return match ? match.name : slug;
  }

  function loadData() {
    return Promise.all([
      fetch("/data/posts.json", { cache: "no-store" }).then(function (res) {
        if (!res.ok) throw new Error("Could not load posts");
        return res.json();
      }),
      fetch("/data/categories.json", { cache: "no-store" }).then(function (res) {
        if (!res.ok) throw new Error("Could not load categories");
        return res.json();
      })
    ]).then(function (pair) {
      return {
        posts: (pair[0].posts || []).slice().sort(function (a, b) {
          return a.date < b.date ? 1 : -1;
        }),
        categories: pair[1].categories || []
      };
    });
  }

  function postHref(slug) {
    return "/post/?slug=" + encodeURIComponent(slug);
  }

  function renderPostCard(post, categories) {
    var tags = (post.tags || []).map(function (tag) {
      return '<a class="chip" href="/blog/?tag=' + encodeURIComponent(tag) + '">' +
        escapeHtml(tag) + "</a>";
    }).join("");
    return (
      '<article class="post-card">' +
        '<div class="post-date">' + formatDate(post.date) + "</div>" +
        "<div>" +
          '<h3 class="post-title"><a href="' + postHref(post.slug) + '">' + escapeHtml(post.title) + "</a></h3>" +
          (post.excerpt ? '<p class="post-excerpt">' + escapeHtml(post.excerpt) + "</p>" : "") +
          '<div class="meta-row">' +
            '<a class="chip chip-tag" href="/blog/?category=' + encodeURIComponent(post.category) + '">' +
              escapeHtml(categoryName(categories, post.category)) +
            "</a>" +
            tags +
          "</div>" +
        "</div>" +
      "</article>"
    );
  }

  function setYear() {
    var el = qs("[data-year]");
    if (el) el.textContent = String(new Date().getFullYear());
  }

  var THEME_KEY = "sk-theme";

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  }

  function syncThemeToggle() {
    var theme = currentTheme();
    qsa("[data-theme-toggle]").forEach(function (btn) {
      var next = theme === "dark" ? "light" : "dark";
      btn.setAttribute("aria-label", "Switch to " + next + " theme");
      btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
      var label = qs("[data-theme-label]", btn);
      if (label) label.textContent = theme === "dark" ? "Dark" : "Light";
    });
  }

  function applyTheme(theme) {
    var next = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem(THEME_KEY, next); } catch (err) {}
    syncThemeToggle();
  }

  function initTheme() {
    var stored = null;
    try { stored = localStorage.getItem(THEME_KEY); } catch (err) {}
    if (stored !== "light" && stored !== "dark") {
      stored = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
    }
    applyTheme(stored);
    qsa("[data-theme-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        applyTheme(currentTheme() === "dark" ? "light" : "dark");
      });
    });
  }

  window.Blog = {
    SITE: SITE,
    qs: qs,
    qsa: qsa,
    escapeHtml: escapeHtml,
    markdownToHtml: markdownToHtml,
    formatDate: formatDate,
    query: query,
    categoryName: categoryName,
    loadData: loadData,
    postHref: postHref,
    renderPostCard: renderPostCard,
    setYear: setYear
  };

  setYear();
  initTheme();
})();
