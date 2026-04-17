import styles from './AvatarImage.module.css'
import { forwardRef } from 'react'

export type AvatarImageType = 'square' | 'portrait';

export interface AvatarImageProps extends React.HTMLAttributes<HTMLElement> {
  /** 이미지 URL — https://, http://, 또는 / 로 시작하는 경로 허용 */
  src?: string;
  /** 표시 이름 (Name 텍스트) */
  displayName?: string;
  /** 직책/출처 텍스트 */
  jobTitle?: string;
  /** 이미지 타입 */
  type?: AvatarImageType;
  /** source 표시 여부 */
  source?: boolean;
}

const isSafeUrl = (url?: string): url is string => {
  if (!url) return false
  const t = url.trim()
  return /^https?:\/\//i.test(t) || t.startsWith('/')
}

export const AvatarImage = forwardRef<HTMLElement, AvatarImageProps>(
  (
    {
      src,
      displayName,
      jobTitle,
      type = 'square',
      source = true,
      className,
      ...props
    },
    ref,
  ) => {
    const altText = displayName || jobTitle || ''

    return (
      <figure
        ref={ref}
        data-type={type}
        className={[styles.root, className].filter(Boolean).join(' ')}
        {...props}
      >
        {isSafeUrl(src) ? (
          <img
            src={src}
            alt={altText}
            loading="lazy"
            decoding="async"
            className={styles.image}
          />
        ) : (
          <div className={styles.image} aria-hidden="true" />
        )}
        {source && (displayName || jobTitle) && (
          <figcaption className={styles.caption}>
            {displayName && <span className={styles.name}>{displayName}</span>}
            {jobTitle && <span className={styles.source}>{jobTitle}</span>}
          </figcaption>
        )}
      </figure>
    )
  },
)

AvatarImage.displayName = 'AvatarImage'

export default AvatarImage
