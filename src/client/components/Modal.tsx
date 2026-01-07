import { ComponentChildren } from 'preact';

interface ModalProps {
    isOpen: boolean;
    onClose?: () => void;
    title?: string;
    className?: string;
    children: ComponentChildren;
    'data-testid'?: string;
}

export function Modal({ isOpen, onClose, title, className = '', children, 'data-testid': testId }: ModalProps) {
    if (!isOpen) return null;

    return (
        <div
            class="modal-overlay open"
            data-testid="modal-overlay"
            onClick={(e) => {
                if (e.target === e.currentTarget && onClose) {
                    onClose();
                }
            }}
        >
            <div class={`modal-content ${className}`} data-testid={testId || 'modal-content'}>
                {title && <h3 class="modal-title">{title}</h3>}
                {children}
            </div>
        </div>
    );
}
