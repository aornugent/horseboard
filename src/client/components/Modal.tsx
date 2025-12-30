import { ComponentChildren } from 'preact';

interface ModalProps {
    isOpen: boolean;
    onClose?: () => void;
    title?: string;
    className?: string;
    children: ComponentChildren;
}

export function Modal({ isOpen, onClose, title, className = '', children }: ModalProps) {
    if (!isOpen) return null;

    return (
        <div
            class="modal-overlay"
            data-testid="modal-overlay"
            onClick={(e) => {
                if (e.target === e.currentTarget && onClose) {
                    onClose();
                }
            }}
        >
            <div class={`modal-content ${className}`} data-testid="modal-content">
                {title && <h3 class="modal-title">{title}</h3>}
                {children}
            </div>
        </div>
    );
}
