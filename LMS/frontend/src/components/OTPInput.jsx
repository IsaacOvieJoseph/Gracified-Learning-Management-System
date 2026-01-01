import React, { useRef, useEffect } from 'react';

const OTPInput = ({ length = 6, value = '', onChange }) => {
    const inputsRef = useRef([]);

    useEffect(() => {
        // Ensure inputsRef array is correct length
        inputsRef.current = inputsRef.current.slice(0, length);
    }, [length]);

    const handleChange = (e, index) => {
        const char = e.target.value;
        if (isNaN(char)) return; // Only allow numbers

        // Handle normal typing (single character)
        if (char.length <= 1) {
            const newValue = value.split('');
            newValue[index] = char;
            const newOtp = newValue.join('');
            onChange(newOtp);

            // Auto-focus next input
            if (char !== '' && index < length - 1) {
                inputsRef.current[index + 1]?.focus();
            }
        }
    };

    const handleKeyDown = (e, index) => {
        if (e.key === 'Backspace') {
            if (!value[index] && index > 0) {
                // If empty and backspace, move to prev and delete
                const newValue = value.split('');
                newValue[index - 1] = '';
                onChange(newValue.join(''));
                inputsRef.current[index - 1]?.focus();
            } else {
                // Just delete current
                const newValue = value.split('');
                newValue[index] = '';
                onChange(newValue.join(''));
            }
        } else if (e.key === 'ArrowLeft' && index > 0) {
            inputsRef.current[index - 1]?.focus();
        } else if (e.key === 'ArrowRight' && index < length - 1) {
            inputsRef.current[index + 1]?.focus();
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').slice(0, length).replace(/\D/g, '');
        onChange(pastedData);

        // Focus the last filled input or the first empty one
        const focusIndex = Math.min(pastedData.length, length - 1);
        inputsRef.current[focusIndex]?.focus();
    };

    return (
        <div className="flex justify-center gap-2 sm:gap-4" onPaste={handlePaste}>
            {Array.from({ length }, (_, index) => (
                <input
                    key={index}
                    ref={(el) => (inputsRef.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={value[index] || ''}
                    onChange={(e) => handleChange(e, index)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-bold border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all shadow-sm bg-gray-50 focus:bg-white text-gray-800"
                    autoFocus={index === 0}
                />
            ))}
        </div>
    );
};

export default OTPInput;
