'use client'

import * as RadixSelect from '@radix-ui/react-select'
import { Icon } from '@iconify/react'
import styles from './Select.module.scss'

export interface SelectOption {
  value: string
  label?: string
}

interface SelectProps {
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder = '선택',
  disabled,
  className,
}: SelectProps) {
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <RadixSelect.Trigger className={`${styles.trigger} ${className ?? ''}`}>
        <RadixSelect.Value placeholder={placeholder} className={styles.triggerValue} />
        <RadixSelect.Icon className={styles.triggerIcon}>
          <Icon icon="solar:alt-arrow-down-linear" width={12} height={12} />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content
          className={styles.content}
          position="popper"
          sideOffset={4}
        >
          <RadixSelect.ScrollUpButton className={styles.scrollBtn}>
            <Icon icon="solar:alt-arrow-up-linear" width={12} height={12} />
          </RadixSelect.ScrollUpButton>

          <RadixSelect.Viewport className={styles.viewport}>
            {options.map((opt) => (
              <RadixSelect.Item
                key={opt.value}
                value={opt.value}
                className={styles.item}
              >
                <RadixSelect.ItemIndicator className={styles.itemIndicator}>
                  <Icon icon="solar:check-circle-bold" width={12} height={12} />
                </RadixSelect.ItemIndicator>
                <RadixSelect.ItemText>{opt.label ?? opt.value}</RadixSelect.ItemText>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>

          <RadixSelect.ScrollDownButton className={styles.scrollBtn}>
            <Icon icon="solar:alt-arrow-down-linear" width={12} height={12} />
          </RadixSelect.ScrollDownButton>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  )
}

export default Select
