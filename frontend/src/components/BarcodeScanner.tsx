import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Zap, ZapOff } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
  onTimeout?: () => void;
  timeoutDuration?: number;
}

export default function BarcodeScanner({ onScan, onClose, onTimeout, timeoutDuration = 15000 }: BarcodeScannerProps) {
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const [hasFlash, setHasFlash] = useState(false);
  const [isFlashOn, setIsFlashOn] = useState(false);

  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.getState() === 2) { 
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (err) {
        console.error("Failed to stop scanner", err);
      }
    }
  };

  const toggleFlash = async () => {
    if (html5QrCodeRef.current && hasFlash) {
      try {
        const newState = !isFlashOn;
        await html5QrCodeRef.current.applyVideoConstraints({
          advanced: [{ torch: newState } as MediaTrackConstraintSet]
        });
        setIsFlashOn(newState);
      } catch (err) {
        console.error("Flash error:", err);
      }
    }
  };

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (onTimeout) {
      timeoutId = setTimeout(() => {
        onTimeout();
      }, timeoutDuration);
    }

    const html5QrCode = new Html5Qrcode("reader");
    html5QrCodeRef.current = html5QrCode;

    const config = { 
      fps: 20, 
      qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const boxSize = Math.floor(minEdge * 0.7);
          return { width: boxSize, height: boxSize * 0.6 };
      },
      aspectRatio: window.innerHeight / window.innerWidth
    };

    html5QrCode.start(
      { facingMode: "environment" }, 
      config, 
      (decodedText) => {
        onScan(decodedText);
        void stopScanner();
      },
      () => {}
    ).then(() => {
        // Try to check for flashlight capability
        try {
            const capabilities = html5QrCode.getRunningTrackCapabilities() as MediaTrackCapabilities & { torch?: boolean };
            if (capabilities.torch) {
                setHasFlash(true);
            }
        } catch {
            // Flash not supported or permission denied
        }
    }).catch(err => {
      console.error("Unable to start scanner", err);
    });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      void stopScanner();
    };
  }, [onScan, onTimeout, timeoutDuration]);

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col overflow-hidden animate-in fade-in duration-300">
      <div id="reader" className="absolute inset-0 w-full h-full object-cover"></div>
      
      {/* Controls Overlay */}
      <div className="absolute inset-0 flex flex-col pointer-events-none">
          <header className="p-6 flex justify-end items-center pointer-events-auto">
             {hasFlash && (
                 <button 
                    onClick={toggleFlash}
                    title={isFlashOn ? "Turn Flash Off" : "Turn Flash On"}
                    aria-label={isFlashOn ? "Turn Flash Off" : "Turn Flash On"}
                    className={`w-12 h-12 backdrop-blur-md rounded-full flex items-center justify-center transition-all active:scale-90 pointer-events-auto ${isFlashOn ? 'bg-amber-500 text-white' : 'bg-black/40 text-white'}`}
                 >
                    {isFlashOn ? <ZapOff className="w-6 h-6" /> : <Zap className="w-6 h-6" />}
                 </button>
             )}
          </header>

          <div className="flex-1 flex items-center justify-center relative">
              <div className="w-[70vw] h-[40vw] border-2 border-white/20 rounded-[2.5rem] relative">
                  <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-primary-500 rounded-tl-3xl -translate-x-1 -translate-y-1"></div>
                  <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-primary-500 rounded-tr-3xl translate-x-1 -translate-y-1"></div>
                  <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-primary-500 rounded-bl-3xl -translate-x-1 translate-y-1"></div>
                  <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-primary-500 rounded-br-3xl translate-x-1 translate-y-1"></div>
                  
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary-500 shadow-[0_0_20px_rgba(var(--primary-rgb),0.8)] animate-scan-line"></div>
              </div>
          </div>

          <footer className="p-16 text-center flex flex-col items-center gap-8 pointer-events-auto">
              <p className="text-[10px] font-black text-white/30 tracking-[0.5em] uppercase">Align Barcode to Scan</p>
              <button 
                onClick={onClose}
                className="px-10 py-4 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl text-[10px] font-black text-white uppercase tracking-widest hover:bg-white/20 transition-all active:scale-95"
              >
                Close Scanner
              </button>
          </footer>
      </div>
    </div>
  );
}
