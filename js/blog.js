(function () {
  "use strict";
  var Blog = window.Blog;
  if (!Blog || !Blog.qs("[data-blog]")) return;

  function apply(data) {
    var params = Blog.query();
    var category = params.get("category") || "";
    var tag = params.get("tag") || "";
    var filters = Blog.qs("[data-filters]");
    var list = Blog.qs("[data-list]");

    var chips = ['<a class="chip' + (!category && !tag ? " is-active" : "") + '" href="/blog/">All</a>'];
    data.categories.forEach(function (cat) {
      var active = category === cat.slug ? " is-active" : "";
      chips.push('<a class="chip' + active + '" href="/blog/?category=' + encodeURIComponent(cat.slug) + '">' +
        Blog.escapeHtml(cat.name) + "</a>");
    });
    filters.innerHTML = chips.join("");

    var posts = data.posts.filter(function (post) {
      if (category && post.category !== category) return false;
      if (tag && (post.tags || []).indexOf(tag) === -1) return false;
      return true;
    });

    if (!posts.length) {
      list.innerHTML = '<p class="empty">No posts in this view yet.</p>';
      return;
    }

    list.innerHTML = posts.map(function (post) {
      return Blog.renderPostCard(post, data.categories);
    }).join("");
  }

  Blog.loadData().then(apply).catch(function () {
    Blog.qs("[data-list]").innerHTML = '<p class="empty">Could not load the blog.</p>';
  });
})();
