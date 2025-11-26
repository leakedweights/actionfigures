import React from 'react';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    isDestructive?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = 'CONFIRM',
    isDestructive = false,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#FFF5F9] border-2 border-[#FF0066] p-6 w-full max-w-md shadow-[8px_8px_0px_0px_#FF0066]">
                <h3 className="text-[#FF0066] font-medium text-lg mb-4">{title}</h3>
                <div className="mb-6">
                    <p className="text-[#FF0066] font-medium break-words whitespace-pre-wrap">{message}</p>
                </div>
                <div className="flex justify-end gap-4">
                    <button
                        onClick={onClose}
                        className="text-[#FF0066] font-medium hover:opacity-70 px-4 py-2"
                    >
                        CANCEL
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`font-medium px-6 py-2 border-2 border-[#FF0066] text-white ${isDestructive ? 'bg-[#FF0066] hover:bg-[#E6005C]' : 'bg-[#FF0066] hover:bg-[#E6005C]'
                            }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};
