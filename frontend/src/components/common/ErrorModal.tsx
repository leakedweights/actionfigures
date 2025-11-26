import React from 'react';

interface ErrorModalProps {
    isOpen: boolean;
    onClose: () => void;
    message: string;
}

export const ErrorModal: React.FC<ErrorModalProps> = ({ isOpen, onClose, message }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#FFF5F9] border-2 border-[#FF0066] p-6 w-full max-w-md shadow-[8px_8px_0px_0px_#FF0066]">
                <h3 className="text-[#FF0066] font-medium text-lg mb-4">ERROR</h3>
                <div className="mb-6">
                    <p className="text-[#FF0066] font-medium break-words whitespace-pre-wrap">{message}</p>
                </div>
                <div className="flex justify-end">
                    <button
                        onClick={onClose}
                        className="bg-[#FF0066] text-white font-medium px-6 py-2 hover:bg-[#E6005C] border-2 border-[#FF0066]"
                    >
                        CLOSE
                    </button>
                </div>
            </div>
        </div>
    );
};
