# Shounak Kulkarni

Personal site hosted on GitHub Pages.

- Home: `/`
- Blog: `/blog/`
- A post: `/post/?slug=hello`

## Writing (author only)

The write desk is unlisted at `/write/`. It is not linked in the public nav.

Only GitHub user `Shounak710` can publish. Unlock it with a fine-grained personal access token for this repo with **Contents: Read and write**. The token is kept in `sessionStorage` for that tab and is never committed.

Publishing writes:

- `posts/{slug}.md`
- `data/posts.json`
- `data/categories.json` (when you add a category)

GitHub Pages will pick up the new files after it rebuilds.
