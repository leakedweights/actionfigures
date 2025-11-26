import React, { useEffect, useState } from 'react';

interface SaveModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (value: string) => void;
    title: string;
    initialValue: string;
    actionLabel: string;
}

export const SaveModal: React.FC<SaveModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    initialValue,
    actionLabel,
}) => {
    const [value, setValue] = useState(initialValue);

    useEffect(() => {
        setValue(initialValue);
    }, [initialValue, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#FFF5F9] border-2 border-[#FF0066] p-6 w-full max-w-md shadow-[8px_8px_0px_0px_#FF0066]">
                <h3 className="text-[#FF0066] font-medium text-lg mb-4">{title}</h3>
                <form onSubmit={(e) => { e.preventDefault(); onConfirm(value); }}>
                    <div className="mb-6">
                        <label className="block text-[#FF0066] text-sm font-medium mb-2">FILENAME:</label>
                        <input
                            type="text"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            className="w-full p-3 bg-[#FFD9ED] text-[#FF0066] font-medium outline-none border-2 border-[#FF0066] placeholder-[#FFB3D9]"
                            autoFocus
                        />
                    </div>
                    <div className="flex justify-end gap-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-[#FF0066] font-medium hover:opacity-70 px-4 py-2"
                        >
                            CANCEL
                        </button>
                        <button
                            type="submit"
                            className="bg-[#FF0066] text-white font-medium px-6 py-2 hover:bg-[#E6005C] border-2 border-[#FF0066]"
                        >
                            {actionLabel}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
