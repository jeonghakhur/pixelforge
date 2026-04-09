/**
 * variantOptions 키를 역할별로 분류한다.
 *
 *   state:    rest/hover/press/disabled 또는 Default/Hover/Focused/Disabled/Loading
 *   size:     xs/sm/md/lg/xl 또는 xsmall/small/...
 *   block:    true/false               → width: 100%
 *   iconOnly: False/True               → 정사각 padding, gap 제거
 *   나머지:   색상·스타일 variant       → CSS data-attribute selector (hierarchy 등)
 */

export interface DimensionKeys {
  stateKey:       string | undefined
  sizeKey:        string | undefined
  blockKey:       string | undefined
  iconOnlyKey:    string | undefined
  appearanceKeys: string[]
}

export function classifyDimensions(variantOptions: Record<string, string[]>): DimensionKeys {
  const keys = Object.keys(variantOptions)
  const normalize = (k: string) => k.toLowerCase().replace(/\s+/g, '')
  return {
    stateKey:       keys.find(k => normalize(k) === 'state'),
    sizeKey:        keys.find(k => normalize(k) === 'size'),
    blockKey:       keys.find(k => normalize(k) === 'block'),
    iconOnlyKey:    keys.find(k => normalize(k) === 'icononly'),
    appearanceKeys: keys.filter(k =>
      !['state', 'size', 'block', 'icononly'].includes(normalize(k)),
    ),
  }
}
