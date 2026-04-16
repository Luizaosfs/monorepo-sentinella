import { ImageModal } from './ImageModal';

interface ImagePreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
}

/** Enterprise image preview dialog (wraps ImageModal). Use for "Ver imagem" from the details sheet. */
export function ImagePreviewDialog({
  isOpen,
  onClose,
  imageUrl,
}: ImagePreviewDialogProps) {
  return (
    <ImageModal isOpen={isOpen} onClose={onClose} imageUrl={imageUrl} />
  );
}
