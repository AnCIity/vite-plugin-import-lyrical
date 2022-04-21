import { Plugin, normalizePath, ResolvedConfig } from 'vite'
import { parse, ParseResult } from '@babel/parser'
import generate from '@babel/generator'
import { resolve } from 'path'
import { existsSync } from 'fs'
import { File } from '@babel/types'
import { ILibDict, IPluginConfig } from './types'

/**
 * 获取 babel 解析后的数据
 */
const getAst = (code: string) => parse(code, { sourceType: 'module', plugins: ['jsx'] })

/**
 * 解析数据中的引入库
 */
const parseModule = (ast: ParseResult<File>, libList: IPluginConfig['libList']) => {
  const libDict: ILibDict = {}

  if (!Array.isArray(ast.program.body)) return libDict

  for (const astNode of ast.program.body) {
    const libName = (astNode as any)?.source?.value || ''

    const libNames = libList.map(lib => lib.name)
    if (astNode.type !== 'ImportDeclaration' || !libNames.includes(libName)) continue

    for (const specifier of (astNode as any).specifiers) {
      const name = specifier?.imported.name || ''
      const localName = specifier?.local.name || ''
      if (!name) continue

      const index = libList.findIndex(lib => lib.name === libName)

      if (libDict[libName]) libDict[libName].push({ ...libList[index], name, localName })
      else libDict[libName] = [{ ...libList[index], name, localName }]
    }
  }

  return libDict
}

/**
 * 删除引入库
 */
const removeImportLib = (ast: ParseResult<File>, removeLibKeys: Array<string>) => {
  const removeIndex: Array<number> = []

  ast.program.body.forEach((astNode, index) => {
    const libName = (astNode as any)?.source?.value || ''

    if (!removeLibKeys.includes(libName)) return

    removeIndex.push(index)
  })

  ast.program.body = ast.program.body.filter((_item, index) => !removeIndex.includes(index))

  return generate(ast).code
}

const toDash = (str: string) => {
  const v = str.replace(/([A-Z])/g, '-$1').toLowerCase()

  if (v[0] === '-') return v.substring(1)
  return v
}

/**
 * 生成引入组件代码
 */
const generateImportComponentCode = (libDict: ILibDict) => {
  let importComponentCode = ''

  for (const libName of Object.keys(libDict)) {
    const componentList = libDict[libName]

    for (const { name, localName, directory = 'es', camel2DashComponentName = false } of componentList) {
      importComponentCode += `import ${localName} from '${libName}/${directory}/${
        camel2DashComponentName ? toDash(name) : name
      }';`
    }
  }

  return importComponentCode
}

/**
 * 生成引入组件样式代码
 */
const generateImportStyleCode = (libDict: ILibDict) => {
  let importStyleCode = ''

  for (const libName of Object.keys(libDict)) {
    const componentList = libDict[libName]

    for (const { name, style, camel2DashComponentName = false } of componentList) {
      const path = style.transform(camel2DashComponentName ? toDash(name) : name, libName)
      const importPath = `import '${path}';`

      if (style.useWhetherExists === undefined) style.useWhetherExists = true

      if (!style.useWhetherExists) {
        importStyleCode += importPath
        continue
      }

      const modulePath = normalizePath(require.resolve(libName))
      const lastIndex = modulePath.lastIndexOf(libName)
      const realPath = normalizePath(resolve(modulePath.substring(0, lastIndex), path))
      const has = existsSync(realPath)

      importStyleCode += has ? importPath : ''
    }
  }

  return importStyleCode
}

/**
 * code 中是否有需要处理库
 */
const codeHasLib = (code: string, libList: Array<string>) =>
  !libList.every(libName => !new RegExp(`('${libName}')|("${libName}")`).test(code))

let isSourcemap = false

/**
 * vite 按需引入插件
 */
const vitePluginImportLyrical = (config: IPluginConfig): Plugin => {
  let viteConfig: ResolvedConfig

  return {
    name: 'vite-plugin-import-lyrical',
    configResolved(resolvedConfig) {
      viteConfig = resolvedConfig
      isSourcemap = !!viteConfig.build?.sourcemap
    },
    transform(code, id) {
      if (
        /(node_modules)/.test(id) ||
        !codeHasLib(
          code,
          config.libList.map(lib => lib.name)
        )
      ) {
        return { code, map: null }
      }

      const ast = getAst(code)

      const libDice = parseModule(ast, config.libList)

      if (viteConfig.command === 'build') {
        code =
          generateImportComponentCode(
            Object.keys(libDice).reduce((prev, key) => {
              const current = libDice[key]

              if (current[0].demandImportComponent) prev[key] = current
              return prev
            }, {} as ILibDict)
          ) +
          removeImportLib(
            ast,
            Object.keys(libDice).filter(key => libDice[key][0].demandImportComponent)
          )
      }

      code = generateImportStyleCode(libDice) + code

      const sourcemap = this?.getCombinedSourcemap()

      return {
        code,
        map: isSourcemap ? sourcemap : null
      }
    }
  }
}

export default vitePluginImportLyrical
