import React, { useRef, useState, useEffect } from 'react';

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const OTPInput: React.FC<OTPInputProps> = ({ length = 6, value, onChange, disabled }) => {
  const [otp, setOtp] = useState<string[]>(new Array(length).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Keep internal state in sync with external value
  useEffect(() => {
    if (value.length === length) {
      setOtp(value.split(""));
    } else if (value.length === 0) {
      setOtp(new Array(length).fill(""));
    }
  }, [value, length]);

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (isNaN(Number(val))) return;

    const newOtp = [...otp];
    // Allow only last character
    newOtp[index] = val.substring(val.length - 1);
    setOtp(newOtp);

    const combinedOtp = newOtp.join("");
    onChange(combinedOtp);

    // Move to next input if value is entered
    if (val && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Move to previous input on backspace if current is empty
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const data = e.clipboardData.getData("text");
    if (!/^\d+$/.test(data)) return;

    const pastedData = data.substring(0, length).split("");
    const newOtp = [...otp];
    pastedData.forEach((char, idx) => {
      if (idx < length) newOtp[idx] = char;
    });
    setOtp(newOtp);
    onChange(newOtp.join(""));
    
    // Focus last filled or next empty
    const lastIdx = Math.min(pastedData.length, length - 1);
    inputRefs.current[lastIdx]?.focus();
  };

  return (
    <div className="flex gap-2 justify-center">
      {otp.map((digit, index) => (
        <input
          key={index}
          type="text"
          ref={(el) => { inputRefs.current[index] = el; }}
          value={digit}
          onChange={(e) => handleChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={index === 0 ? handlePaste : undefined}
          maxLength={1}
          disabled={disabled}
          className="w-12 h-16 bg-surface-bg border-2 border-surface-border rounded-2xl text-2xl font-black text-center focus:border-primary-500 focus:outline-none transition-all disabled:opacity-50"
        />
      ))}
    </div>
  );
};
