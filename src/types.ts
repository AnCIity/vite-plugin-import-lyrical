/**
 * 库处理配置
 */
interface LibConfig {
  /**
   * 库名称
   */
  name: string
  /**
   * 库目录
   * @default 'es'
   */
  directory?: string
  /**
   * 样式配置
   */
  style: {
    /**
     * 样式引入地址转换
     * @example (name: string, libName: string) => `${libName}/es/components/${name}/style/index.css`
     */
    transform: (name: string, libName: string) => string
    /**
     * 判断样式文件是否存在
     * @default false
     */
    useWhetherExists?: boolean
  }
}

/**
 * 插件配置
 */
export interface IPluginConfig {
  /**
   * 使用库名称列表
   */
  libList: Array<LibConfig>
}

/**
 * 组件配置
 */
interface IComponentConfig extends Omit<LibConfig, 'name'> {
  /**
   * 引入组件名称
   */
  name: string
  /**
   * 引入文件使用组件名称 (因为可能重命名)
   */
  localName: string
}

/**
 * 库数据字典
 */
export interface ILibDict {
  [libName: string]: Array<IComponentConfig>
}
