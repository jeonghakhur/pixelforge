'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react';
import { deleteImageAction, deleteAllImagesAction } from '@/lib/actions/images';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import ToastContainer, { type ToastItem } from '@/components/common/Toast';
import styles from './page.module.scss';

interface ImageMeta {
  name: string;
  fileName: string;
  mimeType: string;
  scale?: number;
  url: string;
}

interface ImageGridProps {
  images: ImageMeta[];
  projectName: string;
}

export default function ImageGrid({ images: initialImages, projectName }: ImageGridProps) {
  const [images, setImages] = useState<ImageMeta[]>(initialImages);
  const [selected, setSelected] = useState<ImageMeta | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ImageMeta | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [syncNotice, setSyncNotice] = useState<{ count: number | null } | null>(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const router = useRouter();
  const versionRef = useRef<number | null>(null);

  // props 변경 시 images 상태 동기화 (router.refresh() 후 서버에서 새 데이터 수신)
  useEffect(() => {
    setImages(initialImages);
  }, [initialImages]);

  // 플러그인 sync 감지 폴링 (5초)
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/sync/images/version');
        if (!res.ok) return;
        const { version, count } = await res.json() as { version: number | null; count: number | null };
        if (version === null) return;
        if (versionRef.current === null) {
          versionRef.current = version;
          return;
        }
        if (version !== versionRef.current) {
          versionRef.current = version;
          setSyncNotice({ count });
        }
      } catch { /* 네트워크 오류 무시 */ }
    };
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  const addToast = (toast: Omit<ToastItem, 'id'>) => {
    setToasts((prev) => [...prev, { ...toast, id: crypto.randomUUID() }]);
  };

  const handleCopy = (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(url).then(() => {
      setCopied(url);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const handleDeleteAllConfirm = async () => {
    setDeletingAll(true);
    const { error, deleted } = await deleteAllImagesAction();
    setDeletingAll(false);
    setDeleteAllOpen(false);
    if (!error) {
      setImages([]);
      setSelected(null);
      addToast({ variant: 'success', message: `${deleted}개 이미지가 삭제됐습니다.` });
    } else {
      addToast({ variant: 'danger', title: '전체 삭제 실패', message: error });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await deleteImageAction(deleteTarget.fileName);
    setDeleting(false);
    if (!error) {
      setImages((prev) => prev.filter((img) => img.fileName !== deleteTarget.fileName));
      if (selected?.fileName === deleteTarget.fileName) setSelected(null);
      addToast({ variant: 'success', message: `'${deleteTarget.fileName}' 삭제됨` });
    } else {
      addToast({ variant: 'danger', title: '삭제 실패', message: error });
    }
    setDeleteTarget(null);
  };

  return (
    <>
      <div className={styles.gridToolbar}>
        <span className={styles.gridCount}>{images.length}개</span>
        {images.length > 0 && (
          <button
            type="button"
            className={styles.deleteAllBtn}
            onClick={() => setDeleteAllOpen(true)}
          >
            <Icon icon="solar:trash-bin-2-linear" width={14} height={14} />
            전체 삭제
          </button>
        )}
      </div>
      <div className={styles.grid}>
        {images.map((img) => (
          <button
            key={img.fileName}
            type="button"
            className={styles.imageCard}
            onClick={() => setSelected(img)}
          >
            <div className={styles.imagePreview}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.name} className={styles.imageThumb} />
              <div className={styles.previewActions}>
                <button
                  type="button"
                  className={`${styles.copyBtn} ${copied === img.url ? styles.copyBtnSuccess : ''}`}
                  onClick={(e) => handleCopy(img.url, e)}
                  aria-label="URL 복사"
                  title={copied === img.url ? '복사됨!' : 'URL 복사'}
                >
                  <Icon
                    icon={copied === img.url ? 'solar:check-circle-bold' : 'solar:copy-linear'}
                    width={13}
                    height={13}
                  />
                </button>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(img); }}
                  aria-label="삭제"
                  title="삭제"
                >
                  <Icon icon="solar:trash-bin-2-linear" width={13} height={13} />
                </button>
              </div>
            </div>
            <div className={styles.imageMeta}>
              <span className={styles.imageName} title={img.fileName}>{img.name}</span>
              <div className={styles.imageInfo}>
                <span className={styles.imageFile}>{img.fileName}</span>
                {img.scale && <span className={styles.imageScale}>@{img.scale}x</span>}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* 라이트박스 */}
      {selected && (
        <div
          className={styles.lightbox}
          onClick={() => setSelected(null)}
          role="dialog"
          aria-modal="true"
          aria-label={selected.name}
        >
          <div className={styles.lightboxInner} onClick={(e) => e.stopPropagation()}>
            <div className={styles.lightboxHeader}>
              <span className={styles.lightboxTitle}>{selected.fileName}</span>
              <div className={styles.lightboxActions}>
                <button
                  type="button"
                  className={styles.lightboxBtn}
                  onClick={(e) => handleCopy(selected.url, e)}
                  title="URL 복사"
                >
                  <Icon icon={copied === selected.url ? 'solar:check-circle-bold' : 'solar:copy-linear'} width={16} height={16} />
                  {copied === selected.url ? '복사됨' : 'URL 복사'}
                </button>
                <a
                  href={selected.url}
                  download={selected.fileName}
                  className={styles.lightboxBtn}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Icon icon="solar:download-linear" width={16} height={16} />
                  다운로드
                </a>
                <button
                  type="button"
                  className={styles.lightboxClose}
                  onClick={() => setSelected(null)}
                  aria-label="닫기"
                >
                  <Icon icon="solar:close-circle-linear" width={20} height={20} />
                </button>
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.url} alt={selected.name} className={styles.lightboxImage} />
            <div className={styles.lightboxFooter}>
              <code className={styles.lightboxUrl}>{selected.url}</code>
              {selected.scale && <span className={styles.imageScale}>@{selected.scale}x</span>}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="이미지 삭제"
        message={`'${deleteTarget?.fileName}' 이미지를 삭제합니다. 파일도 함께 삭제됩니다.`}
        confirmLabel="삭제"
        loading={deleting}
      />

      <ConfirmDialog
        isOpen={deleteAllOpen}
        onClose={() => setDeleteAllOpen(false)}
        onConfirm={handleDeleteAllConfirm}
        title="전체 이미지 삭제"
        message={`${images.length}개 이미지를 모두 삭제합니다. 파일도 함께 삭제되며 복구할 수 없습니다.`}
        confirmLabel="전체 삭제"
        loading={deletingAll}
      />

      <ConfirmDialog
        isOpen={syncNotice !== null}
        onClose={() => setSyncNotice(null)}
        onConfirm={() => { setSyncNotice(null); router.refresh(); }}
        title="이미지 동기화 완료"
        message={
          syncNotice?.count !== null
            ? `플러그인에서 ${syncNotice?.count}개 이미지가 전송됐습니다. 목록을 새로고침하시겠습니까?`
            : '플러그인에서 새 이미지가 전송됐습니다. 목록을 새로고침하시겠습니까?'
        }
        variant="warning"
        icon="solar:gallery-minimalistic-linear"
        confirmLabel="새로고침"
        cancelLabel="나중에"
      />

      <ToastContainer
        toasts={toasts}
        onRemove={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </>
  );
}
