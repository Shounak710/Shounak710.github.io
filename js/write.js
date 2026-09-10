(function () {
  "use strict";

  var Blog = window.Blog;
  if (!Blog) return;
  var SITE = Blog.SITE;
  var qs = Blog.qs;

  var TOKEN_KEY = "sk-gh-token";
  var API = "https://api.github.com";
  var categoriesDirty = false;

  function encodeContent(text) {
    var bytes = new TextEncoder().encode(text);
    var binary = "";
    bytes.forEach(function (b) { binary += String.fromCharCode(b); });
    return btoa(binary);
  }

  function decodeContent(b64) {
    var binary = atob(b64);
    var bytes = Uint8Array.from(binary, function (c) { return c.charCodeAt(0); });
    return new TextDecoder().decode(bytes);
  }

  function slugify(value) {
    return String(value || "untitled")
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "untitled";
  }

  function notice(type, message) {
    var el = qs("[data-notice]");
    el.className = "notice " + (type || "");
    el.textContent = message;
    el.hidden = !message;
  }

  function headers(token) {
    return {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28"
    };
  }

  function githubUser(token) {
    return fetch(API + "/user", { headers: headers(token) }).then(function (res) {
      if (!res.ok) throw new Error("GitHub rejected that token.");
      return res.json();
    });
  }

  function getFile(token, path) {
    var url = API + "/repos/" + SITE.githubUser + "/" + SITE.githubRepo +
      "/contents/" + path + "?ref=" + encodeURIComponent(SITE.githubBranch);
    return fetch(url, { headers: headers(token) }).then(function (res) {
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Could not read " + path);
      return res.json();
    });
  }

  function putFile(token, path, content, message, sha) {
    var body = {
      message: message,
      content: encodeContent(content),
      branch: SITE.githubBranch
    };
    if (sha) body.sha = sha;
    return fetch(API + "/repos/" + SITE.githubUser + "/" + SITE.githubRepo + "/contents/" + path, {
      method: "PUT",
      headers: Object.assign({ "Content-Type": "application/json" }, headers(token)),
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) {
        return res.json().then(function (err) {
          throw new Error((err && err.message) || "GitHub write failed");
        });
      }
      return res.json();
    });
  }

  function deleteFile(token, path, message, sha) {
    return fetch(API + "/repos/" + SITE.githubUser + "/" + SITE.githubRepo + "/contents/" + path, {
      method: "DELETE",
      headers: Object.assign({ "Content-Type": "application/json" }, headers(token)),
      body: JSON.stringify({
        message: message,
        sha: sha,
        branch: SITE.githubBranch
      })
    }).then(function (res) {
      if (res.status === 404) return null;
      if (!res.ok) {
        return res.json().then(function (err) {
          throw new Error((err && err.message) || "GitHub delete failed");
        });
      }
      return res.json();
    });
  }

  function isAllowed(login) {
    return (SITE.allowedAuthors || []).some(function (name) {
      return name.toLowerCase() === String(login || "").toLowerCase();
    });
  }

  function showEditor(user) {
    qs("[data-gate]").hidden = true;
    qs("[data-editor]").classList.add("is-open");
    qs("[data-who]").textContent = user.login;
  }

  function fillCategories(categories, selected) {
    var select = qs("[data-category]");
    select.innerHTML = categories.map(function (cat) {
      var active = cat.slug === selected ? " selected" : "";
      return '<option value="' + Blog.escapeHtml(cat.slug) + '"' + active + ">" +
        Blog.escapeHtml(cat.name) + "</option>";
    }).join("");
  }

  function listExisting(posts) {
    var box = qs("[data-existing]");
    if (!posts.length) {
      box.innerHTML = '<p class="muted">No posts yet.</p>';
      return;
    }
    box.innerHTML = posts.map(function (post) {
      return (
        '<div class="existing-row">' +
          "<div>" +
            '<span class="existing-title">' + Blog.escapeHtml(post.title) + "</span>" +
            '<span class="muted">' + post.date + "</span>" +
          "</div>" +
          '<div class="existing-actions">' +
            '<button class="text-btn" type="button" data-edit-slug="' +
              Blog.escapeHtml(post.slug) + '">Edit</button>' +
            '<button class="text-btn danger" type="button" data-delete-slug="' +
              Blog.escapeHtml(post.slug) + '">Delete</button>' +
          "</div>" +
        "</div>"
      );
    }).join("");
  }

  function setEditorMode(editing) {
    var heading = qs("[data-editor-heading]");
    if (heading) heading.textContent = editing ? "Edit post" : "New post";
    var del = qs("[data-delete-current]");
    if (del) del.hidden = !editing;
  }

  function clearForm() {
    qs("[data-title]").value = "";
    qs("[data-excerpt]").value = "";
    qs("[data-tags]").value = "";
    qs("[data-body]").value = "";
    preview();
    setEditorMode(false);
  }

  function collectForm() {
    return {
      title: qs("[data-title]").value.trim(),
      excerpt: qs("[data-excerpt]").value.trim(),
      category: qs("[data-category]").value,
      tags: qs("[data-tags]").value.split(",").map(function (tag) { return tag.trim(); }).filter(Boolean),
      body: qs("[data-body]").value
    };
  }

  function preview() {
    var data = collectForm();
    qs("[data-preview]").innerHTML = data.body
      ? Blog.markdownToHtml(data.body)
      : '<p class="muted">Preview appears here.</p>';
  }

  function init() {
    var tokenInput = qs("[data-token]");
    var stored = sessionStorage.getItem(TOKEN_KEY);
    var state = { token: stored, user: null, posts: [], categories: [], currentSlug: null };

    function afterAuth(user, token) {
      if (!isAllowed(user.login)) {
        sessionStorage.removeItem(TOKEN_KEY);
        notice("error", "This write desk is locked to " + SITE.allowedAuthors.join(", ") + ".");
        return;
      }
      state.token = token;
      state.user = user;
      sessionStorage.setItem(TOKEN_KEY, token);
      showEditor(user);
      notice("", "");
      return Blog.loadData().then(function (data) {
        state.posts = data.posts;
        state.categories = data.categories;
        fillCategories(state.categories);
        listExisting(state.posts);
        var slug = Blog.query().get("slug");
        if (slug) return loadPost(slug);
      }).catch(function (err) {
        notice("error", err.message);
      });
    }

    function loadPost(slug) {
      var post = state.posts.filter(function (item) { return item.slug === slug; })[0];
      if (!post) {
        notice("error", "That post is not in the index.");
        return Promise.resolve();
      }
      state.currentSlug = slug;
      setEditorMode(true);
      qs("[data-title]").value = post.title;
      qs("[data-excerpt]").value = post.excerpt || "";
      qs("[data-tags]").value = (post.tags || []).join(", ");
      fillCategories(state.categories, post.category);
      history.replaceState({}, "", "/write/?slug=" + encodeURIComponent(slug));
      window.scrollTo({ top: 0, behavior: "smooth" });
      return fetch("/" + post.file, { cache: "no-store" }).then(function (res) {
        if (!res.ok) throw new Error("Could not load the post file.");
        return res.text();
      }).then(function (body) {
        qs("[data-body]").value = body;
        preview();
      });
    }

    if (stored) {
      githubUser(stored).then(function (user) {
        return afterAuth(user, stored);
      }).catch(function () {
        sessionStorage.removeItem(TOKEN_KEY);
      });
    }

    qs("[data-login]").addEventListener("submit", function (event) {
      event.preventDefault();
      var token = tokenInput.value.trim();
      if (!token) return;
      githubUser(token).then(function (user) {
        return afterAuth(user, token);
      }).catch(function (err) {
        notice("error", err.message);
      });
    });

    qs("[data-logout]").addEventListener("click", function () {
      sessionStorage.removeItem(TOKEN_KEY);
      window.location = "/write/";
    });

    qs("[data-body]").addEventListener("input", preview);
    qs("[data-title]").addEventListener("input", preview);

    qs("[data-add-category]").addEventListener("click", function () {
      var name = qs("[data-new-category]").value.trim();
      if (!name) return;
      var slug = slugify(name);
      if (state.categories.some(function (cat) { return cat.slug === slug; })) {
        fillCategories(state.categories, slug);
        qs("[data-new-category]").value = "";
        return;
      }
      state.categories.push({ slug: slug, name: name });
      categoriesDirty = true;
      fillCategories(state.categories, slug);
      qs("[data-new-category]").value = "";
    });

    qs("[data-publish]").addEventListener("click", function () {
      var data = collectForm();
      if (!data.title || !data.body.trim()) {
        notice("error", "A title and some text are required.");
        return;
      }
      if (!data.category) {
        notice("error", "Pick or add a category.");
        return;
      }
      var slug = slugify(data.title);
      var existing = state.posts.filter(function (post) { return post.slug === slug; })[0];
      var meta = {
        slug: slug,
        title: data.title,
        excerpt: data.excerpt || (data.body.split("\n").filter(Boolean)[0] || "").slice(0, 180),
        category: data.category,
        tags: data.tags,
        date: existing ? existing.date : new Date().toISOString().slice(0, 10),
        file: "posts/" + slug + ".md"
      };
      var nextPosts = existing
        ? state.posts.map(function (post) { return post.slug === slug ? meta : post; })
        : [meta].concat(state.posts);

      notice("", "Publishing to GitHub…");
      qs("[data-publish]").disabled = true;

      getFile(state.token, meta.file).then(function (file) {
        return putFile(
          state.token,
          meta.file,
          data.body.replace(/\n$/, "") + "\n",
          (existing ? "Update" : "Add") + " post: " + data.title,
          file && file.sha
        );
      }).then(function () {
        if (!categoriesDirty) return null;
        return getFile(state.token, "data/categories.json").then(function (file) {
          return putFile(
            state.token,
            "data/categories.json",
            JSON.stringify({ categories: state.categories }, null, 2) + "\n",
            "Update categories",
            file && file.sha
          );
        });
      }).then(function () {
        return getFile(state.token, "data/posts.json");
      }).then(function (file) {
        return putFile(
          state.token,
          "data/posts.json",
          JSON.stringify({ posts: nextPosts }, null, 2) + "\n",
          "Update post index",
          file && file.sha
        );
      }).then(function () {
        state.posts = nextPosts;
        state.currentSlug = slug;
        categoriesDirty = false;
        listExisting(state.posts);
        qs("[data-delete-current]").hidden = false;
        setEditorMode(true);
        history.replaceState({}, "", "/write/?slug=" + encodeURIComponent(slug));
        notice("ok", "Published. GitHub Pages will refresh in a minute. View: " + Blog.postHref(slug));
        qs("[data-publish]").disabled = false;
      }).catch(function (err) {
        notice("error", err.message);
        qs("[data-publish]").disabled = false;
      });
    });

    function removePost(slug) {
      var post = state.posts.filter(function (item) { return item.slug === slug; })[0];
      if (!post) {
        notice("error", "That post is not in the index.");
        return;
      }
      if (!window.confirm("Delete “" + post.title + "”? This removes it from GitHub.")) return;

      var nextPosts = state.posts.filter(function (item) { return item.slug !== slug; });
      var buttons = Blog.qsa("[data-delete-slug], [data-delete-current]");
      buttons.forEach(function (btn) { btn.disabled = true; });
      notice("", "Deleting…");

      getFile(state.token, post.file).then(function (file) {
        if (!file || !file.sha) return null;
        return deleteFile(state.token, post.file, "Delete post: " + post.title, file.sha);
      }).then(function () {
        return getFile(state.token, "data/posts.json");
      }).then(function (file) {
        return putFile(
          state.token,
          "data/posts.json",
          JSON.stringify({ posts: nextPosts }, null, 2) + "\n",
          "Remove post from index: " + post.title,
          file && file.sha
        );
      }).then(function () {
        state.posts = nextPosts;
        listExisting(state.posts);
        if (state.currentSlug === slug || slugify(qs("[data-title]").value) === slug) {
          state.currentSlug = null;
          clearForm();
          history.replaceState({}, "", "/write/");
        }
        notice("ok", "Deleted “" + post.title + "”. GitHub Pages will refresh in a minute.");
        buttons.forEach(function (btn) { btn.disabled = false; });
      }).catch(function (err) {
        notice("error", err.message);
        buttons.forEach(function (btn) { btn.disabled = false; });
      });
    }

    qs("[data-existing]").addEventListener("click", function (event) {
      var edit = event.target.closest("[data-edit-slug]");
      if (edit) {
        event.preventDefault();
        loadPost(edit.getAttribute("data-edit-slug")).catch(function (err) {
          notice("error", err.message);
        });
        return;
      }
      var button = event.target.closest("[data-delete-slug]");
      if (!button) return;
      event.preventDefault();
      removePost(button.getAttribute("data-delete-slug"));
    });

    qs("[data-new-post]").addEventListener("click", function () {
      state.currentSlug = null;
      clearForm();
      history.replaceState({}, "", "/write/");
    });

    qs("[data-delete-current]").addEventListener("click", function () {
      var slug = state.currentSlug || slugify(qs("[data-title]").value);
      if (!slug) {
        notice("error", "Open a post before deleting it.");
        return;
      }
      removePost(slug);
    });
  }

  init();
})();
