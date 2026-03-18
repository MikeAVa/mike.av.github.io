import { renderToString } from 'react-dom/server'
import App from './App'

type Manifest = Record<string, { file?: string; css?: string[] }>

export async function render(_: string, manifest?: Manifest) {
  const appHtml = renderToString(<App />)

  // Try to find client entry info in the SSR manifest (emitted by client build)
  const entryKey = 'src/main.tsx'
  const entry = manifest?.[entryKey]

  const cssLinks = (entry?.css || []).map(href => `<link rel="stylesheet" href="/${href}">`).join('\n')
  const scriptTag = entry?.file
    ? `<script type="module" src="/${entry.file}"></script>`
    : `<script type="module" src="/src/main.tsx"></script>`

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>SSR App</title>
    ${cssLinks}
  </head>
  <body>
    <div id="root">${appHtml}</div>
    ${scriptTag}
  </body>
</html>`
}

export default render
