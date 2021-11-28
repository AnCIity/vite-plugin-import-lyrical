import { Plugin, normalizePath } from 'vite'
import * as parser from '@babel/parser'
import { resolve } from 'path'
import fs from 'fs'

export function parseImportModule(code: string, libList: string[]) {
  const ast = parser.parse(code, {
    sourceType: 'module',

    plugins: [
      // enable jsx and flow syntax
      'jsx'
    ]
  })

  const importLabMap: Record<string, string[]> = {}

  if (Array.isArray(ast.program.body)) {
    ast.program.body.forEach((astNode: any) => {
      const libName = (astNode as any)?.source?.value || ''

      if (astNode.type === 'ImportDeclaration' && libList.includes(libName)) {
        astNode.specifiers.forEach((specifier: any) => {
          const { name } = (specifier as any)?.imported
          //   const localName = (specifier as any)?.local.name
          if (!name) return

          if (importLabMap[libName]) importLabMap[libName].push(name)
          else importLabMap[libName] = [name]
        })
      }
    })
  }

  return importLabMap
}

const codeIncludesLibraryName = (code: string, libList: string[]) =>
  !libList.every(libName => !new RegExp(`('${libName}')|("${libName}")`).test(code))

const vitePluginImportLyrical = (): Plugin => {
  // let viteConfig: ResolvedConfig
  const name = 'vite-plugin-import-lyrical'
  // if (!optionsCheck(config)) {
  //   return { name }
  // }

  const libList = ['@lyrical/react']
  return {
    name,
    configResolved() {
      // store the resolved config
      // viteConfig = resolvedConfig
    },
    transform(code, id) {
      if (!/(node_modules)/.test(id) && codeIncludesLibraryName(code, libList)) {
        const importLabMap = parseImportModule(code, libList)

        let importStr = ''

        for (const libName of libList) {
          for (const name of importLabMap[libName]) {
            const path = `${libName}/es/components/${name}/style/index.css`

            const modulePath = normalizePath(require.resolve(libName))
            const lastIndex = modulePath.lastIndexOf(libName)
            const realPath = normalizePath(resolve(modulePath.substring(0, lastIndex), path))
            const has = fs.existsSync(realPath)

            if (has) importStr += `import '${path}';`
          }
        }

        const sourcemap = this?.getCombinedSourcemap()
        return {
          code: importStr + code,
          map: sourcemap
        }
      }
      return {
        code,
        map: null
      }
    }
  }
}

export default vitePluginImportLyrical
