(function () {
  "use strict";

  var STORAGE_KEY = "sk-notebook-posts";
  var config = window.BLOG || {};
  var base = config.baseurl || "";

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $all(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function uid() {
    return "p-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function slugify(value) {
    return String(value || "untitled")
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "untitled";
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
    if (/^(https?:|mailto:|#|\/)/i.test(trimmed)) return trimmed;
    return "#";
  }

  function markdownToHtml(markdown) {
    var fences = [];
    var text = String(markdown || "").replace(/\r\n/g, "\n");
    text = text.replace(/```([\w-]*)\n([\s\S]*?)```/g, function (_, lang, code) {
      var token = "@@FENCE" + fences.length + "@@";
      fences.push(
        "<pre><code class=\"language-" +
          escapeHtml(lang) +
          "\">" +
          escapeHtml(code.replace(/\n$/, "")) +
          "</code></pre>"
      );
      return token;
    });

    text = escapeHtml(text);

    text = text.replace(/^######\s+(.+)$/gm, "<h6>$1</h6>");
    text = text.replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>");
    text = text.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
    text = text.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
    text = text.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
    text = text.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");
    text = text.replace(/^&gt;\s+(.+)$/gm, "<blockquote>$1</blockquote>");
    text = text.replace(/^\s*[-*]{3,}\s*$/gm, "<hr>");
    text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
    text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    text = text.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
    text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function (_, alt, src) {
      return '<img alt="' + alt + '" src="' + escapeHtml(safeHref(src)) + '">';
    });
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, label, href) {
      return '<a href="' + escapeHtml(safeHref(href)) + '">' + label + "</a>";
    });

    var lines = text.split("\n");
    var html = [];
    var listType = null;

    function closeList() {
      if (listType) {
        html.push(listType === "ol" ? "</ol>" : "</ul>");
        listType = null;
      }
    }

    lines.forEach(function (line) {
      var unordered = line.match(/^[-*]\s+(.+)/);
      var ordered = line.match(/^\d+\.\s+(.+)/);
      if (unordered) {
        if (listType !== "ul") {
          closeList();
          html.push("<ul>");
          listType = "ul";
        }
        html.push("<li>" + unordered[1] + "</li>");
        return;
      }
      if (ordered) {
        if (listType !== "ol") {
          closeList();
          html.push("<ol>");
          listType = "ol";
        }
        html.push("<li>" + ordered[1] + "</li>");
        return;
      }
      closeList();
      if (!line.trim()) return;
      if (/^<(h[1-6]|blockquote|hr|pre)/.test(line)) {
        html.push(line);
        return;
      }
      html.push("<p>" + line + "</p>");
    });
    closeList();

    return html.join("\n").replace(/@@FENCE(\d+)@@/g, function (_, i) {
      return fences[Number(i)];
    });
  }

  function loadPosts() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch (err) {
      return [];
    }
  }

  function savePosts(posts) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
  }

  function parseTags(value) {
    return String(value || "")
      .split(",")
      .map(function (tag) { return tag.trim(); })
      .filter(Boolean);
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
    } catch (err) {
      return iso;
    }
  }

  function wordCount(text) {
    var words = String(text || "").trim().match(/\S+/g);
    return words ? words.length : 0;
  }

  function toast(message) {
    var el = $("[data-toast]");
    if (!el) return;
    el.hidden = false;
    el.textContent = message;
    el.classList.add("is-visible");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
      el.classList.remove("is-visible");
    }, 2600);
  }

  function jekyllMarkdown(post) {
    var date = new Date(post.updatedAt || post.createdAt || Date.now());
    var yyyy = date.getFullYear();
    var mm = String(date.getMonth() + 1).padStart(2, "0");
    var dd = String(date.getDate()).padStart(2, "0");
    var tags = (post.tags || []).map(function (tag) { return '"' + tag.replace(/"/g, "") + '"'; });
    return [
      "---",
      "layout: post",
      "title: " + JSON.stringify(post.title || "Untitled"),
      "date: " + yyyy + "-" + mm + "-" + dd + " " + date.toTimeString().slice(0, 8),
      post.excerpt ? "excerpt: " + JSON.stringify(post.excerpt) : null,
      tags.length ? "tags: [" + tags.join(", ") + "]" : null,
      "---",
      "",
      post.body || ""
    ].filter(function (line) { return line !== null; }).join("\n");
  }

  function filenameFor(post) {
    var date = new Date(post.updatedAt || post.createdAt || Date.now());
    var yyyy = date.getFullYear();
    var mm = String(date.getMonth() + 1).padStart(2, "0");
    var dd = String(date.getDate()).padStart(2, "0");
    return yyyy + "-" + mm + "-" + dd + "-" + slugify(post.title) + ".md";
  }

  function publicUrl(post) {
    if (post && post.publicUrl) return post.publicUrl;
    if (post && post.id) {
      return (config.url || window.location.origin) + base + "/preview/?id=" + encodeURIComponent(post.id);
    }
    return (config.url || window.location.origin) + base + "/";
  }

  function shareText(post) {
    var bits = [post.title || "A new note"];
    if (post.excerpt) bits.push(post.excerpt);
    bits.push(publicUrl(post));
    return bits.join("\n\n");
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    var area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    document.body.removeChild(area);
    return Promise.resolve();
  }

  function shareLinkedIn(post) {
    var url = "https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(publicUrl(post));
    copyText(shareText(post)).then(function () {
      toast("Caption copied. Opening LinkedIn…");
      window.open(url, "_blank", "noopener");
    });
  }

  function shareSubstack(post) {
    var manuscript = (post.title ? "# " + post.title + "\n\n" : "") + (post.body || "");
    copyText(manuscript).then(function () {
      toast("Post copied. Paste it into Substack.");
      window.open("https://substack.com/publish", "_blank", "noopener");
    });
  }

  function downloadMarkdown(post) {
    var blob = new Blob([jekyllMarkdown(post)], { type: "text/markdown;charset=utf-8" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filenameFor(post);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    toast("Downloaded " + filenameFor(post));
  }

  function collectForm(root) {
    return {
      title: ($("[data-title]", root).value || "").trim(),
      excerpt: ($("[data-excerpt]", root).value || "").trim(),
      tags: parseTags($("[data-tags]", root).value),
      body: $("[data-body]", root).value || ""
    };
  }

  function fillForm(root, post) {
    $("[data-title]", root).value = post.title || "";
    $("[data-excerpt]", root).value = post.excerpt || "";
    $("[data-tags]", root).value = (post.tags || []).join(", ");
    $("[data-body]", root).value = post.body || "";
  }

  function upsertPost(next) {
    var posts = loadPosts();
    var index = posts.findIndex(function (post) { return post.id === next.id; });
    if (index >= 0) posts[index] = next;
    else posts.unshift(next);
    savePosts(posts);
    return next;
  }

  function renderPreview(root) {
    var pane = $("[data-preview]", root);
    var count = $("[data-word-count]", root);
    var data = collectForm(root);
    if (!data.body.trim() && !data.title) {
      pane.innerHTML = '<p class="empty-state">The preview will appear here.</p>';
    } else {
      pane.innerHTML =
        (data.title ? "<h1>" + escapeHtml(data.title) + "</h1>" : "") +
        markdownToHtml(data.body);
    }
    if (count) count.textContent = wordCount(data.body) + " words";
  }

  function renderDraftList(root, currentId) {
    var list = $("[data-draft-list]", root);
    var posts = loadPosts();
    if (!posts.length) {
      list.innerHTML = '<li class="empty-state">No drafts yet.</li>';
      return;
    }
    list.innerHTML = posts.map(function (post) {
      var active = post.id === currentId ? " style=\"font-weight:600\"" : "";
      return (
        '<li class="draft-item">' +
          '<button type="button" data-load-id="' + escapeHtml(post.id) + '"' + active + ">" +
            escapeHtml(post.title || "Untitled") +
          "</button>" +
          "<small>" +
            (post.status === "published" ? "Published locally" : "Draft") +
            " · " + formatDate(post.updatedAt) +
          "</small>" +
        "</li>"
      );
    }).join("");
  }

  function ledgerRow(post) {
    var tags = (post.tags || []).map(function (tag) {
      return '<span class="tag">' + escapeHtml(tag) + "</span>";
    }).join("");
    var href = base + "/preview/?id=" + encodeURIComponent(post.id);
    return (
      '<article class="ledger-row" data-local-row>' +
        '<time class="ledger-date">' + formatDate(post.updatedAt) + "</time>" +
        '<div class="ledger-body">' +
          '<h3 class="ledger-title"><a href="' + href + '">' + escapeHtml(post.title || "Untitled") + "</a></h3>" +
          (post.excerpt ? '<p class="ledger-excerpt">' + escapeHtml(post.excerpt) + "</p>" : "") +
          '<div class="ledger-meta">' +
            '<span class="badge">' + (post.status === "published" ? "Local" : "Draft") + "</span>" +
            tags +
            '<a class="read-more" href="' + href + '">Read note</a>' +
          "</div>" +
        "</div>" +
      "</article>"
    );
  }

  function initWriter() {
    var root = $("[data-writer]");
    if (!root) return;

    var currentId = new URLSearchParams(window.location.search).get("id") || uid();
    var existing = loadPosts().filter(function (post) { return post.id === currentId; })[0];
    if (existing) fillForm(root, existing);
    else currentId = uid();

    function snapshot(status) {
      var data = collectForm(root);
      if (!data.title && !data.body.trim()) {
        toast("Add a title or some text first.");
        return null;
      }
      var prior = loadPosts().filter(function (post) { return post.id === currentId; })[0] || {};
      return upsertPost({
        id: currentId,
        title: data.title || "Untitled",
        excerpt: data.excerpt,
        tags: data.tags,
        body: data.body,
        status: status || prior.status || "draft",
        createdAt: prior.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    root.addEventListener("input", function () {
      renderPreview(root);
    });

    $("[data-save-draft]", root).addEventListener("click", function () {
      var post = snapshot("draft");
      if (!post) return;
      renderDraftList(root, currentId);
      toast("Draft saved in this browser.");
    });

    $("[data-publish]", root).addEventListener("click", function () {
      var post = snapshot("published");
      if (!post) return;
      renderDraftList(root, currentId);
      toast("Published locally. It now appears in All posts.");
    });

    $("[data-download]", root).addEventListener("click", function () {
      var post = snapshot();
      if (!post) return;
      downloadMarkdown(post);
    });

    $("[data-new-post]", root).addEventListener("click", function () {
      currentId = uid();
      fillForm(root, { title: "", excerpt: "", tags: [], body: "" });
      renderPreview(root);
      renderDraftList(root, null);
      history.replaceState({}, "", base + "/write/");
    });

    var githubBtn = $("[data-open-github]", root);
    if (githubBtn) {
      githubBtn.addEventListener("click", function () {
        var post = snapshot();
        if (!post) return;
        copyText(jekyllMarkdown(post)).then(function () {
          toast("Markdown copied. Opening GitHub…");
          var repo = config.githubRepo || "Shounak710/Shounak710.github.io";
          var branch = config.githubBranch || "master";
          window.open(
            "https://github.com/" + repo + "/new/" + branch + "/_posts?filename=" + encodeURIComponent(filenameFor(post)),
            "_blank",
            "noopener"
          );
        });
      });
    }

    var modal = $("[data-share-modal]");
    $("[data-open-share]", root).addEventListener("click", function () {
      var post = snapshot();
      if (!post) return;
      modal.classList.add("is-open");
    });
    $("[data-close-share]", modal).addEventListener("click", function () {
      modal.classList.remove("is-open");
    });
    modal.addEventListener("click", function (event) {
      if (event.target === modal) modal.classList.remove("is-open");
    });
    $("[data-share-linkedin]", modal).addEventListener("click", function () {
      shareLinkedIn(snapshot() || { title: "Notebook" });
    });
    $("[data-share-substack]", modal).addEventListener("click", function () {
      shareSubstack(snapshot() || { title: "Notebook", body: "" });
    });
    $("[data-share-copy]", modal).addEventListener("click", function () {
      var post = snapshot();
      if (!post) return;
      copyText(jekyllMarkdown(post)).then(function () {
        toast("Markdown copied.");
      });
    });

    root.addEventListener("click", function (event) {
      var button = event.target.closest("[data-load-id]");
      if (!button) return;
      var post = loadPosts().filter(function (item) { return item.id === button.getAttribute("data-load-id"); })[0];
      if (!post) return;
      currentId = post.id;
      fillForm(root, post);
      renderPreview(root);
      renderDraftList(root, currentId);
      history.replaceState({}, "", base + "/write/?id=" + encodeURIComponent(currentId));
    });

    renderPreview(root);
    renderDraftList(root, existing ? currentId : null);
  }

  function initLedger() {
    var ledger = $("[data-post-ledger]") || $("#home-ledger");
    if (!ledger) return;
    var local = loadPosts().filter(function (post) {
      return ledger.id === "home-ledger" ? post.status === "published" : true;
    });
    if (!local.length) return;
    var empty = $("[data-empty-published]", ledger);
    if (empty) empty.remove();
    var html = local.map(ledgerRow).join("");
    ledger.insertAdjacentHTML("afterbegin", html);
  }

  function initPreview() {
    var root = $("[data-local-preview]");
    if (!root) return;
    var id = new URLSearchParams(window.location.search).get("id");
    var post = loadPosts().filter(function (item) { return item.id === id; })[0];
    if (!post) {
      $("[data-preview-title]", root).textContent = "Note not found";
      $("[data-preview-body]", root).innerHTML =
        '<p>This local note is not in this browser. <a href="' + base + '/write/">Write a new one</a>.</p>';
      return;
    }
    document.title = post.title + " – " + (config.name || "Notebook");
    $("[data-preview-title]", root).textContent = post.title || "Untitled";
    $("[data-preview-date]", root).textContent = formatDate(post.updatedAt);
    $("[data-preview-tags]", root).innerHTML = (post.tags || []).map(function (tag) {
      return '<span class="tag">' + escapeHtml(tag) + "</span>";
    }).join(" ");
    $("[data-preview-body]", root).innerHTML = markdownToHtml(post.body);
    var edit = $("[data-edit-link]", root);
    if (edit) edit.href = base + "/write/?id=" + encodeURIComponent(post.id);
    $("[data-share-linkedin]", root).addEventListener("click", function () { shareLinkedIn(post); });
    $("[data-share-substack]", root).addEventListener("click", function () { shareSubstack(post); });
  }

  function initShareBars() {
    $all("[data-share]").forEach(function (bar) {
      var post = {
        title: bar.getAttribute("data-title") || document.title,
        excerpt: bar.getAttribute("data-excerpt") || "",
        body: "",
        publicUrl: bar.getAttribute("data-url")
      };
      var linkedin = $("[data-share-linkedin]", bar);
      var substack = $("[data-share-substack]", bar);
      var copy = $("[data-share-copy]", bar);
      if (linkedin) linkedin.addEventListener("click", function () { shareLinkedIn(post); });
      if (substack) {
        substack.addEventListener("click", function () {
          copyText(shareText(post)).then(function () {
            toast("Link copied. Opening Substack…");
            window.open("https://substack.com/publish", "_blank", "noopener");
          });
        });
      }
      if (copy) {
        copy.addEventListener("click", function () {
          copyText(post.publicUrl || window.location.href).then(function () {
            toast("Link copied.");
          });
        });
      }
    });
  }

  initWriter();
  initLedger();
  initPreview();
  initShareBars();
})();
