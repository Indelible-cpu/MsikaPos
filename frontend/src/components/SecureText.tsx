import React, { useState, useEffect } from 'react';
import { Security } from '../utils/security';

interface SecureTextProps {
  data: string;
  className?: string;
  fallback?: string;
}

const SecureText: React.FC<SecureTextProps> = ({ data, className, fallback = 'Encrypted' }) => {
  const [decrypted, setDecrypted] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const decrypt = async () => {
      // If the data is not encrypted (too short), just show it
      if (data.length < 30) {
        setDecrypted(data);
        return;
      }
      
      const result = await Security.decrypt(data);
      if (isMounted) setDecrypted(result);
    };

    decrypt();
    return () => { isMounted = false; };
  }, [data]);

  if (decrypted === null) return <span className={className}>{fallback}</span>;
  return <span className={className}>{decrypted}</span>;
};

export default SecureText;
