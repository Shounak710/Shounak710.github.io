(function () {
  "use strict";
  var Blog = window.Blog;
  if (!Blog || !Blog.qs("[data-article]")) return;

  var slug = Blog.query().get("slug");
  var root = Blog.qs("[data-article]");
  if (!slug) {
    root.innerHTML = '<p class="empty">Missing post.</p>';
    return;
  }

  Blog.loadData().then(function (data) {
    var post = data.posts.filter(function (item) { return item.slug === slug; })[0];
    if (!post) {
      root.innerHTML = '<p class="empty">That post is not in the index.</p>';
      return;
    }
    document.title = post.title + " — " + Blog.SITE.name;
    Blog.qs("[data-kicker]").textContent = Blog.categoryName(data.categories, post.category);
    Blog.qs("[data-title]").textContent = post.title;
    Blog.qs("[data-date]").textContent = Blog.formatDate(post.date);
    Blog.qs("[data-tags]").innerHTML = (post.tags || []).map(function (tag) {
      return '<a class="chip" href="/blog/?tag=' + encodeURIComponent(tag) + '">' + Blog.escapeHtml(tag) + "</a>";
    }).join("");
    return fetch("/" + post.file, { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("missing");
      return res.text();
    }).then(function (body) {
      Blog.qs("[data-body]").innerHTML = Blog.markdownToHtml(body);
    });
  }).catch(function () {
    root.innerHTML = '<p class="empty">Could not load this post.</p>';
  });
})();
