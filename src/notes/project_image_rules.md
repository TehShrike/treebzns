# Project image rules

- A project_image row is inserted before its files upload.  Until the upload lands, `uploaded_at` and the three object keys are NULL.  After it lands, all four are set.  The `chk_project_image_uploaded_files` constraint enforces this, and `DbProjectImage` is a union of the two shapes.
- The object keys in the database are canonical.  Code derives a key from the id and variant only when it writes a new object.
- Every uploaded photo has an original, a display, and a thumbnail file.  The display is the original with the markup drawn on it.  A photo with no markup stores the original's key and ETag as its display, so nothing uploads twice.  Marking the photo uploads a display file under its own key.  Undoing every stroke points the display back at the original and deletes the composed display object.
- Image files are served `private, no-cache` with the stored ETag.  Image URLs carry the ETag as a `v` query (project_image_url), because Chrome reuses an image it already decoded in the same document once the same URL has been shown more than once, whatever the cache headers say.  A changed file is a new URL.
