(function () {
  "use strict";
  var Blog = window.Blog;
  if (!Blog || !Blog.qs("[data-home-list]")) return;

  Blog.loadData().then(function (data) {
    var latest = data.posts.slice(0, 3);
    var box = Blog.qs("[data-home-list]");
    if (!latest.length) {
      box.innerHTML = '<p class="empty">No posts yet.</p>';
      return;
    }
    box.innerHTML = latest.map(function (post) {
      return Blog.renderPostCard(post, data.categories);
    }).join("");
  }).catch(function () {
    Blog.qs("[data-home-list]").innerHTML = '<p class="empty">Could not load posts.</p>';
  });
})();
