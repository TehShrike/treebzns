---
name: address-inline-comments
description: Open the running app in Chrome, collect the in-page comments the developer left for Claude with the dev comment tool, and address each one. Use when the user asks to launch, open, or start the in-browser feedback tool, or to address or collect the comments.
---

# Address in-page comments

The dev-only tool in src/client/dev_claude_code_comment/ lets the developer option-click any element in the running app and leave a comment for Claude. Saving a comment sets `data-claude-comment="<text>"` on the clicked element and inserts an HTML comment node ` claude: <text> ` directly above it. Comments live only in that tab's DOM.

## Open the app

The Chrome extension only sees tabs in its own tab group. The developer's own tabs are invisible to it, so comments must be left in a tab opened here.

1. Load the browser tools in one ToolSearch call: `tabs_context_mcp`, `navigate`, `javascript_tool`, `computer`.
2. Call `tabs_context_mcp` with `createIfEmpty: true`. Reuse a tab already on localhost:8787 if there is one. Otherwise navigate the tab to http://localhost:8787/app. Log in is by cookie, already set in the browser.
3. Tell the user the tab is open and which page it shows.

## Collect comments

Run this with `javascript_tool`. The extension may redact outerHTML, so gather identifying context per element instead.

```js
[...document.querySelectorAll('[data-claude-comment]')].map(el => ({
  comment: el.dataset.claudeComment,
  tag: el.tagName,
  attrs: [...el.attributes].map(a => a.name + '=' + a.value).join(' '),
  text: el.textContent.trim().slice(0, 120),
  ancestors: (() => { const a = []; let p = el.parentElement; while (p && a.length < 6) { a.push(p.tagName + (p.className ? '.' + String(p.className).split(' ').join('.') : '')); p = p.parentElement } return a })(),
}))
```

If the list is empty, take a screenshot. The developer may be mid-comment (the comment popup is open until they press enter). Wait about ten seconds and collect again. If it is still empty, report that the tab is open and waiting for comments, and stop.

Collect before changing code, reloading, or navigating the tab. A reload discards every comment.

## Address each comment

Use the attributes, text, and ancestor chain to find the component under src/client/route/ or src/client/component/. Make the change, run `pnpm run test:types`, then reload the tab and confirm the behavior in the running app with `javascript_tool` or a screenshot.

Report each comment with what changed. Leave the tab open so the developer can leave more.
