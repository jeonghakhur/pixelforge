export { runPipeline } from './pipeline'
export type {
  PluginPayload,
  NormalizedPayload,
  GeneratorOutput,
  PipelineResult,
  ComponentCategory,
  PluginComponentPayload,
  EngineResult,
} from './types'

/** @deprecated runPipeline 사용 */
export { runPipeline as runComponentEngine } from './pipeline'
