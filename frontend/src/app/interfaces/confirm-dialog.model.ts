export interface ConfirmDialogState {
  visible: boolean;
  messageKey: string;
  previewName?: string;
  previewImageUrl?: string | null;
  resolve?: (confirmed: boolean) => void;
}

export interface ConfirmDialogOptions {
  previewName?: string;
  previewImageUrl?: string | null;
}
